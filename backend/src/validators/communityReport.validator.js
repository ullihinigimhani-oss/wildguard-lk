const REPORT_TYPES = [
  "WILDLIFE_SIGHTING",
  "HUMAN_WILDLIFE_CONFLICT",
  "SUSPICIOUS_ACTIVITY",
];

const REPORT_STATUSES = [
  "PENDING",
  "UNDER_REVIEW",
  "VERIFIED",
  "REJECTED",
];

// The Park Manager review flow. A fresh report can be verified or rejected in
// one step, and a mistaken decision is corrected by returning it to
// UNDER_REVIEW rather than jumping between terminal states.
const VALID_TRANSITIONS = {
  PENDING: ["UNDER_REVIEW", "VERIFIED", "REJECTED"],
  UNDER_REVIEW: ["VERIFIED", "REJECTED"],
  VERIFIED: ["UNDER_REVIEW"],
  REJECTED: ["UNDER_REVIEW"],
};

const text = (v) => (typeof v === "string" ? v.trim() : "");

const fail = (message, fields = {}) =>
  Object.assign(new Error(message), {
    status: 400,
    validationError: true,
    fields,
  });

function coordinate(value) {
  if (value === undefined || value === null || value === "") return null;
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  return Number.isFinite(num) ? num : NaN;
}

function validateCommunityReportCreation(body) {
  const input =
    body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const fields = {};

  const reportType = text(input.reportType || input.report_type).toUpperCase();
  if (!reportType) {
    fields.reportType = "Select a report type (Sighting, Conflict, or Suspicious Activity).";
  } else if (!REPORT_TYPES.includes(reportType)) {
    fields.reportType = "Invalid report type selected.";
  }

  const species = text(input.species);
  if (species && species.length > 100) {
    fields.species = "Species name must not exceed 100 characters.";
  }

  const description = text(input.description);
  if (!description || description.length < 5) {
    fields.description = "Provide a description of at least 5 characters.";
  } else if (description.length > 2000) {
    fields.description = "Description must not exceed 2000 characters.";
  }

  const manualLocation = text(input.manualLocation || input.manual_location);
  if (manualLocation && manualLocation.length > 250) {
    fields.manualLocation = "Location description must not exceed 250 characters.";
  }

  const latitude = coordinate(input.latitude);
  if (
    (Number.isNaN(latitude) && latitude !== null) ||
    (latitude !== null && (latitude < -90 || latitude > 90))
  ) {
    fields.latitude = "Latitude must be a valid number between -90 and 90.";
  }

  const longitude = coordinate(input.longitude);
  if (
    (Number.isNaN(longitude) && longitude !== null) ||
    (longitude !== null && (longitude < -180 || longitude > 180))
  ) {
    fields.longitude = "Longitude must be a valid number between -180 and 180.";
  }

  const hasCoords = latitude !== null && longitude !== null && !Number.isNaN(latitude) && !Number.isNaN(longitude);
  if ((latitude !== null && longitude === null) || (longitude !== null && latitude === null)) {
    if (latitude === null) fields.latitude = "Latitude is required when longitude is provided.";
    if (longitude === null) fields.longitude = "Longitude is required when latitude is provided.";
  }
  if (!manualLocation && !hasCoords) {
    fields.location = "Provide a location description or GPS coordinates.";
  }

  const isAnonymous = Boolean(
    input.isAnonymous === true ||
    input.is_anonymous === true ||
    input.anonymous === true ||
    input.isAnonymous === "true" ||
    input.is_anonymous === "true" ||
    input.anonymous === "true"
  );

  let reporterName = null;
  let reporterPhone = null;

  if (!isAnonymous) {
    reporterName = text(input.reporterName || input.reporter_name) || null;
    if (reporterName && reporterName.length > 120) {
      fields.reporterName = "Reporter name must not exceed 120 characters.";
    }

    reporterPhone = text(input.reporterPhone || input.reporter_phone) || null;
    if (reporterPhone) {
      if (reporterPhone.length < 7 || reporterPhone.length > 25) {
        fields.reporterPhone = "Phone number must be between 7 and 25 characters.";
      } else if (!/^[+0-9\s\-()]+$/.test(reporterPhone)) {
        fields.reporterPhone = "Phone number contains invalid characters.";
      }
    }
  }

  let evidenceItems = [];
  if (input.evidence !== undefined && input.evidence !== null) {
    if (!Array.isArray(input.evidence)) {
      fields.evidence = "Evidence must be an array of files.";
    } else if (input.evidence.length > 5) {
      fields.evidence = "You can attach a maximum of 5 evidence items.";
    } else {
      for (let i = 0; i < input.evidence.length; i++) {
        const item = input.evidence[i];
        if (!item || typeof item !== "object") {
          fields.evidence = `Evidence item #${i + 1} is invalid.`;
          break;
        }
        const fileUrl = text(item.fileUrl || item.file_url || item.uri);
        const fileType = text(item.fileType || item.file_type || item.type) || "image/jpeg";
        if (!fileUrl) {
          fields.evidence = `Evidence item #${i + 1} must include a fileUrl.`;
          break;
        }
        evidenceItems.push({ fileUrl, fileType });
      }
    }
  }

  if (Object.keys(fields).length) {
    throw fail("Please check your report details.", fields);
  }

  return {
    reportType,
    species: species || null,
    description,
    manualLocation: manualLocation || null,
    latitude: hasCoords ? latitude : null,
    longitude: hasCoords ? longitude : null,
    reporterName: reporterName || null,
    reporterPhone: reporterPhone || null,
    isAnonymous,
    evidenceItems,
  };
}

function validateReportStatusUpdate(currentStatus, newStatus) {
  const status = text(newStatus).toUpperCase();
  if (!status || !REPORT_STATUSES.includes(status)) {
    throw fail("Select a valid report status.", { status: "Invalid report status." });
  }

  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(status)) {
    throw fail(
      `Cannot transition report from ${currentStatus} to ${status}.`,
      { status: `Allowed transitions from ${currentStatus}: ${allowed.join(", ")}` }
    );
  }

  return status;
}

function isoDate(value) {
  if (typeof value !== "string") return null;
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    ? value
    : /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T00:00:00Z`
      : null;
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date : null;
}

// Park Manager / Liaison review list filters. Rejects unknown statuses or
// report types instead of silently returning empty results, and converts the
// date range into absolute timestamps on submittedAt.
function validateListQuery(query) {
  const input =
    query && typeof query === "object" && !Array.isArray(query) ? query : {};
  const fields = {};

  const status = text(input.status).toUpperCase();
  if (status && !REPORT_STATUSES.includes(status)) {
    fields.status = "Select a valid report status.";
  }

  const reportType = text(input.reportType || input.report_type).toUpperCase();
  if (reportType && !REPORT_TYPES.includes(reportType)) {
    fields.reportType = "Invalid report type selected.";
  }

  const search = text(input.search);
  if (search.length > 120) {
    fields.search = "Search must not exceed 120 characters.";
  }

  const pageValue =
    input.page === undefined || input.page === "" ? "1" : String(input.page);
  if (!/^\d+$/.test(pageValue) || Number(pageValue) < 1 || Number(pageValue) > 100000) {
    fields.page = "Enter a page from 1 to 100000.";
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

  if (Object.keys(fields).length) {
    throw fail("Please check the report filters.", fields);
  }

  return {
    status: status || undefined,
    reportType: reportType || undefined,
    search: search || undefined,
    from,
    to,
    page: Number(pageValue),
  };
}

module.exports = {
  REPORT_TYPES,
  REPORT_STATUSES,
  VALID_TRANSITIONS,
  validateCommunityReportCreation,
  validateReportStatusUpdate,
  validateListQuery,
};
