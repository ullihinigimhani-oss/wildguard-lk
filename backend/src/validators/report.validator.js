// Report Query Validator
// Validates and sanitizes report generation requests

const VALID_REPORT_TYPES = ["INCIDENT", "PATROL", "CONFLICT_TREND"];

const VALID_PERIODS = ["day", "week", "month"];

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

const PATROL_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

const PATROL_PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

const REPORT_TYPES = [
  "WILDLIFE_SIGHTING",
  "HUMAN_WILDLIFE_CONFLICT",
  "SUSPICIOUS_ACTIVITY",
];

const REPORT_STATUSES = ["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED"];

const EXPORT_FORMATS = ["JSON", "CSV", "PDF"];

/**
 * Parse and validate date from query string
 */
function parseDate(value, field) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid ${field}: must be ISO 8601 date string`);
  }
  return date;
}

/**
 * Validate report generation query parameters
 */
function validateReportQuery(query = {}) {
  const from = parseDate(query.from, "from");
  const to = parseDate(query.to, "to");

  if (from && to && from > to) {
    throw new Error("Invalid date range: from must be before to");
  }

  const period = query.period || "month";
  if (!VALID_PERIODS.includes(period)) {
    throw new Error(
      `Invalid period: must be one of ${VALID_PERIODS.join(", ")}`
    );
  }

  // Optional filters
  const area = query.area ? String(query.area).trim() : null;
  const type = query.type ? String(query.type).toUpperCase() : null;
  const status = query.status ? String(query.status).toUpperCase() : null;
  const priority = query.priority ? String(query.priority).toUpperCase() : null;

  return {
    from,
    to,
    period,
    area,
    type,
    status,
    priority,
  };
}

/**
 * Validate report type
 */
function validateReportType(reportType) {
  if (!reportType) {
    throw new Error("Report type is required");
  }
  const normalized = String(reportType).toUpperCase();
  if (!VALID_REPORT_TYPES.includes(normalized)) {
    throw new Error(
      `Invalid report type: must be one of ${VALID_REPORT_TYPES.join(", ")}`
    );
  }
  return normalized;
}

/**
 * Validate export format
 */
function validateExportFormat(format) {
  if (!format) return "JSON";
  const normalized = String(format).toUpperCase();
  if (!EXPORT_FORMATS.includes(normalized)) {
    throw new Error(
      `Invalid export format: must be one of ${EXPORT_FORMATS.join(", ")}`
    );
  }
  return normalized;
}

module.exports = {
  validateReportQuery,
  validateReportType,
  validateExportFormat,
  VALID_REPORT_TYPES,
  VALID_PERIODS,
  INCIDENT_TYPES,
  INCIDENT_STATUSES,
  PATROL_TYPES,
  PATROL_STATUSES,
  PATROL_PRIORITIES,
  REPORT_TYPES,
  REPORT_STATUSES,
  EXPORT_FORMATS,
};
