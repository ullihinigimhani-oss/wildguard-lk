// Report Routes
// Conservation report generation and export endpoints for Park Managers

const router = require("express").Router();
const authenticate = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const controller = require("../controllers/report.controller");

// All report endpoints require Park Manager role
router.use(authenticate, allowRoles("PARK_MANAGER"));

// Get available report types
router.get("/types", controller.getReportTypes);

// Generate report (preview)
router.get("/generate", controller.generateReport);

// Export report in specified format
router.get("/export", controller.exportReport);

module.exports = router;
