import { api } from "./api";
export async function listMyPatrols(signal) {
  const { data } = await api.get("/patrols/mine", { signal });
  if (!data.success || !Array.isArray(data.patrols))
    throw new Error("Patrols could not be loaded.");
  return data.patrols;
}
export async function getMyPatrol(id, signal) {
  const { data } = await api.get(`/patrols/mine/${encodeURIComponent(id)}`, {
    signal,
  });
  if (!data.success || !data.patrol?.id)
    throw new Error("Patrol could not be loaded.");
  return data.patrol;
}
async function transition(id, action) {
  const { data } = await api.post(
    `/patrols/mine/${encodeURIComponent(id)}/${action}`,
  );
  if (!data.success || !data.patrol?.id)
    throw new Error("Patrol could not be updated.");
  return data.patrol;
}
export const startMyPatrol = (id) => transition(id, "start");
export const completeMyPatrol = (id) => transition(id, "complete");
export async function requestWalkingRoute(
  patrolId,
  destinationWaypointId,
  currentLocation,
  signal,
) {
  const { data } = await api.post(
    "/navigation/route",
    {
      patrolId,
      destinationWaypointId,
      currentLocation: {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      },
    },
    { signal },
  );
  if (!data.success || !data.route) throw new Error("Route unavailable.");
  return data.route;
}
export async function getPatrolRiskZones(id, signal) {
  const { data } = await api.get(
    `/navigation/patrols/${encodeURIComponent(id)}/risk-zones`,
    { signal },
  );
  if (!data.success || !Array.isArray(data.riskZones))
    throw new Error("Risk-zone information unavailable.");
  return data.riskZones;
}
export async function getFullPatrolRoute(id, signal) {
  const { data } = await api.get(
    `/navigation/patrols/${encodeURIComponent(id)}/route`,
    { signal },
  );
  if (!data.success || !data.route?.geometry || !Array.isArray(data.route.legs))
    throw new Error("Full patrol route unavailable.");
  return data.route;
}
export async function getPatrolLocations(id, signal) {
  const { data } = await api.get(
    `/patrols/mine/${encodeURIComponent(id)}/locations`,
    { signal },
  );
  if (!data.success || !Array.isArray(data.locations))
    throw new Error("Trail unavailable.");
  return data.locations;
}
export async function recordPatrolLocation(id, location, signal) {
  const { data } = await api.post(
    `/patrols/mine/${encodeURIComponent(id)}/locations`,
    location,
    { signal },
  );
  if (!data.success) throw new Error("Recording unavailable.");
  return data;
}
