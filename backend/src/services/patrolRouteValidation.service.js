const ors = require('./ors.service');
const risk = require('./riskZone.service');
const { pointInGeometry } = require('../../../shared/riskGeometry');
const validatePoints = require('../validators/plannedRoute.validator');
const fail = (code, message) => Object.assign(new Error(message), { code, status: 422, navigationError: true });

// Same ordered stops, walking profile and avoidance checks as Ranger navigation.
// HIGH_RISK markers are warnings, never destinations (matching navigation.service).
exports.validate = async (parkId, supplied, managerId) => {
  let points;
  try { points = validatePoints(supplied); }
  catch (error) { throw fail('INVALID_PATROL_ROUTE', error.message); }
  const stops = points.filter(p => p.type !== 'HIGH_RISK').map(p => ({ ...p, id: `draft:${p.order}` }));
  if (stops.length > 50) throw fail('INVALID_PATROL_ROUTE', 'Use at most 50 required walking destinations.');
  const zones = await risk.forPark(parkId);
  const blocked = stops.find(p => zones.some(z => pointInGeometry(p, z.geometry)));
  if (blocked) throw Object.assign(fail('DESTINATION_IN_RISK_ZONE', 'This patrol point is inside a known risk zone. Reposition it and validate again.'), { routingPoint: { index: blocked.order, type: blocked.type }, riskZones: zones });
  try {
    return await ors.walkingRoute({ rangerId: `manager:${managerId}`, patrolId: `draft:${parkId}`, waypoints: stops, currentLocation: stops[0], destination: stops.at(-1), riskZones: zones });
  } catch (error) {
    // ORS indexes only required stops; map back to the planner's original row.
    if (error.routingPoint && stops[error.routingPoint.index]) {
      const point = stops[error.routingPoint.index];
      error.routingPoint = { index: point.order, type: point.type };
    }
    throw error;
  }
};
