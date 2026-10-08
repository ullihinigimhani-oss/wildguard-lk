const repository = require("../repositories/communityReport.repository");
const {
  validateCommunityReportCreation,
  validateReportStatusUpdate,
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
  const result = await repository.listReportsByReporter(userId, {
    status: status ? String(status).toUpperCase() : undefined,
    reportType: reportType ? String(reportType).toUpperCase() : undefined,
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

  // If report was filed by a registered user, non-staff users can only access their own report
  if (report.reporterId && user && !["COMMUNITY_LIAISON", "PARK_MANAGER", "RANGER"].includes(user.role)) {
    if (report.reporterId !== user.id) {
      throw forbidden();
    }
  }

  return sanitizeReport(report, user);
};

exports.listReportsForLiaison = async (query = {}, user = null) => {
  const { status, reportType, search, page = 1, pageSize = 20 } = query;
  const result = await repository.listAllReports({
    status: status ? String(status).toUpperCase() : undefined,
    reportType: reportType ? String(reportType).toUpperCase() : undefined,
    search: typeof search === "string" ? search.slice(0, 120) : undefined,
    page: Math.max(1, parseInt(page, 10) || 1),
    pageSize: Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20)),
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

  if (report.reporterId && user && !["COMMUNITY_LIAISON", "PARK_MANAGER", "RANGER"].includes(user.role)) {
    if (report.reporterId !== user.id) {
      throw forbidden();
    }
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
