const service = require("../services/patrol.service");
const { validatePatrolCreation } = require("../validators/patrol.validator");
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
