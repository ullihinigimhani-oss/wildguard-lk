import { incidentTypes, incidentStatuses } from "../../services/incidentApi";
export const time = (value) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString()
    : "—";
const statusClass = {
  PENDING: "badge-scheduled",
  UNDER_REVIEW: "badge-medium",
  RESPONDING: "badge-in-progress",
  RESOLVED: "badge-completed",
};
export function Status({ incident }) {
  return (
    <span
      className={`badge ${incident.withdrawnAt || incident.withdrawn ? "badge-cancelled" : statusClass[incident.status] || ""}`}
    >
      {incident.withdrawnAt || incident.withdrawn
        ? "Withdrawn"
        : incidentStatuses[incident.status] || incident.status || "—"}
    </span>
  );
}
