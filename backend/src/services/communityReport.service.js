const repository = require("../repositories/communityReport.repository");
const {
  validateCommunityReportCreation,
  validateReportStatusUpdate,
  validateListQuery,
} = require("../validators/communityReport.validator");

const notFound = (message = "Community report not found.") =>
  Object.assign(new Error(message), { status: 404, authError: true });

const forbidden = (message = "You do not have permission to perform this action.") =>
  Object.assign(new Error(message), { status: 403, authError: true });

const badRequest = (message = "Bad request.") =>
  Object.assign(new Error(message), { status: 400, validationError: true });

function sanitizeReport(report, user = null) {
  if (!report) return report;
  if (!report.isAnonymous) return report;

  const isStaff = user && ["COMMUNITY_LIAISON", "PARK_MANAGER", "RANGER"].includes(user.role);
  const isOwner = user && report.reporterId && user.id === report.reporterId;

  if (!isStaff && !isOwner) {
    return {
      ...report,
      reporterName: null,
      reporterPhone: null,
      reporterId: null,
      reporter: null,
    };
  }

  return {
    ...report,
    reporterName: null,
    reporterPhone: null,
    reporter: null,
  };
}

exports.submitReport = async (body, user = null) => {
  const validated = validateCommunityReportCreation(body);

  const isAnonymous = Boolean(validated.isAnonymous);
  const reporterId = user?.id || null;
  const reporterName = isAnonymous ? null : (validated.reporterName || (user ? user.name : null));
  const reporterPhone = isAnonymous ? null : (validated.reporterPhone || (user ? user.phone : null));

  const reportData = {
    reportType: validated.reportType,
    species: validated.species,
    description: validated.description,
    manualLocation: validated.manualLocation,
    latitude: validated.latitude,
    longitude: validated.longitude,
    isAnonymous,
    reporterName,
    reporterPhone,
    reporterId,
    status: "PENDING",
  };

  // Duplicate report submission protection (60-second window)
  if (typeof repository.findRecentDuplicateReport === "function") {
    const existing = await repository.findRecentDuplicateReport(reportData, 60000);
    if (existing) {
      return sanitizeReport(existing, user);
    }
  }

  const created = await repository.createReport(reportData, validated.evidenceItems);
  return sanitizeReport(created, user);
};

exports.getMyReports = async (userId, query = {}) => {
  const { status, reportType, page = 1, pageSize = 20 } = query;
  const filterStatus = status && status !== "ALL" ? String(status).toUpperCase() : undefined;
  const filterType = reportType && reportType !== "ALL" ? String(reportType).toUpperCase() : undefined;
  const result = await repository.listReportsByReporter(userId, {
    status: filterStatus,
    reportType: filterType,
    page: Math.max(1, parseInt(page, 10) || 1),
    pageSize: Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20)),
  });

  return {
    ...result,
    reports: (result.reports || []).map((r) => sanitizeReport(r, { id: userId, role: "COMMUNITY_USER" })),
  };
};

exports.getReportDetails = async (id, user = null) => {
  if (!id || typeof id !== "string" || !id.trim() || id.trim().length > 128) {
    throw notFound();
  }
  const report = await repository.findReportById(id.trim());
  if (!report) throw notFound();

  const isStaff = user && ["COMMUNITY_LIAISON", "PARK_MANAGER", "RANGER"].includes(user.role);
  const isOwner = user && report.reporterId && user.id === report.reporterId;

  // COMMUNITY_USER can only access reports they own
  if (user && user.role === "COMMUNITY_USER") {
    if (!isOwner) {
      throw forbidden();
    }
  } else if (!isStaff && !isOwner) {
    // For non-staff, non-community users (or unauthenticated requests):
    // If the report belongs to a registered user and is not anonymous, forbid access
    if (report.reporterId && !report.isAnonymous) {
      throw forbidden();
    }
  }

  return sanitizeReport(report, user);
};

exports.listReportsForLiaison = async (query = {}, user = null) => {
  const validated = validateListQuery(query);
  const pageSizeInput = query.pageSize === undefined ? 20 : Number(query.pageSize);
  const pageSize =
    Number.isInteger(pageSizeInput) && pageSizeInput >= 1
      ? Math.min(50, pageSizeInput)
      : 20;
  const result = await repository.listAllReports({
    status: validated.status,
    reportType: validated.reportType,
    search: validated.search,
    from: validated.from,
    to: validated.to,
    page: validated.page,
    pageSize,
  });

  return {
    ...result,
    reports: (result.reports || []).map((r) => sanitizeReport(r, user)),
  };
};

const evidenceStorage = require("./evidenceStorage.service");

exports.uploadEvidence = async (payload) => {
  return evidenceStorage.storeEvidence(payload);
};

exports.attachEvidence = async (id, payload, user = null) => {
  if (!id || typeof id !== "string" || !id.trim() || id.trim().length > 128) {
    throw notFound();
  }
  const report = await repository.findReportById(id.trim());
  if (!report) throw notFound();

  const isStaff = user && ["COMMUNITY_LIAISON", "PARK_MANAGER", "RANGER"].includes(user.role);
  const isOwner = user && report.reporterId && user.id === report.reporterId;

  if (user && user.role === "COMMUNITY_USER") {
    if (!isOwner) {
      throw forbidden();
    }
  } else if (!isStaff && !isOwner && report.reporterId && !report.isAnonymous) {
    throw forbidden();
  }

  const stored = await evidenceStorage.storeEvidence(payload);
  const evidenceRecord = await repository.addEvidence(id.trim(), {
    fileUrl: stored.fileUrl,
    fileType: stored.fileType,
  });

  return {
    ...stored,
    id: evidenceRecord.id,
    reportId: id.trim(),
  };
};

exports.updateReportStatus = async (id, newStatus, user) => {
  if (!id || typeof id !== "string" || !id.trim() || id.trim().length > 128) {
    throw notFound();
  }
  const report = await repository.findReportById(id.trim());
  if (!report) throw notFound();

  const validatedStatus = validateReportStatusUpdate(report.status, newStatus);
  const updated = await repository.updateReportStatus(id.trim(), validatedStatus);
  return sanitizeReport(updated, user);
};

function mapReportTypeToIncidentType(reportType) {
  switch (String(reportType || "").toUpperCase()) {
    case "POACHING":
    case "POACHING_ACTIVITY":
    case "ILLEGAL_SNARE":
      return "POACHING_SNARE";
    case "ILLEGAL_CAMP":
    case "ILLEGAL_CAMPSITE":
    case "ILLEGAL_LOGGING":
    case "ENCROACHMENT":
      return "ILLEGAL_CAMPSITE";
    case "DEAD_ANIMAL":
    case "ANIMAL_CARCASS":
    case "INJURED_ANIMAL":
    case "ANIMAL_INJURY":
      return "ANIMAL_CARCASS";
    case "HUMAN_WILDLIFE_CONFLICT":
    case "WILDLIFE_CONFLICT":
    case "CROP_RAIDING":
    case "WILDLIFE_SIGHTING":
    default:
      return "WILDLIFE_CONFLICT";
  }
}

exports.forwardToIncidentResponse = async (id, user, options = {}) => {
  if (!user || !user.id) {
    throw forbidden("Authentication required.");
  }
  if (!["COMMUNITY_LIAISON", "PARK_MANAGER"].includes(user.role)) {
    throw forbidden("Only authorized Liaison or Manager roles can forward community reports.");
  }
  if (!id || typeof id !== "string" || !id.trim() || id.trim().length > 128) {
    throw notFound();
  }

  const report = await repository.findReportById(id.trim());
  if (!report) throw notFound();

  // Status appropriateness validation
  if (report.status === "RESOLVED") {
    throw badRequest("Cannot forward an already resolved community report.");
  }
  if (report.status === "REJECTED") {
    throw badRequest("Cannot forward a rejected community report.");
  }

  // Prevent duplicate forwarding
  if (report.incidentId) {
    return {
      success: true,
      message: "Community report has already been forwarded to Incident Response.",
      alreadyForwarded: true,
      report: sanitizeReport(report, user),
      incidentId: report.incidentId,
      handoff: {
        sourceReportId: report.id,
        incidentId: report.incidentId,
        targetDepartment: "CONSERVATION_OPERATIONS",
        status: "ALREADY_FORWARDED",
        forwardedAt: report.forwardedAt,
        urgency: options.urgency || "HIGH",
      },
      escalation: {
        reportId: report.id,
        status: "ALREADY_FORWARDED",
        incidentId: report.incidentId,
      },
    };
  }

  const urgency = options.urgency || (report.reportType === "HUMAN_WILDLIFE_CONFLICT" ? "HIGH" : "MEDIUM");
  const notes = options.notes ? String(options.notes).trim().slice(0, 500) : null;

  // Respect anonymous-report privacy
  let incidentDescription = `[Source: Community Report #${report.id}]\n${report.description}`;
  if (report.species) {
    incidentDescription += `\nSpecies: ${report.species}`;
  }
  if (report.isAnonymous) {
    incidentDescription += `\nReporter: Anonymous Community Reporter (Contact details withheld for privacy)`;
  } else if (report.reporterName) {
    incidentDescription += `\nReporter: ${report.reporterName}${report.reporterPhone ? ` (${report.reporterPhone})` : ""}`;
  }
  if (notes) {
    incidentDescription += `\nLiaison Review Notes: ${notes}`;
  }

  const title = `[Community Report] ${report.reportType}${report.species ? ` - ${report.species}` : ""}`.slice(0, 100);

  const evidence = (report.evidence || []).map((e) => ({
    fileUrl: e.fileUrl,
    fileType: String(e.fileType).toLowerCase().includes("video") ? "VIDEO" : "PHOTO",
    caption: `Evidence from Community Report #${report.id}`,
  }));

  const incidentData = {
    title,
    incidentType: mapReportTypeToIncidentType(report.reportType),
    description: incidentDescription,
    latitude: report.latitude || null,
    longitude: report.longitude || null,
    manualLocation: report.manualLocation || null,
    occurredAt: report.submittedAt || new Date(),
    evidence,
  };

  // If report is PENDING, transition it through UNDER_REVIEW to record the Liaison review stage
  if (report.status === "PENDING") {
    await repository.updateReportStatus(report.id, "UNDER_REVIEW");
  }

  const result = await repository.forwardReportToIncident(report.id, {
    incidentData,
    user,
    notes,
  });

  const handoff = {
    sourceReportId: report.id,
    incidentId: result.incident.id,
    targetDepartment: "CONSERVATION_OPERATIONS",
    status: "DISPATCHED",
    forwardedAt: result.report.forwardedAt || new Date(),
    forwardedBy: {
      id: user.id,
      name: user.name,
      role: user.role,
    },
    urgency,
    notes,
    location: {
      manualLocation: report.manualLocation || null,
      latitude: report.latitude || null,
      longitude: report.longitude || null,
    },
  };

  return {
    success: true,
    message: "Community report forwarded to Incident Response successfully.",
    report: sanitizeReport(result.report, user),
    incident: result.incident,
    handoff,
    // Preserve backwards-compatible escalation object
    escalation: {
      reportId: report.id,
      incidentId: result.incident.id,
      status: "ESCALATED_FOR_RESPONSE",
      urgency,
      notes,
      escalatedBy: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    },
  };
};

exports.escalateReport = async (id, user, options = {}) => {
  const result = await exports.forwardToIncidentResponse(id, user, options);
  return {
    ...result,
    message: "Community report escalated to operational response.",
    escalation: {
      ...result.escalation,
      escalatedBy: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    },
  };
};

exports.markAsDone = async (id, user) => {
  if (!id || typeof id !== "string" || !id.trim() || id.trim().length > 128) {
    throw notFound();
  }
  const report = await repository.findReportById(id.trim());
  if (!report) throw notFound();

  const isStaff = user && ["COMMUNITY_LIAISON", "PARK_MANAGER", "RANGER"].includes(user.role);
  if (!isStaff) {
    throw forbidden("Only authorized staff can mark reports as done.");
  }

  const updated = await repository.updateMarkAsDone(id.trim(), true);
  return sanitizeReport(updated, user);
};
