const router = require("express").Router();
const authenticate = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const controller = require("../controllers/alert.controller");
const authService = require("../services/auth.service");

// Optional authentication for public safety alerts feed
const optionalAuth = async (req, res, next) => {
  const match = /^Bearer ([^\s]+)$/.exec(req.get("Authorization") || "");
  if (match) {
    try {
      req.user = await authService.authenticate(match[1]);
    } catch (_) {
      req.user = null;
    }
  }
  next();
};

// 1. View safety alerts feed (public or authenticated)
router.get("/", optionalAuth, controller.listAlerts);

// 2. Get unread alert count for user
router.get("/unread-count", optionalAuth, controller.getUnreadCount);

// 3. Mark all active alerts as read (requires login)
router.post("/read-all", authenticate, controller.markAllAsRead);

// 4. View alert details & safety instructions
router.get("/:id", optionalAuth, controller.getAlertById);

// 5. Mark individual alert as read (requires login)
router.post("/:id/read", authenticate, controller.markAsRead);

// 6. Acknowledge alert (requires login)
router.post("/:id/acknowledge", authenticate, controller.acknowledgeAlert);

// 7. Update alert status (Liaison or Manager)
router.patch("/:id/status", authenticate, allowRoles("COMMUNITY_LIAISON", "PARK_MANAGER"), controller.updateStatus);

module.exports = router;
