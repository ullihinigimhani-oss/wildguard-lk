import { api } from "./api";

const pathId = (id) => {
  if (typeof id !== "string" || !id.trim())
    throw new Error("Report context is missing.");
  return encodeURIComponent(id);
};
const record = (data) => {
  if (!data?.success || !data.incident?.id)
    throw new Error("The server did not confirm the incident.");
  return data.incident;
};
export async function createIncident(patrolId, body, options) {
  return record(
    (await (options ? api.post(`/patrols/${pathId(patrolId)}/incidents`, body, options) : api.post(`/patrols/${pathId(patrolId)}/incidents`, body))).data,
  );
}
export async function listPatrolIncidents(
  patrolId,
  { page = 1, includeWithdrawn = false, signal } = {},
) {
  const { data } = await api.get(`/patrols/${pathId(patrolId)}/incidents`, {
    signal,
    params: { page: String(page), includeWithdrawn: String(includeWithdrawn) },
  });
  if (
    !data?.success ||
    !Array.isArray(data.incidents) ||
    !Number.isInteger(data.total) ||
    !Number.isInteger(data.page) ||
    !Number.isInteger(data.pageSize)
  )
    throw new Error("Reports could not be loaded.");
  return data;
}
export async function getIncident(id, signal) {
  return record((await api.get(`/incidents/${pathId(id)}`, { signal })).data);
}
export async function editIncident(id, body) {
  return record((await api.patch(`/incidents/${pathId(id)}`, body)).data);
}
export async function withdrawIncident(id) {
  return record((await api.post(`/incidents/${pathId(id)}/withdraw`, {})).data);
}
