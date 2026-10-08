import { api } from "./api";

export async function listAlerts(params = {}, signal) {
  const { data } = await api.get("/alerts", { params, signal });
  if (!data.success) throw new Error(data.message || "Could not load safety alerts.");
  return data;
}

export async function getAlertById(id, signal) {
  const { data } = await api.get(`/alerts/${id}`, { signal });
  if (!data.success) throw new Error(data.message || "Alert details could not be found.");
  return data.alert;
}

export async function acknowledgeAlert(id, signal) {
  const { data } = await api.post(`/alerts/${id}/acknowledge`, {}, { signal });
  if (!data.success) throw new Error(data.message || "Could not acknowledge alert.");
  return data;
}

export async function updateAlertStatus(id, status, signal) {
  const { data } = await api.patch(`/alerts/${id}/status`, { status }, { signal });
  if (!data.success) throw new Error(data.message || "Could not update alert status.");
  return data;
}
