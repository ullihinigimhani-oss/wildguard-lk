import { api } from "./api";
export async function registerAccount({ name, email, phone, password }) {

  const { data } = await api.post("/auth/register", { name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() || undefined, password });
  if (!data.success || !data.user?.id) throw new Error("Registration was not confirmed");
  return data;
}
