jest.mock('../../../src/config/database', () => ({ riskZone: { findMany: jest.fn() } }));
jest.mock('../../../src/repositories/sensor.repository', () => ({
  findAnimalByCode: jest.fn(), createAnimal: jest.fn(), findLatestLocationByAnimalId: jest.fn(),
  updateAnimalLocation: jest.fn(), createAnimalLocation: jest.fn(), updateAnimal: jest.fn(), deleteAnimal: jest.fn(),
  getAnimalsWithLatestLocations: jest.fn(), getAllLocationsByDateRange: jest.fn(), calculateDensityZones: jest.fn(),
}));
const repo = require('../../../src/repositories/sensor.repository');
const db = require('../../../src/config/database');
const service = require('../../../src/services/sensor.service');
const start = new Date('2026-01-01T00:00:00Z');
const dto = (extra = {}) => ({ animalCode: 'ELE001', latitude: 7.5, longitude: 80.7,
  heartRate: 60, temperature: 37.5, activityLevel: 'ACTIVE', recordedAt: start.toISOString(), ...extra });
beforeEach(() => {
  jest.resetAllMocks();
  repo.findAnimalByCode.mockResolvedValue({ id: 'a' });
  repo.findLatestLocationByAnimalId.mockResolvedValue(null);
  repo.createAnimalLocation.mockImplementation(async data => ({ id: 'location', ...data }));
  repo.updateAnimalLocation.mockImplementation(async (id, data) => ({ id, ...data }));
});
test('[B2-SVC-01] registration converts absent optional metadata to null', async () => {
  repo.findAnimalByCode.mockResolvedValue(null);
  repo.createAnimal.mockResolvedValue({ id: 'new' });
  expect(await service.createAnimal({ animalCode: 'ELE001', species: 'Elephant' })).toEqual({ id: 'new' });
  expect(repo.createAnimal).toHaveBeenCalledWith({ animalCode: 'ELE001', species: 'Elephant', name: null, sex: null, notes: null });
});
test('[B2-SVC-02] duplicate registration fails before insert', async () => {
  await expect(service.createAnimal({ animalCode: 'ELE001', species: 'Elephant' })).rejects.toThrow('already exists');
  expect(repo.createAnimal).not.toHaveBeenCalled();
});
test('[B2-SVC-03] updates whitelist metadata and cannot overwrite code or identity', async () => {
  repo.updateAnimal.mockResolvedValue({ id: 'a' });
  const input = Object.freeze({ species: 'Elephant', name: 'Nila', sex: 'Female', notes: 'note', id: 'other', animalCode: 'LEO001' });
  await service.updateAnimal('a', input);
  expect(repo.updateAnimal).toHaveBeenCalledWith('a', { species: 'Elephant', name: 'Nila', sex: 'Female', notes: 'note' });
});
test('[B2-SVC-04] unknown collar creates Unknown animal then its first location', async () => {
  repo.findAnimalByCode.mockResolvedValue(null); repo.createAnimal.mockResolvedValue({ id: 'new' });
  expect(await service.addSensorData(dto())).toMatchObject({ animalId: 'new', recordedAt: start, source: 'MOCK_COLLAR' });
  expect(repo.createAnimal).toHaveBeenCalledWith({ animalCode: 'ELE001', species: 'Unknown', name: null, sex: null, notes: 'Created from sensor data' });
  expect(repo.findLatestLocationByAnimalId).toHaveBeenCalledWith('new');
});
test('[B2-SVC-05] timezone-equivalent timestamp becomes a Date without coordinate rounding', async () => {
  const result = await service.addSensorData(dto({ recordedAt: '2026-01-01T05:30:00+05:30', latitude: 7.512345 }));
  expect(result).toMatchObject({ latitude: 7.512345, longitude: 80.7, heartRate: 60, temperature: 37.5, recordedAt: start });
});
test('[B2-SVC-06] omitted timestamp uses the current deterministic clock', async () => {
  jest.useFakeTimers().setSystemTime(start);
  try { expect((await service.addSensorData(dto({ recordedAt: undefined }))).recordedAt).toEqual(start); }
  finally { jest.useRealTimers(); }
});
test.each([['07', 3599999, true], ['08', 3600000, false], ['09', 3600001, false], ['10', 0, true], ['11', -1, true]])(
  '[B2-SVC-%s] telemetry delta %i ms chooses the implemented update boundary', async (_id, delta, updates) => {
    repo.findLatestLocationByAnimalId.mockResolvedValue({ id: 'latest', recordedAt: start });
    const recordedAt = new Date(start.getTime() + delta);
    const result = await service.addSensorData(dto({ recordedAt }));
    expect(result.recordedAt).toEqual(recordedAt);
    expect(repo.updateAnimalLocation).toHaveBeenCalledTimes(updates ? 1 : 0);
    expect(repo.createAnimalLocation).toHaveBeenCalledTimes(updates ? 0 : 1);
    if (updates) expect(repo.updateAnimalLocation).toHaveBeenCalledWith('latest', expect.objectContaining({ latitude: 7.5, recordedAt }));
  });
test.each([['12', 'findAnimalByCode'], ['13', 'findLatestLocationByAnimalId'], ['14', 'createAnimalLocation']])(
  '[B2-SVC-%s] ingestion propagates %s repository failure', async (_id, method) => {
    const error = new Error('fixture repository unavailable'); repo[method].mockRejectedValue(error);
    await expect(service.addSensorData(dto())).rejects.toBe(error);
    expect(repo.updateAnimalLocation).not.toHaveBeenCalled();
  });
test('[B2-SVC-15] failed update is not converted to a second insert', async () => {
  repo.findLatestLocationByAnimalId.mockResolvedValue({ id: 'latest', recordedAt: start });
  repo.updateAnimalLocation.mockRejectedValue(new Error('update unavailable'));
  await expect(service.addSensorData(dto())).rejects.toThrow('update unavailable');
  expect(repo.createAnimalLocation).not.toHaveBeenCalled();
});
test('[B2-SVC-16] invalid timestamp currently reaches persistence and its failure propagates', async () => {
  repo.createAnimalLocation.mockRejectedValue(new Error('Invalid Date'));
  await expect(service.addSensorData(dto({ recordedAt: 'invalid' }))).rejects.toThrow('Invalid Date');
  expect(Number.isNaN(repo.createAnimalLocation.mock.calls[0][0].recordedAt.getTime())).toBe(true);
});
test('[B2-SVC-17] missing coordinates currently reach persistence, without service validation', async () => {
  repo.createAnimalLocation.mockRejectedValue(new Error('required coordinates'));
  await expect(service.addSensorData(dto({ latitude: undefined, longitude: undefined }))).rejects.toThrow('required coordinates');
  expect(repo.createAnimalLocation).toHaveBeenCalledWith(expect.objectContaining({ latitude: undefined, longitude: undefined }));
});
test('[B2-SVC-18] density uses requested range and radius and returns calculated result', async () => {
  const rows = [{ id: 'location' }]; repo.getAllLocationsByDateRange.mockResolvedValue(rows);
  repo.calculateDensityZones.mockReturnValue([{ animalCount: 3 }]);
  expect(await service.getDensityZones(start, start, 500)).toEqual([{ animalCount: 3 }]);
  expect(repo.getAllLocationsByDateRange).toHaveBeenCalledWith(start, start);
  expect(repo.calculateDensityZones).toHaveBeenCalledWith(rows, 500);
});
test('[B2-SVC-19] density query failure is not reported as empty wildlife', async () => {
  repo.getAllLocationsByDateRange.mockRejectedValue(new Error('unavailable'));
  await expect(service.getDensityZones(start, start)).rejects.toThrow('unavailable');
  expect(repo.calculateDensityZones).not.toHaveBeenCalled();
});
test('[B2-SVC-20] absence of high-risk zones avoids animal query', async () => {
  db.riskZone.findMany.mockResolvedValue([]);
  expect(await service.getAnimalsNearHighRiskZones()).toBe(0);
  expect(repo.getAnimalsWithLatestLocations).not.toHaveBeenCalled();
  expect(db.riskZone.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { riskLevel: { in: ['HIGH', 'CRITICAL'] }, isActive: true } }));
});
test('[B2-SVC-21] overlapping zones count an animal once, latest only, missing and distant excluded', async () => {
  db.riskZone.findMany.mockResolvedValue([1, 2].map(id => ({ id, centerLatitude: 7.5, centerLongitude: 80.7, radiusMeters: 1 })));
  repo.getAnimalsWithLatestLocations.mockResolvedValue([
    { locations: [{ latitude: 7.5, longitude: 80.7 }] }, { locations: [] }, {},
    { locations: [{ latitude: 8, longitude: 81 }, { latitude: 7.5, longitude: 80.7 }] },
  ]);
  expect(await service.getAnimalsNearHighRiskZones()).toBe(1);
});
test('[B2-SVC-22] exact zero-radius center is inclusive and NaN location is excluded', async () => {
  db.riskZone.findMany.mockResolvedValue([{ centerLatitude: 0, centerLongitude: 0, radiusMeters: 0 }]);
  repo.getAnimalsWithLatestLocations.mockResolvedValue([{ locations: [{ latitude: 0, longitude: 0 }] }, { locations: [{ latitude: NaN, longitude: 0 }] }]);
  expect(await service.getAnimalsNearHighRiskZones()).toBe(1);
});
test('[B2-SVC-23] proximity query failure propagates', async () => {
  db.riskZone.findMany.mockRejectedValue(new Error('zones unavailable'));
  await expect(service.getAnimalsNearHighRiskZones()).rejects.toThrow('zones unavailable');
});
test('[B2-SVC-24] animal delete failure propagates without false success', async () => {
  repo.deleteAnimal.mockRejectedValue(new Error('related data constraint'));
  await expect(service.deleteAnimal('a')).rejects.toThrow('related data constraint');
  expect(repo.deleteAnimal).toHaveBeenCalledWith('a');
});
