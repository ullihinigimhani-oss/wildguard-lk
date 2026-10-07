const { validCoordinate, distanceMeters } = require("./patrolNavigation");
// Conservative application limits, below hosted-provider area/extent ceilings.
const RISK_POLICY = Object.freeze({
  vertices: 32,
  maxRadiusMeters: 5000,
  maxZones: 32,
  maxAreaMeters2: 150000000,
  maxExtentMeters: 18000,
});
const rad = (d) => (d * Math.PI) / 180,
  deg = (r) => (r * 180) / Math.PI;
function validRing(ring) {
  if (
    !Array.isArray(ring) ||
    ring.length < 4 ||
    ring.length > RISK_POLICY.vertices + 1
  )
    return false;
  if (
    !ring.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        validCoordinate({ longitude: p[0], latitude: p[1] }),
    )
  )
    return false;
  if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1])
    return false;
  const area = ring
    .slice(1)
    .reduce((sum, p, i) => sum + ring[i][0] * p[1] - p[0] * ring[i][1], 0);
  return (
    Math.abs(area) > 1e-12 &&
    ring.slice(1).every((p, i) => Math.abs(p[0] - ring[i][0]) < 180)
  );
}
function zonePolygon(zone) {
  const center = {
    latitude: zone.centerLatitude,
    longitude: zone.centerLongitude,
  };
  if (
    !validCoordinate(center) ||
    !Number.isFinite(zone.radiusMeters) ||
    zone.radiusMeters <= 0 ||
    zone.radiusMeters > RISK_POLICY.maxRadiusMeters
  )
    return null;
  // Circumscribed polygon contains the stored circle, including between vertices.
  const angular =
    (zone.radiusMeters / Math.cos(Math.PI / RISK_POLICY.vertices) + 0.1) /
    6371008.8;
  const lat = rad(center.latitude),
    lng = rad(center.longitude),
    ring = [];
  for (let i = 0; i < RISK_POLICY.vertices; i++) {
    const bearing = (-2 * Math.PI * i) / RISK_POLICY.vertices;
    const y = Math.asin(
      Math.sin(lat) * Math.cos(angular) +
        Math.cos(lat) * Math.sin(angular) * Math.cos(bearing),
    );
    const x =
      lng +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat),
        Math.cos(angular) - Math.sin(lat) * Math.sin(y),
      );
    ring.push([((deg(x) + 540) % 360) - 180, deg(y)]);
  }
  ring.push([...ring[0]]);
  if (!validRing(ring)) return null;
  return { type: "Polygon", coordinates: [ring] };
}
function cross(a, b, p) {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}
function onSegment(a, b, p) {
  return (
    Math.abs(cross(a, b, p)) <= 1e-12 &&
    p[0] >= Math.min(a[0], b[0]) - 1e-10 &&
    p[0] <= Math.max(a[0], b[0]) + 1e-10 &&
    p[1] >= Math.min(a[1], b[1]) - 1e-10 &&
    p[1] <= Math.max(a[1], b[1]) + 1e-10
  );
}
function pointInGeometry(point, geometry) {
  if (
    !validCoordinate(point) ||
    geometry?.type !== "Polygon" ||
    !validRing(geometry.coordinates?.[0])
  )
    return false;
  return pointInRing(
    [point.longitude, point.latitude],
    geometry.coordinates[0],
  );
}
function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
    const a = ring[j],
      b = ring[i];
    if (onSegment(a, b, p)) return true;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
function segmentsIntersect(a, b, c, d) {
  const x = cross(a, b, c),
    y = cross(a, b, d),
    z = cross(c, d, a),
    w = cross(c, d, b);
  if (
    ((x > 0 && y < 0) || (x < 0 && y > 0)) &&
    ((z > 0 && w < 0) || (z < 0 && w > 0))
  )
    return true;
  return (
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b)
  );
}
function routeIntersectsZones(geometry, zones) {
  if (geometry?.type !== "LineString" || !Array.isArray(geometry.coordinates))
    return true;
  const route = geometry.coordinates;
  return zones.some((zone) => {
    const polygon = zone.geometry,
      ring = polygon.coordinates[0];
    if (!validRing(ring)) return true;
    const minX = Math.min(...ring.map((p) => p[0])),
      maxX = Math.max(...ring.map((p) => p[0])),
      minY = Math.min(...ring.map((p) => p[1])),
      maxY = Math.max(...ring.map((p) => p[1]));
    for (let i = 0; i < route.length; i++) {
      if (
        route[i][0] >= minX &&
        route[i][0] <= maxX &&
        route[i][1] >= minY &&
        route[i][1] <= maxY &&
        pointInRing(route[i], ring)
      )
        return true;
      if (
        i &&
        Math.max(route[i - 1][0], route[i][0]) >= minX &&
        Math.min(route[i - 1][0], route[i][0]) <= maxX &&
        Math.max(route[i - 1][1], route[i][1]) >= minY &&
        Math.min(route[i - 1][1], route[i][1]) <= maxY
      )
        for (let j = 1; j < ring.length; j++)
          if (segmentsIntersect(route[i - 1], route[i], ring[j - 1], ring[j]))
            return true;
    }
    return false;
  });
}
function combineZones(zones) {
  return zones.length === 1
    ? zones[0].geometry
    : {
        type: "MultiPolygon",
        coordinates: zones.map((zone) => zone.geometry.coordinates),
      };
}
function withinLimits(zones) {
  if (zones.length > RISK_POLICY.maxZones) return false;
  const positions = zones.flatMap((zone) => zone.geometry.coordinates[0]);
  if (!positions.length) return true;
  const minLat = Math.min(...positions.map((p) => p[1])),
    maxLat = Math.max(...positions.map((p) => p[1])),
    minLng = Math.min(...positions.map((p) => p[0])),
    maxLng = Math.max(...positions.map((p) => p[0]));
  return (
    zones.reduce(
      (sum, zone) =>
        sum +
        Math.PI *
          (zone.radiusMeters / Math.cos(Math.PI / RISK_POLICY.vertices) +
            0.1) **
            2,
      0,
    ) <= RISK_POLICY.maxAreaMeters2 &&
    distanceMeters(
      { latitude: minLat, longitude: minLng },
      { latitude: maxLat, longitude: maxLng },
    ) <= RISK_POLICY.maxExtentMeters
  );
}
module.exports = {
  RISK_POLICY,
  validRing,
  zonePolygon,
  pointInGeometry,
  routeIntersectsZones,
  combineZones,
  withinLimits,
};
