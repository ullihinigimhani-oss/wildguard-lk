const {
  zonePolygon,
  pointInGeometry,
  routeIntersectsZones,
  validRing,
  combineZones,
  withinLimits,
} = require("../../../../shared/riskGeometry");
const { distanceMeters } = require("../../../../shared/patrolNavigation");

test('[B1-GEO-01] maximum radius is valid but an additional millimeter is not', () => {
  const input = Object.freeze({ centerLatitude: 7.5, centerLongitude: 80.7, radiusMeters: 5000 });
  expect(zonePolygon(input).type).toBe('Polygon');
  expect(zonePolygon({ ...input, radiusMeters: 5000.001 })).toBeNull();
  expect(input.radiusMeters).toBe(5000);
});
test('[B1-GEO-02] exactly 32 zones fit while 33 zones exceed policy', () => {
  const { RISK_POLICY } = require('../../../../shared/riskGeometry');
  const tiny = { radiusMeters: 1, geometry: zonePolygon({ centerLatitude: 7.5, centerLongitude: 80.7, radiusMeters: 1 }) };
  expect(withinLimits(Array(32).fill(tiny))).toBe(true);
  expect(withinLimits(Array(RISK_POLICY.maxZones + 1).fill(tiny))).toBe(false);
});
test.each([['B1-GEO-03', 18000, true], ['B1-GEO-04', 18000.001, false]])(
  '[%s] computed extent %f m respects the inclusive policy boundary', (_id, extent, allowed) => {
    // Isolate the comparison from floating point coordinate construction. Real distance math
    // has its own navigation tests; real geometry is retained here.
    let isolated;
    jest.isolateModules(() => {
      jest.doMock('../../../../shared/patrolNavigation', () => ({
        ...jest.requireActual('../../../../shared/patrolNavigation'), distanceMeters: () => extent,
      }));
      isolated = require('../../../../shared/riskGeometry');
    });
    try { expect(isolated.withinLimits([{ radiusMeters: 100, geometry: zonePolygon({ centerLatitude: 7.5, centerLongitude: 80.7, radiusMeters: 100 }) }])).toBe(allowed); }
    finally { jest.dontMock('../../../../shared/patrolNavigation'); }
  });
test('[B1-GEO-05] combined area accepts its calculated boundary and rejects additional radius', () => {
  const { RISK_POLICY } = require('../../../../shared/riskGeometry');
  const radius = (Math.sqrt(RISK_POLICY.maxAreaMeters2 / (2 * Math.PI)) - 0.1) * Math.cos(Math.PI / RISK_POLICY.vertices);
  const make = value => ({ radiusMeters: value, geometry: zonePolygon({ centerLatitude: 7.5, centerLongitude: 80.7, radiusMeters: value }) });
  const area = 2 * Math.PI * (radius / Math.cos(Math.PI / RISK_POLICY.vertices) + 0.1) ** 2;
  expect(area).toBeCloseTo(RISK_POLICY.maxAreaMeters2, 5);
  expect(withinLimits([make(radius), make(radius)])).toBe(true);
  expect(withinLimits([make(radius + 0.001), make(radius + 0.001)])).toBe(false);
});
test('[B1-GEO-06] a route touching a boundary vertex intersects without changing either input', () => {
  const geometry = zonePolygon({ centerLatitude: 7.5, centerLongitude: 80.7, radiusMeters: 100 });
  const vertex = geometry.coordinates[0][0];
  const route = { type: 'LineString', coordinates: [[vertex[0], vertex[1] + 0.001], [...vertex]] };
  const before = JSON.stringify({ geometry, route });
  expect(routeIntersectsZones(route, [{ radiusMeters: 100, geometry }])).toBe(true);
  expect(JSON.stringify({ geometry, route })).toBe(before);
});
const zone = (latitude = 7.5, longitude = 80.7, radius = 100) => ({
  radiusMeters: radius,
  geometry: zonePolygon({
    centerLatitude: latitude,
    centerLongitude: longitude,
    radiusMeters: radius,
  }),
});
test.each([7.5, 49, 70])(
  "geodesic radius is metres at latitude %s and circle is enclosed",
  (latitude) => {
    const z = zone(latitude);
    expect(validRing(z.geometry.coordinates[0])).toBe(true);
    expect(z.geometry.coordinates[0]).toHaveLength(33);
    for (const p of z.geometry.coordinates[0])
      expect(
        distanceMeters(
          { latitude, longitude: 80.7 },
          { longitude: p[0], latitude: p[1] },
        ),
      ).toBeCloseTo(100 / Math.cos(Math.PI / 32) + 0.1, 2);
    expect(pointInGeometry({ latitude, longitude: 80.7 }, z.geometry)).toBe(
      true,
    );
  },
);
test.each([0, -1, NaN, Infinity, 6000])(
  "invalid radius %s fails closed",
  (radius) => expect(zone(7.5, 80.7, radius).geometry).toBeNull(),
);
test("invalid coordinates, poles/dateline and unclosed rings rejected", () => {
  expect(zone(91).geometry).toBeNull();
  expect(zone(0, 180).geometry).toBeNull();
  expect(
    validRing([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]),
  ).toBe(false);
  expect(
    validRing([
      [0, 0],
      [Infinity, 0],
      [0, 1],
      [0, 0],
    ]),
  ).toBe(false);
});
test("boundary and interior included, exterior excluded", () => {
  const z = zone();
  expect(pointInGeometry({ latitude: 7.5, longitude: 80.7 }, z.geometry)).toBe(
    true,
  );
  const edge = z.geometry.coordinates[0][0];
  expect(
    pointInGeometry({ latitude: edge[1], longitude: edge[0] }, z.geometry),
  ).toBe(true);
  expect(
    pointInGeometry({ latitude: 7.502, longitude: 80.7 }, z.geometry),
  ).toBe(false);
});
test("segment crossing detected even when no route vertex lies inside zone", () => {
  const z = zone();
  expect(
    routeIntersectsZones(
      {
        type: "LineString",
        coordinates: [
          [80.698, 7.5],
          [80.702, 7.5],
        ],
      },
      [z],
    ),
  ).toBe(true);
  expect(
    routeIntersectsZones(
      {
        type: "LineString",
        coordinates: [
          [80.698, 7.502],
          [80.702, 7.502],
        ],
      },
      [z],
    ),
  ).toBe(false);
});
test("single Polygon and combined MultiPolygon are correctly nested", () => {
  const a = zone(),
    b = zone(7.51);
  expect(combineZones([a])).toEqual(a.geometry);
  expect(combineZones([a, b])).toEqual({
    type: "MultiPolygon",
    coordinates: [a.geometry.coordinates, b.geometry.coordinates],
  });
});
test("area/count/extent limits reject excessive data without truncating avoidance", () => {
  expect(withinLimits([zone()])).toBe(true);
  expect(withinLimits(Array.from({ length: 33 }, () => zone()))).toBe(false);
  expect(withinLimits([zone(), zone(8.5)])).toBe(false);
  expect(withinLimits([zone(7.5, 80.7, 5000), zone(7.5, 80.7, 5000)])).toBe(
    false,
  );
});
