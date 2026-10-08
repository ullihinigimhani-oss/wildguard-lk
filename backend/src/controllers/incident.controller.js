const service = require("../services/incident.service");
const {
  validateIncident,
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
  incident: await service.create(id(req.params.patrolId, "patrolId"), validateIncident(req.body), req.user)
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
    console.log('updateStatus called with:', req.params, req.body);
    const { incidentId } = req.params;
    const { markAsDone } = req.body;
    const db = require("../config/database");
    console.log('Attempting to update incident:', incidentId, 'with markAsDone:', markAsDone);
    const result = await db.incident.update({
      where: { id: incidentId },
      data: { markAsDone }
    });
    console.log('Update successful:', result);
    res.json({ success: true, message: 'Incident marked as done successfully' });
  } catch (error) {
    console.error('updateStatus error:', error);
    console.error('Error details:', error.message, error.code);
    next(error);
  }
};
exports.withdraw = endpoint(async req => {
  onlyKeys(req.body ?? {}, []);
  return {
    incident: await service.withdraw(id(req.params.incidentId, "incidentId"), req.user)
  };
});
