// Park Manager analytics query filters. Mirrors the review-list validator
// style: unknown values are rejected (not silently ignored) and date ranges
// become absolute timestamps. Only aggregates over fields the schema already
// stores - incidents have no priority column, so priority is patrol-only.

const text = (value) => (typeof value === "string" ? value.trim() : "");
const fail = (fields) =>
  Object.assign(new Error("Please check the analytics filters."), {
    status: 400,
    validationError: true,
    fields,
  });

const INCIDENT_TYPES = [
  "POACHING_SNARE",
  "ILLEGAL_CAMPSITE",
  "WILDLIFE_CONFLICT",
  "ANIMAL_CARCASS",
];
const INCIDENT_STATUSES = [
  "PENDING",
  "UNDER_REVIEW",
  "RESPONDING",
  "RESOLVED",
  "VERIFIED",
  "REJECTED",
];
const PATROL_TYPES = [
  "ROUTINE",
  "ANTI_POACHING",
  "WILDLIFE_MONITORING",
  "CONFLICT_RESPONSE",
  "SPECIAL",
];
const PATROL_PRIORITIES = ["LOW", "MEDIUM", "HIGH"];
const PATROL_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const REPORT_TYPES = [
  "WILDLIFE_SIGHTING",
  "HUMAN_WILDLIFE_CONFLICT",
  "SUSPICIOUS_ACTIVITY",
];
const REPORT_STATUSES = ["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED"];
const PERIODS = ["day", "week", "month"];

const ISO =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/;
function isoDate(value) {
  if (typeof value !== "string") return null;
  if (!ISO.test(value)) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  if (value.length === 10) {
    // Calendar-only dates mean the UTC day, mirroring report list filters.
    if (date.toISOString().slice(0, 10) !== value) return null;
    return new Date(value + "T00:00:00.000Z");
  }
  return date;
}

// context: { types, statuses, priorities, allowType, allowStatus, allowPriority }
// Each whitelist applies to a specific entity so "status" always means that
// entity's statuses (never silently maps across entities).
function validateAnalyticsQuery(query, context = {}) {
  const {
    types = [],
    statuses = [],
    priorities = [],
    allowType = false,
    allowStatus = false,
    allowPriority = false,
  } = context;
  const input =
    query && typeof query === "object" && !Array.isArray(query) ? query : {};
  const fields = {};

  const period = text(input.period).toLowerCase();
  if (period && !PERIODS.includes(period)) {
    fields.period = "Select a valid period.";
  }

  let from = null;
  let to = null;
  if (input.from !== undefined && input.from !== null && input.from !== "") {
    from = isoDate(input.from);
    if (!from) fields.from = "Enter a valid ISO date or date/time.";
  }
  if (input.to !== undefined && input.to !== null && input.to !== "") {
    to = isoDate(input.to);
    if (!to) fields.to = "Enter a valid ISO date or date/time.";
  }
  if (from && to && from > to) {
    fields.to = "End date must not precede the start date.";
  }

  const type = text(input.type).toUpperCase();
  if (type && (!allowType || !types.includes(type))) {
    fields.type = "Select a supported type.";
  }

  const status = text(input.status).toUpperCase();
  if (status && (!allowStatus || !statuses.includes(status))) {
    fields.status = "Select a supported status.";
  }

  const priority = text(input.priority).toUpperCase();
  if (priority && (!allowPriority || !priorities.includes(priority))) {
    fields.priority = "Select a supported priority.";
  }

  const area = text(input.area);
  if (area.length > 200) {
    fields.area = "Area must not exceed 200 characters.";
  }

  if (Object.keys(fields).length) {
    throw fail(fields);
  }

  return {
    period: period || "month",
    from,
    to,
    type: type || undefined,
    status: status || undefined,
    priority: priority || undefined,
    area: area || undefined,
  };
}

module.exports = {
  INCIDENT_TYPES,
  INCIDENT_STATUSES,
  PATROL_TYPES,
  PATROL_PRIORITIES,
  PATROL_STATUSES,
  REPORT_TYPES,
  REPORT_STATUSES,
  PERIODS,
  validateAnalyticsQuery,
};