import { api } from "./api";
export async function listUsers({ pending = false, ...params } = {}) {
  return (await api.get(pending ? "/users/pending" : "/users", { params }))
    .data;
}
export async function reviewUser(id, status, reason, parkId) {
  return (
    await api.patch("/users/" + encodeURIComponent(id) + "/approval", {
      status,
      reason,
      ...(parkId && { parkId }),
    })
  ).data;
}
