// Report Controller
// Handles conservation report generation and export requests

const reportService = require("../services/report.service");
const {
  validateReportType,
  validateExportFormat,
} = require("../validators/report.validator");
const { exportToCSV, exportToHTML } = require("../utils/export.util");

/**
 * GET /api/reports/generate
 * Generate a conservation report with specified filters
 */
async function generateReport(req, res, next) {
  try {
    const reportType = validateReportType(req.query.reportType);
    const reportData = await reportService.generateReport(
      req.user,
      reportType,
      req.query
    );

    res.set("Cache-Control", "no-store");
    res.json({
      success: true,
      data: reportData,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reports/export
 * Export a report in the specified format (JSON, CSV, PDF/HTML)
 */
async function exportReport(req, res, next) {
  try {
    const reportType = validateReportType(req.query.reportType);
    const format = validateExportFormat(req.query.format);

    const reportData = await reportService.generateReport(
      req.user,
      reportType,
      req.query
    );

    if (format === "CSV") {
      const csv = exportToCSV(reportData);
      const filename = `${reportType}_${new Date().toISOString().split("T")[0]}.csv`;
      
      res.set("Content-Type", "text/csv");
      res.set("Content-Disposition", `attachment; filename="${filename}"`);
      res.set("Cache-Control", "no-store");
      res.send(csv);
    } else if (format === "PDF") {
      // Return HTML that frontend can convert to PDF
      const html = exportToHTML(reportData);
      const filename = `${reportType}_${new Date().toISOString().split("T")[0]}.html`;
      
      res.set("Content-Type", "text/html");
      res.set("Content-Disposition", `attachment; filename="${filename}"`);
      res.set("Cache-Control", "no-store");
      res.send(html);
    } else {
      // JSON format
      const filename = `${reportType}_${new Date().toISOString().split("T")[0]}.json`;
      
      res.set("Content-Type", "application/json");
      res.set("Content-Disposition", `attachment; filename="${filename}"`);
      res.set("Cache-Control", "no-store");
      res.json(reportData);
    }
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reports/types
 * Get available report types and their descriptions
 */
function getReportTypes(req, res) {
  res.json({
    success: true,
    data: [
      {
        type: "INCIDENT",
        name: "Incident Report",
        description: "Detailed analysis of field incidents including types, statuses, and trends",
        filters: ["dateRange", "area", "type", "status"],
      },
      {
        type: "PATROL",
        name: "Patrol Operations Report",
        description: "Patrol activity overview including coverage, status, and operational metrics",
        filters: ["dateRange", "area", "type", "status", "priority"],
      },
      {
        type: "CONFLICT_TREND",
        name: "Human-Wildlife Conflict Trend Report",
        description: "Community-reported conflicts and trends by location and species",
        filters: ["dateRange", "area", "type", "status"],
      },
    ],
  });
}

module.exports = {
  generateReport,
  exportReport,
  getReportTypes,
};
