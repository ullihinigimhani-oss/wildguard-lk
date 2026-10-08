const repository = require("../repositories/communityReport.repository");
const {
  validateCommunityReportCreation,
  validateReportStatusUpdate,
} = require("../validators/communityReport.validator");

const notFound = (message = "Community report not found.") =>
  Object.assign(new Error(message), { status: 404, authError: true });

const forbidden = (message = "You do not have permission to view this report.") =>
  Object.assign(new Error(message), { status: 403, authError: true });

exports.submitReport = async (body, user = null) => {
  const validated = validateCommunityReportCreation(body);

  const reporterId = user?.id || null;
  const reporterName = validated.reporterName || (user ? user.name : null);
  const reporterPhone = validated.reporterPhone || (user ? user.phone : null);

  const reportData = {
    reportType: validated.reportType,
    species: validated.species,
    description: validated.description,
    manualLocation: validated.manualLocation,
    latitude: validated.latitude,
    longitude: validated.longitude,
    reporterName,
    reporterPhone,
    reporterId,
    status: "PENDING",
  };

  return repository.createReport(reportData, validated.evidenceItems);
};

exports.getMyReports = async (userId, query = {}) => {
  const { status, reportType, page = 1, pageSize = 20 } = query;
  return repository.listReportsByReporter(userId, {
    status: status ? String(status).toUpperCase() : undefined,
    reportType: reportType ? String(reportType).toUpperCase() : undefined,
    page: Math.max(1, parseInt(page, 10) || 1),
    pageSize: Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20)),
  });
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

  return report;
};

exports.listReportsForLiaison = async (query = {}) => {
  const { status, reportType, search, page = 1, pageSize = 20 } = query;
  return repository.listAllReports({
    status: status ? String(status).toUpperCase() : undefined,
    reportType: reportType ? String(reportType).toUpperCase() : undefined,
    search: typeof search === "string" ? search.slice(0, 120) : undefined,
    page: Math.max(1, parseInt(page, 10) || 1),
    pageSize: Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20)),
  });
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
  return repository.updateReportStatus(id, validatedStatus);
};
