const service = require("../services/patrol.service");
const { validatePatrolCreation, validatePatrolFilters } = require("../validators/patrol.validator");
exports.list = async (req, res, next) => {
  try {
    const filters = validatePatrolFilters(req.query);
    const [patrols, total] = await service.listPatrols(filters);
    res.set("Cache-Control", "no-store").json({
      success: true, patrols, total, page: filters.page, pageSize: 25,
    });
  } catch (error) { next(error); }
};
exports.getById = async (req, res, next) => {
  try {
    const patrol = await service.getPatrol(req.params.id);
    res.set("Cache-Control", "no-store").json({ success: true, patrol });
  } catch (error) { next(error); }
};
exports.live = async (req, res, next) => {
  try {
    const { rangers, freshnessSeconds } = await service.getLiveRangers();
    res.set("Cache-Control", "no-store").json({ success: true, rangers, freshnessSeconds });
  } catch (error) { next(error); }
};
exports.trail = async (req, res, next) => {
  try {
    const locations = await service.getPatrolTrail(req.params.id);
    res.set("Cache-Control", "no-store").json({ success: true, locations });
  } catch (error) { next(error); }
};
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

exports.update = async (req, res, next) => {
  try {
    const patrol = await service.updatePatrol(req.params.id, validatePatrolCreation(req.body), req.user.id);
    res.set("Cache-Control", "no-store").json({ success: true, patrol });
  } catch (error) { next(error); }
};
exports.cancel = async (req, res, next) => {
  try {
    const patrol = await service.cancelPatrol(req.params.id);
    res.set("Cache-Control", "no-store").json({ success: true, patrol });
  } catch (error) { next(error); }
};
exports.validateRoute = async (req, res, next) => {
  try {
    const parkId = req.body?.park_ranger_area;
    if (typeof parkId !== 'string' || !parkId || parkId.length > 128 || !await require('../repositories/patrol.repository').findPark(parkId))
      throw Object.assign(new Error('Select a valid park.'), { status: 400, validationError: true, fields: { park_ranger_area: 'Select a valid park.' } });
    const route = await require('../services/patrolRouteValidation.service').validate(parkId, req.body?.plannedRoute, req.user.id);
    res.set('Cache-Control', 'no-store').json({ success: true, route });
  } catch (error) { next(error); }
};
