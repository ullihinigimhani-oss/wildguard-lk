const service = require("../services/incident.service");
const {
  validateIncident,
  validateStatus,
  validateFilters,
  id,
  onlyKeys
} = require("../validators/incident.validator");
function endpoint(action, status = 200) {
  return async (req, res, next) => {
    try {
      res.status(status).set("Cache-Control", "no-store").json({
        success: true,
        ...(await action(req))
      });
    } catch (error) {
      next(error);
    }
  };
}
exports.create = endpoint(async req => ({
  incident: await service.create(id(req.params.patrolId, "patrolId"), validateIncident(req.body), req.user, req.get('Idempotency-Key'))
}), 201);
exports.listForPatrol = endpoint(req => service.listForPatrol(id(req.params.patrolId, "patrolId"), validateFilters(req.query), req.user));
exports.listManager = endpoint(req => service.list(validateFilters(req.query, true)));
exports.listForRanger = endpoint(req => service.list(validateFilters(req.query, true)));
exports.details = endpoint(async req => ({
  incident: await service.getIncident(id(req.params.incidentId, "incidentId"), req.user)
}));
exports.edit = endpoint(async req => ({
  incident: await service.edit(id(req.params.incidentId, "incidentId"), validateIncident(req.body, true), req.user)
}));
exports.updateStatus = async (req, res, next) => {
  try {
    const incidentId = id(req.params.incidentId, "incidentId");
    const markAsDone = req.body?.markAsDone;

    // Handle markAsDone for ranger feature
    if (markAsDone !== undefined) {
      onlyKeys(req.body, ["markAsDone"]);
      const db = require("../config/database");
      const result = await db.incident.update({
        where: { id: incidentId },
        data: { markAsDone }
      });
      res.json({ success: true, message: 'Incident marked as done successfully' });
    }
    // Handle status for manager review feature
    else {
      const incident = await service.updateStatus(incidentId, validateStatus(req.body), req.user);
      res.set("Cache-Control", "no-store").json({ success: true, incident });
    }
  } catch (error) {
    next(error);
  }
};
exports.withdraw = endpoint(async req => {
  onlyKeys(req.body ?? {}, []);
  return {
    incident: await service.withdraw(id(req.params.incidentId, "incidentId"), req.user)
  };
});
exports.getVerifiedIncidentsCount = async (req, res, next) => {
  try {
    const db = require("../config/database");
    const count = await db.incident.count({
      where: {
        status: 'VERIFIED',
        withdrawnAt: null
      }
    });
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
};
