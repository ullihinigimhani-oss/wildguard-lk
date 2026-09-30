import { api } from "./api";
export async function registerAccount({ name, email, phone, password }) {
  if (!process.env.EXPO_PUBLIC_API_BASE_URL) throw new Error("Public API URL is not configured");
  const { data } = await api.post("/auth/register", { name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() || undefined, password });
  if (!data.success || !data.user?.id) throw new Error("Registration was not confirmed");
  return data;
}
