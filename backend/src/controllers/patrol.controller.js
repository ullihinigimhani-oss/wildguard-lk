const service = require("../services/patrol.service");
const {
  validatePatrolCreation,
  validatePatrolFilters,
} = require("../validators/patrol.validator");
exports.list = async (req, res, next) => {
  try {
    const filters = validatePatrolFilters(req.query);
    const [patrols, total] = await service.listPatrols(filters);
    res.set("Cache-Control", "no-store").json({
      success: true,
      patrols,
      total,
      page: filters.page,
      pageSize: 25,
    });
  } catch (error) {
    next(error);
  }
};
exports.getById = async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store").json({
      success: true,
      patrol: await service.getPatrol(req.params.id),
    });
  } catch (error) {
    next(error);
  }
};
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
