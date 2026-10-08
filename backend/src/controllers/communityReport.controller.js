const service = require("../services/communityReport.service");

exports.submitReport = async (req, res, next) => {
  try {
    const report = await service.submitReport(req.body, req.user || null);
    res.status(201).json({
      success: true,
      message: "Report submitted successfully.",
      report,
    });
  } catch (error) {
    next(error);
  }
};

exports.listMyReports = async (req, res, next) => {
  try {
    const result = await service.getMyReports(req.user.id, req.query);
    res.set("Cache-Control", "no-store").json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

exports.getReportById = async (req, res, next) => {
  try {
    const report = await service.getReportDetails(req.params.id, req.user || null);
    res.set("Cache-Control", "no-store").json({
      success: true,
      report,
    });
  } catch (error) {
    next(error);
  }
};

exports.listAllReports = async (req, res, next) => {
  try {
    const result = await service.listReportsForLiaison(req.query);
    res.set("Cache-Control", "no-store").json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const report = await service.updateReportStatus(
      req.params.id,
      req.body.status,
      req.user
    );
    res.json({
      success: true,
      message: "Report status updated successfully.",
      report,
    });
  } catch (error) {
    next(error);
  }
};

exports.uploadEvidence = async (req, res, next) => {
  try {
    const result = await service.uploadEvidence(req.body);
    res.status(201).json({
      success: true,
      message: "Evidence uploaded successfully.",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

exports.attachEvidence = async (req, res, next) => {
  try {
    const result = await service.attachEvidence(req.params.id, req.body, req.user || null);
    res.status(201).json({
      success: true,
      message: "Evidence attached to report successfully.",
      evidence: result,
    });
  } catch (error) {
    next(error);
  }
};
