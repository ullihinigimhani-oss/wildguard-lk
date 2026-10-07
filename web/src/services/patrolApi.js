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
