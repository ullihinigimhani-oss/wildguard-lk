const repository = require("../repositories/communityReport.repository");
const {
  validateCommunityReportCreation,
  validateReportStatusUpdate,
  validateListQuery,
} = require("../validators/communityReport.validator");

const notFound = (message = "Community report not found.") =>
  Object.assign(new Error(message), { status: 404, authError: true });

const forbidden = (message = "You do not have permission to view this report.") =>
  Object.assign(new Error(message), { status: 403, authError: true });

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
  const report = await repository.findReportById(id);
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
  const report = await repository.findReportById(id);
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
  const evidenceRecord = await repository.addEvidence(id, {
    fileUrl: stored.fileUrl,
    fileType: stored.fileType,
  });

  return {
    ...stored,
    id: evidenceRecord.id,
    reportId: id,
  };
};

exports.updateReportStatus = async (id, newStatus, user) => {
  const report = await repository.findReportById(id);
  if (!report) throw notFound();

  const validatedStatus = validateReportStatusUpdate(report.status, newStatus);
  const updated = await repository.updateReportStatus(id, validatedStatus);
  return sanitizeReport(updated, user);
};

exports.escalateReport = async (id, user, options = {}) => {
  const report = await repository.findReportById(id);
  if (!report) throw notFound();

  // If report is PENDING, transition it to VERIFIED via UNDER_REVIEW, otherwise
  // mark it VERIFIED directly. Verified is the terminal confirmed state; the
  // resolved/legacy RESPONSE_IN_PROGRESS status no longer exists.
  let updatedReport = report;
  if (report.status !== "VERIFIED") {
    if (report.status === "PENDING") {
      await repository.updateReportStatus(id, "UNDER_REVIEW");
    }
    updatedReport = await repository.updateReportStatus(id, "VERIFIED");
  }

  // Integration point payload for incident / management response
  const escalation = {
    reportId: report.id,
    reportType: report.reportType,
    species: report.species || null,
    description: report.description,
    location: {
      manualLocation: report.manualLocation || null,
      latitude: report.latitude || null,
      longitude: report.longitude || null,
    },
    evidence: (report.evidence || []).map((e) => ({
      fileUrl: e.fileUrl,
      fileType: e.fileType,
    })),
    submittedAt: report.submittedAt,
    escalatedAt: new Date().toISOString(),
    escalatedBy: {
      id: user.id,
      name: user.name,
      role: user.role,
    },
    status: "ESCALATED_FOR_RESPONSE",
    urgency: options.urgency || (report.reportType === "HUMAN_WILDLIFE_CONFLICT" ? "HIGH" : "MEDIUM"),
    notes: options.notes ? String(options.notes).slice(0, 500) : null,
    source: "COMMUNITY_REPORT",
  };

  return {
    report: sanitizeReport(updatedReport, user),
    escalation,
  };
};
