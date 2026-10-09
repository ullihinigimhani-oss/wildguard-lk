import { api } from "./api";
export async function listParks() {
  const { data } = await api.get("/parks");
  if (!data.success || !Array.isArray(data.parks))
    throw new Error("Park list unavailable");
  return data.parks;
}
