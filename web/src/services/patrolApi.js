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
