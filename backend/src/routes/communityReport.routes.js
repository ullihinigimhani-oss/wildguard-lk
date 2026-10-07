const router = require("express").Router();
const authenticate = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const controller = require("../controllers/communityReport.controller");
const authService = require("../services/auth.service");

// Optional authentication middleware for public reporting
const optionalAuth = async (req, res, next) => {
  const match = /^Bearer ([^\s]+)$/.exec(req.get("Authorization") || "");
  if (match) {
    try {
      req.user = await authService.authenticate(match[1]);
    } catch (_) {
      // If token is invalid or expired, continue as unauthenticated
      req.user = null;
    }
  }
  next();
};

// 1. Submit report (public or authenticated)
router.post("/", optionalAuth, controller.submitReport);

// 2. Community member view their own reports
router.get("/mine", authenticate, allowRoles("COMMUNITY_USER"), controller.listMyReports);

// 3. Liaison & Manager view all community reports
router.get("/", authenticate, allowRoles("COMMUNITY_LIAISON", "PARK_MANAGER"), controller.listAllReports);

// 4. View single report details
router.get("/:id", optionalAuth, controller.getReportById);

// 5. Liaison & Manager update report status
router.patch("/:id/status", authenticate, allowRoles("COMMUNITY_LIAISON", "PARK_MANAGER"), controller.updateStatus);

module.exports = router;
