const { NAVIGATION, validCoordinate, distanceMeters, distanceToRouteMeters, shouldRecordSample } = require('../../../../shared/patrolNavigation');
test.each([
  ['B1-NAV-01', { latitude: 0, longitude: 0 }, true],
  ['B1-NAV-02', { latitude: 90, longitude: 180 }, true],
  ['B1-NAV-03', { latitude: -90, longitude: -180 }, true],
  ['B1-NAV-04', { latitude: 90.001, longitude: 0 }, false],
  ['B1-NAV-05', { latitude: 0, longitude: -180.001 }, false],
  ['B1-NAV-06', { latitude: '7.5', longitude: 80 }, false],
  ['B1-NAV-07', { latitude: NaN, longitude: 0 }, false],
  ['B1-NAV-08', { latitude: 0, longitude: Infinity }, false],
  ['B1-NAV-09', null, false],
])('[%s] coordinate %j has the expected validity', (_id, point, valid) => expect(Boolean(validCoordinate(point))).toBe(valid));
test('[B1-NAV-10] identical positions have zero distance and antipodes remain finite', () => {
  const origin = { latitude: 0, longitude: 0 };
  expect(distanceMeters(origin, origin)).toBe(0);
  expect(distanceMeters(origin, { latitude: 0, longitude: 180 })).toBeCloseTo(Math.PI * 6371008.8, 4);
});
test('[B1-NAV-11] empty route has no finite distance', () => {
  expect(distanceToRouteMeters({ latitude: 0, longitude: 0 }, [])).toBe(Infinity);
});
test('[B1-NAV-12] repeated route points do not divide by zero or mutate coordinates', () => {
  const coordinates = Object.freeze([Object.freeze([0, 0]), Object.freeze([0, 0])]);
  expect(distanceToRouteMeters({ latitude: 0, longitude: 0 }, coordinates)).toBe(0);
  expect(distanceToRouteMeters({ latitude: 0.001, longitude: 0 }, coordinates)).toBeCloseTo(111.19508, 5);
  expect(coordinates).toEqual([[0, 0], [0, 0]]);
});
test('[B1-NAV-13] distance projection clamps to a segment endpoint', () => {
  expect(distanceToRouteMeters({ latitude: 0.002, longitude: 0 }, [[0, 0], [0, 0.001]])).toBeCloseTo(111.19508, 5);
});
const origin = Object.freeze({ latitude: 0, longitude: 0, recordedAt: '2026-01-01T00:00:00Z' });
test('[B1-NAV-14] first GPS fix is recorded', () => expect(shouldRecordSample(null, origin)).toBe(true));
test.each([
  ['B1-NAV-15', 9999, 100, false], ['B1-NAV-16', 10000, 30, true],
  ['B1-NAV-17', 10000, 29.999, false], ['B1-NAV-18', 10000, 30.001, true],
  ['B1-NAV-19', 59999, 0, false], ['B1-NAV-20', 60000, 0, true],
  ['B1-NAV-21', -1, 100, false],
])('[%s] sample after %i ms and movement %f m respects inclusive thresholds', (_id, elapsed, meters, accepted) => {
  const sample = Object.freeze({ latitude: meters / 6371008.8 * 180 / Math.PI, longitude: 0,
    recordedAt: new Date(Date.parse(origin.recordedAt) + elapsed).toISOString() });
  expect(distanceMeters(origin, sample)).toBeCloseTo(meters, 8);
  expect(shouldRecordSample(origin, sample)).toBe(accepted);
  expect(origin.recordedAt).toBe('2026-01-01T00:00:00Z');
});
