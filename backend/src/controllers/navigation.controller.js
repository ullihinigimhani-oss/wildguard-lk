const service = require("../services/navigation.service");
exports.fullPatrolRoute = async (req, res, next) => {
  try {
    res
      .set("Cache-Control", "no-store")
      .json({
        success: true,
        route: await service.fullPatrolRoute(req.params.patrolId, req.user.id),
      });
  } catch (error) {
    next(error);
  }
};
exports.riskContext = async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store").json({
      success: true,
      riskZones: await service.riskContext(req.params.patrolId, req.user.id),
    });
  } catch (error) {
    next(error);
  }
};
exports.route = async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store").json({
      success: true,
      route: await service.route(req.body, req.user.id),
    });
  } catch (error) {
    next(error);
  }
};
exports.locations = async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store").json({
      success: true,
      locations: await service.locations(req.params.patrolId, req.user.id),
    });
  } catch (error) {
    next(error);
  }
};
exports.recordLocation = async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store").json({
      success: true,
      ...(await service.recordLocation(
        req.params.patrolId,
        req.body,
        req.user.id,
      )),
    });
  } catch (error) {
    next(error);
  }
};
