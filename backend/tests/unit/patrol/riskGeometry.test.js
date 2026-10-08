const {
  zonePolygon,
  pointInGeometry,
  routeIntersectsZones,
  validRing,
  combineZones,
  withinLimits,
} = require("../../../../shared/riskGeometry");
const { distanceMeters } = require("../../../../shared/patrolNavigation");
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
