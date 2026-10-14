// Real routers/controllers/services/repositories; only persistence is replaced.
jest.mock('../../src/config/database', () => ({
  animal: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  animalLocation: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  riskZone: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  park: { findFirst: jest.fn() }, alert: { deleteMany: jest.fn() },
}));
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/database');
const animal = { id: 'a', animalCode: 'ELE001', species: 'Elephant', name: 'Nila', locations: [] };
const telemetry = { animalCode: 'ELE001', latitude: 7.5, longitude: 80.7, heartRate: 60, temperature: 37.5, recordedAt: '2026-01-01T00:00:00Z' };
const zone = { id: 'z', name: 'Waterhole', parkId: 'p', riskLevel: 'HIGH', isActive: true, centerLatitude: 7.5, centerLongitude: 80.7, radiusMeters: 100 };
beforeEach(() => {
  jest.resetAllMocks();
  db.animal.findUnique.mockResolvedValue(animal); db.animal.findMany.mockResolvedValue([animal]);
  db.animal.create.mockImplementation(async ({ data }) => ({ id: 'a', ...data }));
  db.animal.update.mockImplementation(async ({ data }) => ({ id: 'a', ...data }));
  db.animal.delete.mockResolvedValue(animal); db.animalLocation.findFirst.mockResolvedValue(null);
  db.animalLocation.create.mockImplementation(async ({ data }) => ({ id: 'l', ...data }));
  db.animalLocation.findMany.mockResolvedValue([]);
  db.riskZone.create.mockImplementation(async ({ data }) => ({ id: 'z', ...data }));
  db.riskZone.findMany.mockResolvedValue([zone]); db.riskZone.findUnique.mockResolvedValue(zone);
  db.riskZone.update.mockResolvedValue(zone); db.riskZone.delete.mockResolvedValue(zone);
  db.alert.deleteMany.mockResolvedValue({ count: 2 }); db.park.findFirst.mockResolvedValue({ id: 'p' });
});
test('[B2-API-01] public animal registration returns persisted metadata', async () => {
  db.animal.findUnique.mockResolvedValue(null);
  const res = await request(app).post('/api/sensors/animals').send({ animalCode: 'ELE001', species: 'Elephant', name: 'Nila' });
  expect(res.status).toBe(201); expect(res.body).toMatchObject({ success: true, data: { animalCode: 'ELE001', name: 'Nila', sex: null } });
});
test('[B2-API-02] duplicate code prevents insertion and returns sanitized current error contract', async () => {
  const res = await request(app).post('/api/sensors/animals').send({ animalCode: 'ELE001', species: 'Elephant' });
  expect(res.status).toBe(500); expect(res.body).toEqual({ success: false, message: 'Internal server error' });
  expect(db.animal.create).not.toHaveBeenCalled();
});
test('[B2-API-03] telemetry persists numeric coordinates and normalized ISO timestamp', async () => {
  const res = await request(app).post('/api/sensors').send({ ...telemetry, recordedAt: '2026-01-01T05:30:00+05:30' });
  expect(res.status).toBe(201); expect(res.body.data).toMatchObject({ latitude: 7.5, longitude: 80.7, recordedAt: '2026-01-01T00:00:00.000Z', source: 'MOCK_COLLAR' });
});
test('[B2-API-04] metadata update preserves immutable animal code at service boundary', async () => {
  const res = await request(app).put('/api/sensors/animals/a').send({ species: 'Elephant', name: 'New', animalCode: 'BAD' });
  expect(res.status).toBe(200); expect(res.body.data.name).toBe('New');
  expect(db.animal.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { species: 'Elephant', name: 'New', sex: undefined, notes: undefined } });
});
test('[B2-API-05] public animal deletion passes route identity to repository', async () => {
  const res = await request(app).delete('/api/sensors/animals/a');
  expect(res.status).toBe(200); expect(res.body.data.id).toBe('a');
  expect(db.animal.delete).toHaveBeenCalledWith({ where: { id: 'a' } });
});
test('[B2-API-06] latest locations route returns animals through specific route', async () => {
  const res = await request(app).get('/api/sensors/animals/locations');
  expect(res.status).toBe(200); expect(res.body.data).toEqual([animal]);
  expect(db.animal.findMany).toHaveBeenCalledWith({ include: { locations: { orderBy: { recordedAt: 'desc' }, take: 1 } } });
});
test('[B2-API-07] location range passes normalized dates and animal identity', async () => {
  const res = await request(app).get('/api/sensors/animals/a/locations').query({ startDate: telemetry.recordedAt, endDate: telemetry.recordedAt });
  expect(res.status).toBe(200); expect(res.body.data).toEqual([]);
  expect(db.animalLocation.findMany).toHaveBeenCalledWith({ where: { animalId: 'a', recordedAt: { gte: new Date(telemetry.recordedAt), lte: new Date(telemetry.recordedAt) } }, orderBy: { recordedAt: 'asc' } });
});
test('[B2-API-08] density API calculates real cluster using query radius', async () => {
  db.animalLocation.findMany.mockResolvedValue(['A', 'B', 'C'].map(animalCode => ({ latitude: 7.5, longitude: 80.7, animal: { species: 'Elephant', animalCode } })));
  const res = await request(app).get('/api/sensors/zones/density').query({ startDate: telemetry.recordedAt, endDate: telemetry.recordedAt, radius: 450 });
  expect(res.status).toBe(200); expect(res.body.data).toEqual([{ species: 'Elephant', center: { latitude: 7.5, longitude: 80.7 }, radius: 450, animalCount: 3, animalCodes: ['A', 'B', 'C'] }]);
});
test('[B2-API-09] proximity endpoint returns a count envelope', async () => {
  db.animal.findMany.mockResolvedValue([{ ...animal, locations: [{ latitude: 7.5, longitude: 80.7 }] }]);
  const res = await request(app).get('/api/sensors/animals/near-high-risk-zones');
  expect(res.status).toBe(200); expect(res.body).toEqual({ success: true, data: { count: 1 } });
});
test.each([
  ['10', {}, 'missing coordinates'], ['11', { ...telemetry, latitude: 'invalid' }, 'invalid coordinates'],
  ['12', { ...telemetry, recordedAt: 'invalid' }, 'invalid timestamp'],
])('[B2-API-%s] %s persistence rejection is sanitized (validation gap characterized)', async (_id, body) => {
  db.animalLocation.create.mockRejectedValue(new Error('fixture private database detail'));
  const res = await request(app).post('/api/sensors').send(body);
  expect(res.status).toBe(500); expect(res.body).toEqual({ success: false, message: 'Internal server error' });
  expect(db.animalLocation.create).toHaveBeenCalledTimes(1);
});
test.each([
  ['13', '/api/sensors/animals', 'animal', 'findMany'],
  ['14', '/api/sensors/animals/locations', 'animal', 'findMany'],
  ['15', '/api/sensors/locations', 'animalLocation', 'findMany'],
  ['16', '/api/sensors/zones/density', 'animalLocation', 'findMany'],
  ['17', '/api/sensors/animals/near-high-risk-zones', 'riskZone', 'findMany'],
])('[B2-API-%s] GET %s repository failure is safe', async (_id, path, model, method) => {
  db[model][method].mockRejectedValue(new Error('fixture private database detail'));
  const res = await request(app).get(path).query({ startDate: telemetry.recordedAt, endDate: telemetry.recordedAt });
  expect(res.status).toBe(500); expect(res.body).toEqual({ success: false, message: 'Internal server error' });
});
test('[B2-RAPI-01] public risk creation replaces placeholder park with first park', async () => {
  const res = await request(app).post('/api/risk-zones').send({ ...zone, parkId: 'default-park-id' });
  expect(res.status).toBe(200); expect(res.body.data.parkId).toBe('p'); expect(db.park.findFirst).toHaveBeenCalledTimes(1);
});
test('[B2-RAPI-02] explicit park is preserved without fallback lookup', async () => {
  const res = await request(app).post('/api/risk-zones').send({ ...zone, parkId: 'specific' });
  expect(res.body.data.parkId).toBe('specific'); expect(db.park.findFirst).not.toHaveBeenCalled();
});
test('[B2-RAPI-03] missing park and empty park table fail before creation', async () => {
  db.park.findFirst.mockResolvedValue(null);
  const res = await request(app).post('/api/risk-zones').send({ name: 'Waterhole' });
  expect(res.status).toBe(400); expect(res.body.message).toBe('No parks available in the system');
  expect(db.riskZone.create).not.toHaveBeenCalled();
});
test('[B2-RAPI-04] risk list only queries active zones newest first', async () => {
  const res = await request(app).get('/api/risk-zones');
  expect(res.body).toEqual({ success: true, data: [zone] });
  expect(db.riskZone.findMany).toHaveBeenCalledWith({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
});
test('[B2-RAPI-05] unknown zone currently returns successful null without invented 404 policy', async () => {
  db.riskZone.findUnique.mockResolvedValue(null);
  const res = await request(app).get('/api/risk-zones/missing');
  expect(res.status).toBe(200); expect(res.body).toEqual({ success: true, data: null });
});
test('[B2-RAPI-06] risk update passes identity and supplied editable values', async () => {
  const data = { name: 'Updated', riskLevel: 'CRITICAL', isActive: false };
  const res = await request(app).put('/api/risk-zones/z').send(data);
  expect(res.status).toBe(200); expect(db.riskZone.update).toHaveBeenCalledWith({ where: { id: 'z' }, data });
});
test('[B2-RAPI-07] deletion removes related alerts before the zone', async () => {
  const res = await request(app).delete('/api/risk-zones/z');
  expect(res.status).toBe(200); expect(res.body.success).toBe(true);
  expect(db.alert.deleteMany).toHaveBeenCalledWith({ where: { riskZoneId: 'z' } });
  expect(db.riskZone.delete).toHaveBeenCalledWith({ where: { id: 'z' } });
  expect(db.alert.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(db.riskZone.delete.mock.invocationCallOrder[0]);
});
test('[B2-RAPI-08] related-alert deletion failure prevents zone deletion', async () => {
  db.alert.deleteMany.mockRejectedValue(new Error('private constraint'));
  const res = await request(app).delete('/api/risk-zones/z');
  expect(res.status).toBe(500); expect(res.body.message).toBe('Internal server error'); expect(db.riskZone.delete).not.toHaveBeenCalled();
});
test.each([
  ['09', 'post', '/api/risk-zones', 'create'], ['10', 'get', '/api/risk-zones', 'findMany'],
  ['11', 'get', '/api/risk-zones/z', 'findUnique'], ['12', 'put', '/api/risk-zones/z', 'update'],
  ['13', 'delete', '/api/risk-zones/z', 'delete'],
])('[B2-RAPI-%s] %s %s database error is sanitized', async (_id, verb, path, method) => {
  db.riskZone[method].mockRejectedValue(new Error('fixture private database detail'));
  const res = await request(app)[verb](path).send(zone);
  expect(res.status).toBe(500); expect(res.body).toEqual({ success: false, message: 'Internal server error' });
});
test('[B2-RAPI-14] fallback park repository failure returns safe error before zone creation', async () => {
  db.park.findFirst.mockRejectedValue(new Error('private park detail'));
  const res = await request(app).post('/api/risk-zones').send({ name: 'Waterhole' });
  expect(res.status).toBe(500); expect(res.body).toEqual({ success: false, message: 'Internal server error' }); expect(db.riskZone.create).not.toHaveBeenCalled();
});
test.each([['18', 'put', 'update'], ['19', 'delete', 'delete']])(
  '[B2-API-%s] animal %s persistence failure exposes no database detail', async (_id, verb, method) => {
    db.animal[method].mockRejectedValue(new Error('private animal constraint'));
    const res = await request(app)[verb]('/api/sensors/animals/a').send({ name: 'Nila' });
    expect(res.status).toBe(500); expect(res.body).toEqual({ success: false, message: 'Internal server error' });
  });
test('[B2-API-20] malformed JSON fails before telemetry database calls', async () => {
  const res = await request(app).post('/api/sensors').set('Content-Type', 'application/json').send('{');
  expect(res.status).toBe(400); expect(res.body).toEqual({ success: false, message: 'Invalid request body' });
  expect(db.animal.findUnique).not.toHaveBeenCalled(); expect(db.animalLocation.create).not.toHaveBeenCalled();
});
