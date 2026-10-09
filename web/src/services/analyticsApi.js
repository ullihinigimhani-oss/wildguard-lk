import { api } from "./api";

export const periods = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
};

const flat = (map) =>
  Object.fromEntries(
    Object.entries(map).map(([key, value]) => [
      key,
      typeof value === "boolean" ? value : String(value),
    ]),
  );

export const incidentTypes = flat({
  POACHING_SNARE: "Poaching / Snare",
  ILLEGAL_CAMPSITE: "Illegal Campsite",
  WILDLIFE_CONFLICT: "Wildlife Conflict",
  ANIMAL_CARCASS: "Animal Carcass",
});

export const incidentStatuses = flat({
  PENDING: "Pending",
  UNDER_REVIEW: "Under review",
  RESPONDING: "Responding",
  RESOLVED: "Resolved",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
});

export const patrolTypes = flat({
  ROUTINE: "Routine",
  ANTI_POACHING: "Anti-poaching",
  WILDLIFE_MONITORING: "Wildlife monitoring",
  CONFLICT_RESPONSE: "Conflict response",
  SPECIAL: "Special",
});

export const patrolStatuses = flat({
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
});

export const patrolPriorities = flat({
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
});

export const reportTypes = flat({
  WILDLIFE_SIGHTING: "Wildlife Sighting",
  HUMAN_WILDLIFE_CONFLICT: "Human-Wildlife Conflict",
  SUSPICIOUS_ACTIVITY: "Suspicious Activity",
});

export const reportStatuses = flat({
  PENDING: "Pending",
  UNDER_REVIEW: "Under review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
});

function params(filters, allowed) {
  return Object.fromEntries(
    allowed
      .filter((key) => {
        const value = filters[key];
        return value !== "" && value !== undefined && value !== null;
      })
      .map((key) => [key, filters[key]]),
  );
}

async function analyticsEnvelope(promise, label) {
  const { data } = await promise;
  if (!data?.success || !data.data || typeof data.data !== "object")
    throw new Error(`${label} unavailable.`);
  return data.data;
}

export function kpis(filters, signal) {
  return analyticsEnvelope(
    api.get("/analytics/kpis", {
      params: params(filters, ["from", "to", "area"]),
      signal,
    }),
    "Analytics metrics",
  );
}

export function incidentAnalytics(filters, signal) {
  return analyticsEnvelope(
    api.get("/analytics/incidents", {
      params: params(filters, [
        "from",
        "to",
        "period",
        "area",
        "type",
        "status",
      ]),
      signal,
    }),
    "Incident analytics",
  );
}

export function patrolAnalytics(filters, signal) {
  return analyticsEnvelope(
    api.get("/analytics/patrols", {
      params: params(filters, [
        "from",
        "to",
        "period",
        "area",
        "type",
        "status",
        "priority",
      ]),
      signal,
    }),
    "Patrol analytics",
  );
}

export function communityAnalytics(filters, signal) {
  return analyticsEnvelope(
    api.get("/analytics/community-reports", {
      params: params(filters, [
        "from",
        "to",
        "period",
        "area",
        "type",
        "status",
      ]),
      signal,
    }),
    "Community report analytics",
  );
}

export function analyticsError(error) {
  const first = error?.response?.data?.errors;
  const value =
    first && typeof first === "object" ? Object.values(first)[0] : "";
  if (typeof value === "string" && value.trim()) return value;
  const message = error?.response?.data?.message;
  if (typeof message === "string" && message.trim()) return message;
  const status = error?.response?.status;
  return status === 401
    ? "Your session expired. Sign in again."
    : status === 403
      ? "You do not have permission to view analytics."
      : status === 400
        ? "Check the selected analytics filters."
        : "Unable to load analytics. Please retry.";
}