import { api } from "./api";
export async function loginAccount({ email, password }) {
  const { data } = await api.post("/auth/login", {
    email: email.trim().toLowerCase(),
    password,
  });
  if (!data.success || !data.user?.id || !data.token)
    throw new Error("Login was not confirmed");
  return data;
}
export async function registerAccount({
  name,
  email,
  phone,
  password,
  role = "COMMUNITY_USER",
}) {
  const { data } = await api.post("/auth/register", {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim() || undefined,
    password,
    role,
  });
  if (!data.success || !data.user?.id)
    throw new Error("Registration was not confirmed");
  return data;
}
