import { api } from "./api";
const pathId = (id) => encodeURIComponent(id);
export const incidentTypes = {
  POACHING_SNARE: "Poaching / Snare",
  ILLEGAL_CAMPSITE: "Illegal Campsite",
  WILDLIFE_CONFLICT: "Wildlife Conflict",
  ANIMAL_CARCASS: "Animal Carcass",
};
export const incidentStatuses = {
  PENDING: "Pending",
  UNDER_REVIEW: "Under review",
  RESPONDING: "Responding",
  RESOLVED: "Resolved",
};
export async function listIncidents(filters, signal) {
  const allowed = [
    "page",
    "patrolId",
    "rangerId",
    "parkId",
    "incidentType",
    "status",
    "from",
    "to",
    "includeWithdrawn",
  ];
  const params = Object.fromEntries(
    allowed
      .filter((key) => filters[key] !== "" && filters[key] !== undefined)
      .map((key) => [key, filters[key]]),
  );
  const { data } = await api.get("/incidents", { params, signal });
  if (
    !data?.success ||
    !Array.isArray(data.incidents) ||
    !Number.isInteger(data.total) ||
    data.total < 0 ||
    !Number.isInteger(data.pageSize) ||
    data.pageSize < 1
  )
    throw new Error("Incident list unavailable.");
  return data;
}
export async function getIncident(id, signal) {
  const { data } = await api.get(`/incidents/${pathId(id)}`, { signal });
  if (!data?.success || !data.incident?.id)
    throw new Error("Incident unavailable.");
  return data.incident;
}
// Grouping needs the complete authorized result, never a single incident page.
export async function listAllIncidents(filters, signal) {
  const first = await listIncidents({ ...filters, page: 1 }, signal);
  const unique = new Map();
  const append = (items) =>
    items.forEach((item) => {
      if (!item?.id) throw new Error("Incident list unavailable.");
      unique.set(item.id, item);
    });
  append(first.incidents);
  const pages = Math.ceil(first.total / first.pageSize);
  if (pages > 100000) throw new Error("Incident list unavailable.");
  for (let page = 2; page <= pages; page++) {
    if (signal?.aborted) throw new Error("Request cancelled.");
    const next = await listIncidents({ ...filters, page }, signal);
    if (next.total !== first.total || next.pageSize !== first.pageSize) {
      throw new Error("Incident list changed. Refresh to reload all reports.");
    }
    append(next.incidents);
  }
  if (unique.size !== first.total)
    throw new Error("Incident list changed. Refresh to reload all reports.");
  return { ...first, incidents: [...unique.values()] };
}
export async function getEvidenceAccess(incidentId, evidenceId, signal) {
  const { data } = await api.get(
    `/incidents/${pathId(incidentId)}/evidence/${pathId(evidenceId)}/access`,
    { signal },
  );
  const expected = `/incidents/${pathId(incidentId)}/evidence/${pathId(evidenceId)}/media?ticket=`;
  if (
    !data?.success ||
    !data.access?.path?.startsWith(expected) ||
    !Number.isFinite(Date.parse(data.access.expiresAt)) ||
    Date.parse(data.access.expiresAt) <= Date.now()
  )
    throw new Error("Private media access unavailable.");
  return {
    uri: api.defaults.baseURL.replace(/\/$/, "") + data.access.path,
    expiresAt: data.access.expiresAt,
  };
}
export function incidentError(error) {
  const status = error?.response?.status;
  return status === 401
    ? "Your session expired. Sign in again."
    : status === 403
      ? "You do not have permission to view these incidents."
      : status === 404
        ? "This incident or evidence is no longer available."
        : status === 400
          ? "Check the selected filters and date range."
          : "Unable to load incidents or private evidence. Please retry.";
}
