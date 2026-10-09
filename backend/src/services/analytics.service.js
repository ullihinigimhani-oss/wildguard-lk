// Park Manager conservation / operational analytics.
//
// Every number is derived from real database rows (never permanent mocks).
// Repositories return only aggregate-required columns and the service turns
// those rows into chart-ready series:
//   - trend: { bucket, label, count } zero-filled across the requested period
//   - byType / byStatus / byPriority / byArea: { key, count } sorted desc
//
// Date handling:
//   - incidents bucket and filter on reportedAt (always populated)
//   - community reports bucket and filter on submittedAt (always populated)
//   - patrols use the patrol's effective operational date
//     (actualStartTime || scheduledDate || createdAt) so completed/started
//     patrols are attributed to when they actually ran when known.
const repository = require("../repositories/analytics.repository");
const {
  INCIDENT_TYPES,
  INCIDENT_STATUSES,
  PATROL_TYPES,
  PATROL_STATUSES,
  PATROL_PRIORITIES,
  REPORT_TYPES,
  REPORT_STATUSES,
  validateAnalyticsQuery,
} = require("../validators/analytics.validator");

const CONFLICT_REPORT_TYPE = "HUMAN_WILDLIFE_CONFLICT";

function inRange(date, from, to) {
  if (
    !date ||
    !(date instanceof Date) ||
    !Number.isFinite(date.getTime())
  ) {
    return false;
  }
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function rangeOn(field, from, to) {
  if (!from && !to) return {};
  return {
    [field]: {
      ...(from && { gte: from }),
      ...(to && { lte: to }),
    },
  };
}

// Bounds the patrol scan by any date column while the service still filters by
// the effective operational date, so a single query covers started and
// scheduled patrols without trusting one column.
function patrolRangeWhere(from, to) {
  if (!from && !to) return {};
  const range = {
    ...(from && { gte: from }),
    ...(to && { lte: to }),
  };
  return {
    OR: [
      { scheduledDate: range },
      { actualStartTime: range },
      { createdAt: range },
    ],
  };
}

function patrolArea(area) {
  return area
    ? { startLocation: { contains: area, mode: "insensitive" } }
    : {};
}

function manualArea(area) {
  return area
    ? { manualLocation: { contains: area, mode: "insensitive" } }
    : {};
}

function parkScope(user) {
  return user?.parkId ? { parkId: user.parkId } : {};
}

// CommunityReport has no park column, so park scoping never applies to it;
// the "area" text filter still narrows those rows by their manual location.
function communityScope(user, areaFilter) {
  return { ...areaFilter };
}

function patrolDate(row) {
  return row?.actualStartTime || row?.scheduledDate || row?.createdAt;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

// UTC bucket starts keep periods deterministic and timezone-independent.
function bucketStart(date, period) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  if (period === "day") return new Date(Date.UTC(year, month, day));
  if (period === "week") {
    const monday = day - ((date.getUTCDay() + 6) % 7);
    return new Date(Date.UTC(year, month, monday));
  }
  return new Date(Date.UTC(year, month, 1));
}

function nextBucket(date, period) {
  if (period === "month") {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  }
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + (period === "week" ? 7 : 1),
    ),
  );
}

function bucketLabel(bucket, period) {
  const year = bucket.getUTCFullYear();
  const month = pad(bucket.getUTCMonth() + 1);
  const day = pad(bucket.getUTCDate());
  return period === "month" ? `${year}-${month}` : `${year}-${month}-${day}`;
}

function buildTrend(rows, period, dateOf, from, to) {
  const counts = new Map();
  for (const row of rows) {
    const at = dateOf(row);
    if (!inRange(at, from, to)) continue;
    const key = bucketStart(at, period).getTime();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const present = [...counts.keys()].sort((a, b) => a - b);
  const start = from
    ? bucketStart(from, period).getTime()
    : present[0];
  const end = to ? bucketStart(to, period).getTime() : present[present.length - 1];
  if (start === undefined || end === undefined) return [];
  const points = [];
  for (
    let cursor = start;
    cursor <= end;
    cursor = nextBucket(new Date(cursor), period).getTime()
  ) {
    const bucket = new Date(cursor);
    points.push({
      bucket: bucket.toISOString(),
      label: bucketLabel(bucket, period),
      count: Number.isFinite(counts.get(cursor)) ? counts.get(cursor) : 0,
    });
  }
  return points;
}

function countBy(rows, field) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[field];
    if (value === null || value === undefined || value === "") continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort(
      (a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)),
    );
}

function countAreas(rows) {
  const counts = new Map();
  for (const row of rows) {
    const area =
      typeof row.manualLocation === "string" ? row.manualLocation.trim() : "";
    if (!area) continue;
    counts.set(area, (counts.get(area) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort(
      (a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)),
    );
}

function patrolSummaries(rows) {
  const byStatus = new Map();
  for (const row of rows) {
    const value = row.status;
    if (value === null || value === undefined) continue;
    byStatus.set(value, (byStatus.get(value) || 0) + 1);
  }
  return {
    total: rows.length,
    scheduled: byStatus.get("SCHEDULED") || 0,
    inProgress: byStatus.get("IN_PROGRESS") || 0,
    completed: byStatus.get("COMPLETED") || 0,
    cancelled: byStatus.get("CANCELLED") || 0,
  };
}

exports.kpis = async (user, query) => {
  const filters = validateAnalyticsQuery(query);
  const where = {
    ...parkScope(user),
    ...manualArea(filters.area),
    ...rangeOn("reportedAt", filters.from, filters.to),
  };
  const [patrolRows, incidentRows, communityRows] = await Promise.all([
    repository.findPatrolsForAnalytics({
      ...parkScope(user),
      ...patrolArea(filters.area),
      ...patrolRangeWhere(filters.from, filters.to),
    }),
    repository.findIncidentsForAnalytics(where),
    repository.findCommunityReportsForAnalytics(
      communityScope(user, {
        ...manualArea(filters.area),
        ...rangeOn("submittedAt", filters.from, filters.to),
      }),
    ),
  ]);
  const patrolsInRange = patrolRows.filter((row) =>
    inRange(patrolDate(row), filters.from, filters.to),
  );
  return {
    patrols: patrolSummaries(patrolsInRange),
    incidents: { total: incidentRows.length },
    community: {
      total: communityRows.length,
      conflictCount: communityRows.filter(
        (row) => row.reportType === CONFLICT_REPORT_TYPE,
      ).length,
    },
  };
};

exports.incidents = async (user, query) => {
  const filters = validateAnalyticsQuery(query, {
    types: INCIDENT_TYPES,
    statuses: INCIDENT_STATUSES,
    allowType: true,
    allowStatus: true,
  });
  const where = {
    ...parkScope(user),
    ...manualArea(filters.area),
    ...rangeOn("reportedAt", filters.from, filters.to),
    ...(filters.type && { incidentType: filters.type }),
    ...(filters.status && { status: filters.status }),
  };
  const rows = await repository.findIncidentsForAnalytics(where);
  return {
    period: filters.period,
    total: rows.length,
    trend: buildTrend(rows, filters.period, (row) => row.reportedAt, filters.from, filters.to),
    byType: countBy(rows, "incidentType"),
    byStatus: countBy(rows, "status"),
  };
};

exports.patrols = async (user, query) => {
  const filters = validateAnalyticsQuery(query, {
    types: PATROL_TYPES,
    statuses: PATROL_STATUSES,
    priorities: PATROL_PRIORITIES,
    allowType: true,
    allowStatus: true,
    allowPriority: true,
  });
  const where = {
    ...parkScope(user),
    ...patrolArea(filters.area),
    ...patrolRangeWhere(filters.from, filters.to),
    ...(filters.type && { patrolType: filters.type }),
    ...(filters.status && { status: filters.status }),
    ...(filters.priority && { priority: filters.priority }),
  };
  const rows = (
    await repository.findPatrolsForAnalytics(where)
  ).filter((row) => inRange(patrolDate(row), filters.from, filters.to));
  return {
    period: filters.period,
    total: rows.length,
    trend: buildTrend(rows, filters.period, patrolDate, filters.from, filters.to),
    byStatus: countBy(rows, "status"),
    byType: countBy(rows, "patrolType"),
    byPriority: countBy(rows, "priority"),
  };
};

exports.communityReports = async (user, query) => {
  const filters = validateAnalyticsQuery(query, {
    types: REPORT_TYPES,
    statuses: REPORT_STATUSES,
    allowType: true,
    allowStatus: true,
  });
  const where = {
    ...manualArea(filters.area),
    ...rangeOn("submittedAt", filters.from, filters.to),
    ...(filters.type && { reportType: filters.type }),
    ...(filters.status && { status: filters.status }),
  };
  const rows = await repository.findCommunityReportsForAnalytics(
    communityScope(user, where),
  );
  return {
    period: filters.period,
    total: rows.length,
    conflictCount: rows.filter(
      (row) => row.reportType === CONFLICT_REPORT_TYPE,
    ).length,
    trend: buildTrend(rows, filters.period, (row) => row.submittedAt, filters.from, filters.to),
    byType: countBy(rows, "reportType"),
    byStatus: countBy(rows, "status"),
    byArea: countAreas(rows),
  };
};

// Exported for unit verification against known records.
exports._internal = {
  bucketStart,
  nextBucket,
  bucketLabel,
  buildTrend,
  countBy,
  countAreas,
  patrolDate,
  inRange,
};