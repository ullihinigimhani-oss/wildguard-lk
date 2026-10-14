jest.mock('../../../src/config/database', () => ({ riskZone: { findMany: jest.fn() } }));
const db = require('../../../src/config/database');
const service = require('../../../src/services/riskZone.service');
const { RISK_POLICY } = require('../../../../shared/riskGeometry');
const zone = extra => ({ id: 'z', name: 'Boundary area', parkId: 'park', isActive: true,
  riskLevel: 'HIGH', centerLatitude: 7.5, centerLongitude: 80.7, radiusMeters: 100, ...extra });
beforeEach(() => db.riskZone.findMany.mockReset().mockResolvedValue([]));

test('[B1-RSK-01] selects the park and active high-risk vocabulary with a bounded query', async () => {
  db.riskZone.findMany.mockResolvedValue([zone(), zone({ id: 'critical', riskLevel: 'CRITICAL' }),
    zone({ id: 'other', parkId: 'other' }), zone({ id: 'inactive', isActive: false }), zone({ id: 'low', riskLevel: 'LOW' })]);
  const result = await service.forPark('park');
  expect(result.map(row => row.id)).toEqual(['z', 'critical']);
  expect(db.riskZone.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { parkId: 'park', isActive: true, riskLevel: { in: ['HIGH', 'CRITICAL'] } },
    orderBy: { id: 'asc' }, take: RISK_POLICY.maxZones + 1,
  }));
  expect(result.every(row => row.geometry.type === 'Polygon')).toBe(true);
});
test('[B1-RSK-02] no applicable zones returns an empty avoidance set', async () => {
  await expect(service.forPark('park')).resolves.toEqual([]);
});
test.each([['B1-RSK-03', ''], ['B1-RSK-04', null], ['B1-RSK-05', 1]])(
  '[%s] invalid park %j fails before data access', async (_id, park) => {
    await expect(service.forPark(park)).rejects.toMatchObject({ status: 422, code: 'RISK_ZONE_DATA_UNAVAILABLE', riskZones: [] });
    expect(db.riskZone.findMany).not.toHaveBeenCalled();
  });
test('[B1-RSK-06] one invalid stored zone fails closed while returning only safe valid context', async () => {
  db.riskZone.findMany.mockResolvedValue([zone(), zone({ id: 'broken', radiusMeters: 0 })]);
  await expect(service.forPark('park')).rejects.toMatchObject({ code: 'RISK_ZONE_DATA_INVALID',
    riskZones: [expect.objectContaining({ id: 'z' })] });
});
test.each([['B1-RSK-07', 32, true], ['B1-RSK-08', 33, false]])(
  '[%s] zone count %i is checked without silently dropping avoidance', async (_id, count, accepted) => {
    db.riskZone.findMany.mockResolvedValue(Array.from({ length: count }, (_, n) => zone({ id: 'z' + n, radiusMeters: 1 })));
    if (accepted) expect(await service.forPark('park')).toHaveLength(32);
    else {
      try { await service.forPark('park'); throw new Error('Expected limit rejection'); }
      catch (error) { expect(error.code).toBe('RISK_AVOIDANCE_LIMIT'); expect(error.riskZones).toHaveLength(32); }
    }
  });
test('[B1-RSK-09] maximum valid radius is accepted', async () => {
  db.riskZone.findMany.mockResolvedValue([zone({ radiusMeters: 5000 })]);
  expect(await service.forPark('park')).toHaveLength(1);
});
test('[B1-RSK-10] oversized radius is rejected as invalid geographic data', async () => {
  db.riskZone.findMany.mockResolvedValue([zone({ radiusMeters: 5000.001 })]);
  await expect(service.forPark('park')).rejects.toMatchObject({ code: 'RISK_ZONE_DATA_INVALID' });
});
test('[B1-RSK-11] excessive combined area blocks routing', async () => {
  db.riskZone.findMany.mockResolvedValue([zone({ radiusMeters: 5000 }), zone({ id: 'second', radiusMeters: 5000 })]);
  await expect(service.forPark('park')).rejects.toMatchObject({ code: 'RISK_AVOIDANCE_LIMIT' });
});
test('[B1-RSK-12] excessive geographic extent blocks routing', async () => {
  db.riskZone.findMany.mockResolvedValue([zone(), zone({ id: 'far', centerLatitude: 8 })]);
  await expect(service.forPark('park')).rejects.toMatchObject({ code: 'RISK_AVOIDANCE_LIMIT' });
});
test('[B1-RSK-13] database failure propagates instead of pretending there are no risk zones', async () => {
  const failure = new Error('Mock database unavailable');
  db.riskZone.findMany.mockRejectedValue(failure);
  await expect(service.forPark('park')).rejects.toBe(failure);
});
test('[B1-RSK-14] presentation bounds text and leaves stored records unchanged', async () => {
  const row = Object.freeze(zone({ name: 'n'.repeat(170), description: 'd'.repeat(2010), secret: 'fixture-only' }));
  db.riskZone.findMany.mockResolvedValue([row]);
  const [result] = await service.forPark('park');
  expect(result.name).toHaveLength(160); expect(result.description).toHaveLength(2000);
  expect(result).not.toHaveProperty('secret'); expect(result).not.toHaveProperty('radiusMeters');
  expect(row.name).toHaveLength(170); expect(row.radiusMeters).toBe(100);
});
