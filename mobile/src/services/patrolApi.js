import { api } from "./api";
export async function listMyPatrols(signal) {
  const { data } = await api.get("/patrols/mine", { signal });
  if (!data.success || !Array.isArray(data.patrols)) throw new Error("Patrols could not be loaded.");
  return data.patrols;
}
