jest.mock('../../../src/services/ors.service', () => ({ walkingRoute: jest.fn() }));
jest.mock('../../../src/services/riskZone.service', () => ({ forPark: jest.fn() }));
const ors = require('../../../src/services/ors.service');
const risk = require('../../../src/services/riskZone.service');
const service = require('../../../src/services/patrolRouteValidation.service');
const points = () => ['START', 'CHECKPOINT', 'OBSERVATION', 'END'].map((type, order) => ({ type, order, latitude: 7.5 + order * 0.01, longitude: 80.7 }));
beforeEach(() => { jest.resetAllMocks(); risk.forPark.mockResolvedValue([]); ors.walkingRoute.mockResolvedValue({ geometry: { type: 'LineString', coordinates: [[80.7,7.5],[80.7,7.53]] }, distanceMeters: 4000, durationSeconds: 3000 }); });
test('validates the complete ordered walking route using the existing provider', async () => {
  const route = await service.validate('park', points(), 'manager');
  expect(route.distanceMeters).toBe(4000);
  expect(risk.forPark).toHaveBeenCalledWith('park');
  expect(ors.walkingRoute).toHaveBeenCalledWith(expect.objectContaining({ rangerId: 'manager:manager', waypoints: points().map(p => ({...p,id:`draft:${p.order}`,label:null,note:null})), riskZones: [] }));
});
test.each([0,1,3])('propagates unmapped required stop %s without moving coordinates', async index => {
  const supplied = points(), original = JSON.stringify(supplied);
  ors.walkingRoute.mockRejectedValue(Object.assign(new Error('Unmapped point'), { code: 'PATROL_POINT_UNMAPPED', routingPoint: { index, type: supplied[index].type } }));
  await expect(service.validate('park', supplied, 'manager')).rejects.toMatchObject({code:'PATROL_POINT_UNMAPPED',routingPoint:{index,type:supplied[index].type}});
  expect(JSON.stringify(supplied)).toBe(original);
});
test.each(['NO_WALKING_ROUTE','ROUTING_UNAVAILABLE','NO_RISK_AVOIDING_ROUTE'])('fails closed for %s', async code => {
  ors.walkingRoute.mockRejectedValue(Object.assign(new Error(code),{code}));
  await expect(service.validate('park',points(),'manager')).rejects.toMatchObject({code});
});
test('preserves known avoidance polygons and maps provider indexes past warning markers', async () => {
  const geometry = require('../../../../shared/riskGeometry').zonePolygon({centerLatitude:8,centerLongitude:81,radiusMeters:100});
  risk.forPark.mockResolvedValue([{id:'risk',geometry}]);
  const supplied = points(); supplied.splice(1,0,{type:'HIGH_RISK',latitude:8,longitude:81}); supplied.forEach((p,i)=>p.order=i);
  ors.walkingRoute.mockRejectedValue(Object.assign(new Error('Unmapped'),{code:'PATROL_POINT_UNMAPPED',routingPoint:{index:3}}));
  await expect(service.validate('park',supplied,'manager')).rejects.toMatchObject({routingPoint:{index:4,type:'END'}});
  expect(ors.walkingRoute.mock.calls[0][0].riskZones).toHaveLength(1);
});
test('rejects an endpoint inside a risk zone before ORS', async () => {
  risk.forPark.mockResolvedValue([{geometry:require('../../../../shared/riskGeometry').zonePolygon({centerLatitude:7.5,centerLongitude:80.7,radiusMeters:100})}]);
  await expect(service.validate('park',points(),'manager')).rejects.toMatchObject({code:'DESTINATION_IN_RISK_ZONE',routingPoint:{index:0,type:'START'}});
  expect(ors.walkingRoute).not.toHaveBeenCalled();
});
test('unavailable or invalid risk data fails closed before routing', async () => {
  risk.forPark.mockRejectedValue(Object.assign(new Error('Risk data unavailable'), {code:'RISK_ZONE_DATA_UNAVAILABLE'}));
  await expect(service.validate('park',points(),'manager')).rejects.toMatchObject({code:'RISK_ZONE_DATA_UNAVAILABLE'});
  expect(ors.walkingRoute).not.toHaveBeenCalled();
});
