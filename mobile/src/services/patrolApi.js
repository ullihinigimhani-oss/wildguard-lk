import { api } from "./api";
export async function listMyPatrols(signal) {
  const { data } = await api.get("/patrols/mine", { signal });
  if (!data.success || !Array.isArray(data.patrols)) throw new Error("Patrols could not be loaded.");
  return data.patrols;
}
export async function getMyPatrol(id, signal) {
  const { data } = await api.get(`/patrols/mine/${encodeURIComponent(id)}`, { signal });
  if (!data.success || !data.patrol?.id) throw new Error("Patrol could not be loaded.");
  return data.patrol;
}
async function transition(id, action) {
  const { data } = await api.post(`/patrols/mine/${encodeURIComponent(id)}/${action}`);
  if (!data.success || !data.patrol?.id) throw new Error("Patrol could not be updated.");
  return data.patrol;
}
export const startMyPatrol = id => transition(id, "start");
export const completeMyPatrol = id => transition(id, "complete");
