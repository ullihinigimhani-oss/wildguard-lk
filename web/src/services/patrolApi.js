import { api } from "./api";
export async function listAssignableRangers() {
  const { data } = await api.get("/patrols/rangers");
  if (!data.success || !Array.isArray(data.rangers))
    throw new Error("Ranger list unavailable");
  return data.rangers;
}
export async function createPatrol(payload) {
  return (await api.post("/patrols", payload)).data;
}
export async function listPatrols(params = {}) {
  const { data } = await api.get("/patrols", { params });
  if (!data.success || !Array.isArray(data.patrols))
    throw new Error("Patrol list unavailable");
  return data;
}
export async function getPatrol(id) {
  const { data } = await api.get("/patrols/" + encodeURIComponent(id));
  if (!data.success || !data.patrol) throw new Error("Patrol unavailable");
  return data.patrol;
}

export async function updatePatrol(id, payload) {
  return (await api.patch("/patrols/" + encodeURIComponent(id), payload)).data;
}
export async function cancelPatrol(id) {
  return (await api.post("/patrols/" + encodeURIComponent(id) + "/cancel")).data;
}
export async function listLiveRangers() {
  const { data } = await api.get("/patrols/live");
  if (!data.success || !Array.isArray(data.rangers))
    throw new Error("Live ranger locations unavailable");
  return data;
}
export async function getPatrolTrail(id) {
  const { data } = await api.get(
    "/patrols/" + encodeURIComponent(id) + "/locations",
  );
  if (!data.success || !Array.isArray(data.locations))
    throw new Error("Recorded route unavailable");
  return data.locations;
}
