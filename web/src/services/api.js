import axios from "axios";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  timeout: 20000,
});
export async function getHealth(signal) {
  const { data } = await api.get("/health", { signal });
  return data;
}
