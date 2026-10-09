import {
  DESTINATION_TYPES,
  NAVIGATION,
  distanceMeters,
  distanceToRouteMeters,
} from "../../../shared/patrolNavigation";
export const destinationsFor = (points) =>
  points.filter(
    (point) => DESTINATION_TYPES.includes(point.type) && point.waypointId,
  );
export function advanceReached(
  destinations,
  reached,
  position,
  allowed = () => true,
) {
  const next = new Set(reached);
  if (!position || position.accuracy > NAVIGATION.arrivalAccuracyMeters)
    return next;
  for (const point of destinations) {
    if (next.has(point.waypointId)) continue;
    if (!allowed(point)) break;
    if (distanceMeters(position, point) > NAVIGATION.arrivalMeters) break;
    next.add(point.waypointId);
  }
  return next;
}
export function routeNeedsRefresh(
  route,
  destination,
  position,
  previous,
  now,
  offRouteFixes,
) {
  if (!route || route.destination.waypointId !== destination.waypointId)
    return true;
  if (offRouteFixes >= NAVIGATION.offRouteFixes) return true;
  return (
    previous &&
    now - previous.time >= NAVIGATION.refreshIntervalMs &&
    distanceMeters(previous.position, position) >=
      NAVIGATION.refreshMovementMeters
  );
}
export function offRoute(position, geometry) {
  return (
    distanceToRouteMeters(position, geometry?.coordinates) >
    NAVIGATION.offRouteMeters + position.accuracy
  );
}
// Project onto the active geometry, then scale the authoritative ORS summary.
export function remainingSummary(route, position) {
  if (!route || !position) return null;
  const coordinates = route.geometry.coordinates;
  let total = 0,
    closest = Infinity,
    along = 0,
    travelled = 0;
  const rad = Math.PI / 180,
    scale = Math.cos(position.latitude * rad);
  for (let i = 1; i < coordinates.length; i++) {
    const a = {
        longitude: coordinates[i - 1][0],
        latitude: coordinates[i - 1][1],
      },
      b = { longitude: coordinates[i][0], latitude: coordinates[i][1] };
    const ax = (a.longitude - position.longitude) * scale,
      ay = a.latitude - position.latitude,
      bx = (b.longitude - position.longitude) * scale,
      by = b.latitude - position.latitude;
    const dx = bx - ax,
      dy = by - ay,
      den = dx * dx + dy * dy,
      t = den ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / den)) : 0;
    const distance = (ax + t * dx) ** 2 + (ay + t * dy) ** 2,
      length = distanceMeters(a, b);
    if (distance < closest) {
      closest = distance;
      along = travelled + t * length;
    }
    travelled += length;
    total += length;
  }
  const fraction = total ? Math.max(0, 1 - along / total) : 1;
  return {
    distanceMeters: route.distanceMeters * fraction,
    durationSeconds: route.durationSeconds * fraction,
  };
}
