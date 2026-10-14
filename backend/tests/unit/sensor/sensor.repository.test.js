jest.mock('../../../src/config/database', () => ({
  animal: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  animalLocation: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
}));
const db = require('../../../src/config/database');
const repo = require('../../../src/repositories/sensor.repository');
const loc = (code, extra = {}) => ({ latitude: 0, longitude: 0, animal: { species: 'Elephant', animalCode: code }, ...extra });
test('[B2-DEN-01] two same-species records do not form a zone', () => {
  expect(repo.calculateDensityZones([loc('A'), loc('B')])).toEqual([]);
});
test('[B2-DEN-02] three colocated records form one zone with arithmetic center and codes', () => {
  const rows = [loc('A'), loc('B'), loc('C')].map(Object.freeze);
  expect(repo.calculateDensityZones(rows)).toEqual([{ species: 'Elephant', center: { latitude: 0, longitude: 0 }, radius: 300, animalCount: 3, animalCodes: ['A', 'B', 'C'] }]);
  expect(rows).toHaveLength(3);
});
test('[B2-DEN-03] species separation and absent animal metadata cannot inflate a cluster', () => {
  expect(repo.calculateDensityZones([loc('A'), loc('B'), loc('C', { animal: { species: 'Leopard' } }), loc('D', { animal: null })])).toEqual([]);
});
test('[B2-DEN-04] beyond radius records are excluded', () => {
  expect(repo.calculateDensityZones([loc('A'), loc('B'), loc('C', { latitude: 1 })])).toEqual([]);
});
test('[B2-DEN-05] radius zero includes exactly colocated records', () => {
  expect(repo.calculateDensityZones([loc('A'), loc('B'), loc('C')], 0)[0]).toMatchObject({ radius: 0, animalCount: 3 });
});
test('[B2-DEN-06] existing density counts three records of one animal, including duplicate codes', () => {
  expect(repo.calculateDensityZones([loc('A'), loc('A'), loc('A')])[0]).toMatchObject({ animalCount: 3, animalCodes: ['A', 'A', 'A'] });
});
test('[B2-DEN-07] invalid numeric location cannot join two valid records', () => {
  expect(repo.calculateDensityZones([loc('A'), loc('B'), loc('C', { latitude: NaN })])).toEqual([]);
});
test('[B2-DEN-08] separated species clusters retain independent centers', () => {
  const rows = ['A', 'B', 'C'].map(code => loc(code)).concat(['D', 'E', 'F'].map(code => loc(code, { latitude: 1 })));
  expect(repo.calculateDensityZones(rows).map(zone => zone.center.latitude)).toEqual([0, 1]);
});
test('[B2-REPO-01] latest queries request descending timestamps and only one location per animal', async () => {
  await repo.findLatestLocationByAnimalId('a'); await repo.getAllAnimals(); await repo.getAnimalsWithLatestLocations();
  expect(db.animalLocation.findFirst).toHaveBeenCalledWith({ where: { animalId: 'a' }, orderBy: { recordedAt: 'desc' } });
  expect(db.animal.findMany).toHaveBeenNthCalledWith(1, { include: { locations: { orderBy: { recordedAt: 'desc' }, take: 1 }, collar: true } });
  expect(db.animal.findMany).toHaveBeenNthCalledWith(2, { include: { locations: { orderBy: { recordedAt: 'desc' }, take: 1 } } });
});
test('[B2-REPO-02] date queries retain both inclusive bounds and animal scope', async () => {
  const start = new Date('2026-01-01Z'), end = new Date('2026-01-02Z');
  await repo.getAnimalLocationsByDateRange('a', start, end); await repo.getAllLocationsByDateRange(start, end);
  expect(db.animalLocation.findMany).toHaveBeenNthCalledWith(1, { where: { animalId: 'a', recordedAt: { gte: start, lte: end } }, orderBy: { recordedAt: 'asc' } });
  expect(db.animalLocation.findMany).toHaveBeenNthCalledWith(2, { where: { recordedAt: { gte: start, lte: end } }, include: { animal: true }, orderBy: { recordedAt: 'asc' } });
});
test('[B2-DEN-09] nonzero computed radius includes boundary, just smaller radius excludes it', () => {
  const angle = 0.001 * Math.PI / 180;
  const radius = 6371000 * 2 * Math.atan2(Math.sin(angle / 2), Math.sqrt(1 - Math.sin(angle / 2) ** 2));
  const rows = [loc('A'), loc('B'), loc('C', { latitude: 0.001 })];
  expect(repo.calculateDensityZones(rows, radius)[0]).toMatchObject({ animalCount: 3 });
  expect(repo.calculateDensityZones(rows, radius - 0.000001)).toEqual([]);
});
