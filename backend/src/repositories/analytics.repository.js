// Read-only projections for Park Manager analytics. They select only the
// aggregate fields needed for charts and KPIs - never reporter identity,
// contact details, descriptions, or evidence. Aggregations run in the service
// over these rows, keeping the queries simple and testable against known data.
const db = () => require("../config/database");

const patrolSelect = {
  status: true,
  patrolType: true,
  priority: true,
  scheduledDate: true,
  actualStartTime: true,
  createdAt: true,
  startLocation: true,
};

const incidentSelect = {
  status: true,
  incidentType: true,
  reportedAt: true,
  manualLocation: true,
};

const communitySelect = {
  status: true,
  reportType: true,
  submittedAt: true,
  manualLocation: true,
};

exports.findPatrolsForAnalytics = (where) =>
  db().patrol.findMany({
    where,
    select: patrolSelect,
    orderBy: { createdAt: "asc" },
  });

exports.findIncidentsForAnalytics = (where) =>
  db().incident.findMany({
    where,
    select: incidentSelect,
    orderBy: { reportedAt: "asc" },
  });

exports.findCommunityReportsForAnalytics = (where) =>
  db().communityReport.findMany({
    where,
    select: communitySelect,
    orderBy: { submittedAt: "asc" },
  });