// Park Manager analytics. All endpoints aggregate real database data for the
// manager's park (when a park is assigned) and never expose private reporter
// identities, contact details, descriptions, or evidence.
const router = require("express").Router();
const authenticate = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const controller = require("../controllers/analytics.controller");

router.use(authenticate, allowRoles("PARK_MANAGER"));
router.get("/kpis", controller.kpis);
router.get("/incidents", controller.incidents);
router.get("/patrols", controller.patrols);
router.get("/community-reports", controller.communityReports);

module.exports = router;