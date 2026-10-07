const router = require("express").Router();
const authenticate = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const controller = require("../controllers/patrol.controller");
router.use(authenticate);
router.get("/mine", allowRoles("RANGER"), controller.listMine);
router.get("/mine/:patrolId", allowRoles("RANGER"), controller.getMine);
router.post(
  "/mine/:patrolId/start",
  allowRoles("RANGER"),
  controller.startMine,
);
router.post(
  "/mine/:patrolId/complete",
  allowRoles("RANGER"),
  controller.completeMine,
);
router.get(
  "/mine/:patrolId/locations",
  allowRoles("RANGER"),
  require("../controllers/navigation.controller").locations,
);
router.post(
  "/mine/:patrolId/locations",
  allowRoles("RANGER"),
  require("../controllers/navigation.controller").recordLocation,
);
router.use(allowRoles("PARK_MANAGER"));
router.get("/rangers", controller.listAssignableRangers);
router.post("/", controller.create);
router.get("/", controller.list);
router.get("/:id", controller.getById);
router.patch("/:id", controller.update);
router.post("/:id/cancel", controller.cancel);
module.exports = router;
