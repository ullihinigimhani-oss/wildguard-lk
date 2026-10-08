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

export async function getUnreadAlertsCount(signal) {
  const { data } = await api.get("/alerts/unread-count", { signal });
  if (!data.success) throw new Error(data.message || "Could not load unread count.");
  return data.unreadCount;
}

export async function markAlertAsRead(id, signal) {
  const { data } = await api.post(`/alerts/${id}/read`, {}, { signal });
  if (!data.success) throw new Error(data.message || "Could not mark alert as read.");
  return data;
}

export async function markAllAlertsAsRead(signal) {
  const { data } = await api.post("/alerts/read-all", {}, { signal });
  if (!data.success) throw new Error(data.message || "Could not mark all alerts as read.");
  return data;
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

export async function getAlertsRequiringAttention(params = {}, signal) {
  const { data } = await api.get("/alerts/attention", { params, signal });
  if (!data.success) throw new Error(data.message || "Could not load alerts requiring attention.");
  return data;
}

export async function respondToAlert(id, payload = {}, signal) {
  const { data } = await api.post(`/alerts/${id}/respond`, payload, { signal });
  if (!data.success) throw new Error(data.message || "Could not record operational response.");
  return data;
}

export async function forwardAlert(id, payload = {}, signal) {
  const { data } = await api.post(`/alerts/${id}/forward`, payload, { signal });
  if (!data.success) throw new Error(data.message || "Could not forward alert.");
  return data;
}

