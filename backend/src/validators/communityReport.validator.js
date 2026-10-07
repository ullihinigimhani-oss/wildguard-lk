const REPORT_TYPES = [
  "WILDLIFE_SIGHTING",
  "HUMAN_WILDLIFE_CONFLICT",
  "SUSPICIOUS_ACTIVITY",
];

const REPORT_STATUSES = [
  "PENDING",
  "UNDER_REVIEW",
  "RESPONSE_IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
];

const VALID_TRANSITIONS = {
  PENDING: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["RESPONSE_IN_PROGRESS", "RESOLVED", "REJECTED"],
  RESPONSE_IN_PROGRESS: ["RESOLVED", "REJECTED", "UNDER_REVIEW"],
  RESOLVED: ["UNDER_REVIEW"],
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
  if (!manualLocation && !hasCoords) {
    fields.location = "Provide a location description or GPS coordinates.";
  }

  const reporterName = text(input.reporterName || input.reporter_name);
  if (reporterName && reporterName.length > 120) {
    fields.reporterName = "Reporter name must not exceed 120 characters.";
  }

  const reporterPhone = text(input.reporterPhone || input.reporter_phone);
  if (reporterPhone) {
    if (reporterPhone.length < 7 || reporterPhone.length > 25) {
      fields.reporterPhone = "Phone number must be between 7 and 25 characters.";
    } else if (!/^[+0-9\s\-()]+$/.test(reporterPhone)) {
      fields.reporterPhone = "Phone number contains invalid characters.";
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

module.exports = {
  REPORT_TYPES,
  REPORT_STATUSES,
  VALID_TRANSITIONS,
  validateCommunityReportCreation,
  validateReportStatusUpdate,
};
