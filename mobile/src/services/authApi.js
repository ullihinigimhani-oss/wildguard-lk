import { api } from "./api";
import { authenticatedDestination } from "../constants/roles";
export async function loginAccount({ email, password }) {
  if (!process.env.EXPO_PUBLIC_API_BASE_URL) throw new Error("Public API URL is not configured");
  const { data } = await api.post("/auth/login", { email: email.trim().toLowerCase(), password });
  if (!data.success || !data.user?.id || typeof data.token !== "string" || !data.token || !Number.isFinite(data.expiresAt)) throw new Error("Login was not confirmed");
  return data;
}
export async function getSessionUser(token) {
  const { data } = await api.get("/auth/me", { headers: { Authorization: `Bearer ${token}` } });
  if (!data.success || !authenticatedDestination(data.user)) throw new Error("Account role is not supported.");
  return data.user;
}
export async function registerAccount({ name, email, phone, password }) {
  if (!process.env.EXPO_PUBLIC_API_BASE_URL) throw new Error("Public API URL is not configured");
  const { data } = await api.post("/auth/register", { name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() || undefined, password });
  if (!data.success || !data.user?.id) throw new Error("Registration was not confirmed");
  return data;
}
