const router = require("express").Router();
router.use(
  require("../middleware/auth.middleware"),
  require("../middleware/role.middleware")("RANGER"),
);
router.post("/route", require("../controllers/navigation.controller").route);
router.get(
  "/patrols/:patrolId/risk-zones",
  require("../controllers/navigation.controller").riskContext,
);
module.exports = router;
