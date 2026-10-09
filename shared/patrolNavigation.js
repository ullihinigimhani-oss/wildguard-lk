// Shared field thresholds; meters and milliseconds unless named otherwise.
const NAVIGATION = Object.freeze({
  arrivalMeters: 40,
  arrivalAccuracyMeters: 30,
  maximumAccuracyMeters: 100,
  watchDistanceMeters: 10,
  watchIntervalMs: 5000,
  fixMaxAgeMs: 30000,
  offRouteMeters: 70,
  offRouteFixes: 3,
  rerouteCooldownMs: 20000,
  refreshMovementMeters: 100,
  refreshIntervalMs: 90000,
  trailDistanceMeters: 30,
  trailIntervalMs: 60000,
  trailMinIntervalMs: 10000,
  sampleMaxAgeMs: 120000,
  futureToleranceMs: 10000,
});
const DESTINATION_TYPES = ["START", "CHECKPOINT", "OBSERVATION", "END"];
function validCoordinate(point) {
  return (
    point &&
    typeof point.latitude === "number" &&
    Number.isFinite(point.latitude) &&
    Math.abs(point.latitude) <= 90 &&
    typeof point.longitude === "number" &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.longitude) <= 180
  );
}
function distanceMeters(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const x =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return (
    6371008.8 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)))
  );
}
function distanceToRouteMeters(point, coordinates) {
  if (!coordinates?.length) return Infinity;
  const scale = 111195.08,
    cos = Math.max(0.001, Math.cos((point.latitude * Math.PI) / 180));
  const projected = coordinates.map(([lng, lat]) => [
    (lng - point.longitude) * scale * cos,
    (lat - point.latitude) * scale,
  ]);
  let best = Math.hypot(...projected[0]);
  for (let i = 1; i < projected.length; i++) {
    const [ax, ay] = projected[i - 1],
      [bx, by] = projected[i];
    const dx = bx - ax,
      dy = by - ay,
      denominator = dx * dx + dy * dy;
    const t = denominator
      ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / denominator))
      : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}
function shouldRecordSample(last, sample) {
  if (!last) return true;
  const elapsed = Date.parse(sample.recordedAt) - Date.parse(last.recordedAt);
  return (
    elapsed >= NAVIGATION.trailMinIntervalMs &&
    (elapsed >= NAVIGATION.trailIntervalMs ||
      distanceMeters(last, sample) >= NAVIGATION.trailDistanceMeters)
  );
}
module.exports = {
  NAVIGATION,
  DESTINATION_TYPES,
  validCoordinate,
  distanceMeters,
  distanceToRouteMeters,
  shouldRecordSample,
};
