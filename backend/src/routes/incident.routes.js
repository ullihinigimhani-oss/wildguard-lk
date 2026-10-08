const router = require("express").Router();
const authenticate = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const controller = require("../controllers/incident.controller");
const evidence = require("../controllers/incidentEvidence.controller");
// A short-lived evidence capability is minted only after normal authentication.
// The media handler independently rechecks the current account and incident scope.
router.get("/:incidentId/evidence/:evidenceId/media", evidence.media);
router.post(
  "/:incidentId/evidence",
  require("../middleware/evidenceDiagnostics.middleware").start,
);
router.use(authenticate);
router.get(
  "/:incidentId/evidence/uploads/:uploadId",
  allowRoles("RANGER"),
  evidence.uploadStatus, 
);
router.post(
  "/:incidentId/evidence",
  allowRoles("RANGER"),
  (req, res, next) => {
    req.evidenceTrace?.stage("authenticated");
    next();
  },
  require("../middleware/incidentEvidence.middleware").upload,
  evidence.upload,
);
router.get(
  "/:incidentId/evidence/:evidenceId/access",
  allowRoles("RANGER", "PARK_MANAGER"),
  evidence.access,
);
router.get("/", allowRoles("PARK_MANAGER"), controller.listManager);
router.get("/ranger", controller.listForRanger);
router.patch("/:incidentId/status", controller.updateStatus);
router.get(
  "/:incidentId",
  allowRoles("RANGER", "PARK_MANAGER"),
  controller.details,
);
router.patch("/:incidentId", controller.edit);
router.post("/:incidentId/withdraw", allowRoles("RANGER"), controller.withdraw);
router.get("/verified/count", controller.getVerifiedIncidentsCount);
module.exports = router;
