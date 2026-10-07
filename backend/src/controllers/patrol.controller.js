const service = require("../services/patrol.service");
const { validatePatrolCreation } = require("../validators/patrol.validator");
function rangerAction(method) {
  return async (req, res, next) => {
    try {
      const patrol = await service[method](req.params.patrolId, req.user.id);
      res.set("Cache-Control", "no-store").json({ success: true, patrol });
    } catch (error) { next(error); }
  };
}
exports.getMine = rangerAction("getRangerPatrol");
exports.startMine = rangerAction("startRangerPatrol");
exports.completeMine = rangerAction("completeRangerPatrol");
exports.listMine = async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store").json({
      success: true, patrols: await service.getRangerPatrols(req.user.id),
    });
  } catch (error) { next(error); }
};
exports.listAssignableRangers = async (req, res, next) => {
  try {
    res
      .set("Cache-Control", "no-store")
      .json({ success: true, rangers: await service.getAssignableRangers() });
  } catch (error) {
    next(error);
  }
};
exports.create = async (req, res, next) => {
  try {
    const patrol = await service.createPatrol(
      validatePatrolCreation(req.body),
      req.user.id,
    );
    res
      .status(201)
      .json({ success: true, message: "Patrol created successfully.", patrol });
  } catch (error) {
    next(error);
  }
};
