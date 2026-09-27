import axios from "axios";
// The public API URL is the only client environment setting. Never use database credentials.
const baseURL = process.env.EXPO_PUBLIC_API_BASE_URL;
export const api = axios.create({ baseURL, timeout: 20000 });
export async function getHealth(signal) {
  if (!baseURL) throw new Error("Public API URL is not configured");
  const { data } = await api.get("/health", { signal });
  return data;
}
