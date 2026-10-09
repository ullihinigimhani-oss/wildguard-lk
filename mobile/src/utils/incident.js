import { NAVIGATION, validCoordinate } from "../../../shared/patrolNavigation";

export const INCIDENT_TYPES = [
  {
    code: "POACHING_SNARE",
    title: "Poaching / Snare",
    icon: "shield-outline",
    description: "Snares, traps or signs of illegal hunting.",
  },
  {
    code: "ILLEGAL_CAMPSITE",
    title: "Illegal Campsite",
    icon: "bonfire-outline",
    description: "Unauthorised camps or human activity.",
  },
  {
    code: "WILDLIFE_CONFLICT",
    title: "Wildlife Conflict",
    icon: "warning-outline",
    description: "Conflict involving wildlife and people.",
  },
  {
    code: "ANIMAL_CARCASS",
    title: "Animal Carcass",
    icon: "paw-outline",
    description: "A deceased animal requiring investigation.",
  },
];
export const typeTitle = (code) =>
  INCIDENT_TYPES.find((type) => type.code === code)?.title ||
  code ||
  "Unclassified incident";
export const statusTitle = (incident) =>
  incident.withdrawnAt || incident.withdrawn
    ? "Withdrawn"
    : (incident.status || "Unknown").replace(/_/g, " ");
export const canChangeIncident = (incident, userId) =>
  !!incident &&
  incident.reporterId === userId &&
  incident.patrol?.ranger?.id === userId &&
  incident.patrol.status === "IN_PROGRESS" &&
  incident.status === "PENDING" &&
  !incident.withdrawnAt &&
  !incident.withdrawn;
export function incidentError(error) {
  const status = error?.response?.status;
  if (status === 400) return "Please check the highlighted report details.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403)
    return "You do not have permission to access this report or patrol.";
  if (status === 404) return "This report or patrol is no longer available.";
  if (status === 409)
    return "This report or patrol has changed. Only pending reports on an active patrol can be changed. Your entered details have been kept.";
  if (status === 503)
    return "Evidence uploads are unavailable. You can submit a text-only report.";
  return "Unable to reach the server. Check your connection and retry. Reports are not queued offline.";
}
export const readableTime = (value) => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime())
    ? date.toLocaleString("en-GB", { timeZone: "Asia/Colombo" }) +
        " (Sri Lanka)"
    : "Not recorded";
};
export function dateFields(value = new Date().toISOString()) {
  if (value === null || value === "") return { date: "", time: "" };
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return { date: "", time: "" };
  const local = new Date(date.getTime() + 330 * 60000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}
export function formFor(incident) {
  return {
    incidentType: incident?.incidentType || "",
    title: incident?.title || "",
    description: incident?.description || "",
    ...dateFields(incident ? incident.occurredAt : undefined),
    latitude: incident?.latitude == null ? "" : String(incident.latitude),
    longitude: incident?.longitude == null ? "" : String(incident.longitude),
  };
}
export const freshFix = (fix) =>
  validCoordinate(fix) &&
  Number.isFinite(fix.accuracy) &&
  fix.accuracy >= 0 &&
  fix.accuracy <= NAVIGATION.maximumAccuracyMeters &&
  Number.isFinite(fix.timestamp) &&
  Math.abs(Date.now() - fix.timestamp) <= NAVIGATION.fixMaxAgeMs;
export function validateForm(form) {
  const errors = {};
  if (!INCIDENT_TYPES.some((type) => type.code === form.incidentType))
    errors.incidentType = "Select an incident type.";
  if (form.title.trim().length < 3 || form.title.trim().length > 150)
    errors.title = "Enter a title of 3–150 characters.";
  if (
    form.description.trim().length < 3 ||
    form.description.trim().length > 5000
  )
    errors.description = "Enter a description of 3–5000 characters.";
  const occurredAt = `${form.date}T${form.time}:00+05:30`;
  const parsed = new Date(occurredAt);
  const calendar = new Date(`${form.date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(form.date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time) ||
    !Number.isFinite(calendar.getTime()) ||
    calendar.toISOString().slice(0, 10) !== form.date ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.getTime() > Date.now()
  )
    errors.occurredAt =
      "Enter a valid date and time that is not in the future.";
  for (const [key, max] of [
    ["latitude", 90],
    ["longitude", 180],
  ]) {
    if (
      !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(form[key].trim()) ||
      !Number.isFinite(Number(form[key])) ||
      Math.abs(Number(form[key])) > max
    )
      errors[key] = `Enter a coordinate between -${max} and ${max}.`;
  }
  return {
    errors,
    body: {
      incidentType: form.incidentType,
      title: form.title.trim(),
      description: form.description.trim(),
      occurredAt,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
    },
  };
}

export function incidentPatch(form, original, body) {
  const patch = {};
  for (const key of ["title", "description", "incidentType"])
    if (body[key] !== original[key]) patch[key] = body[key];
  const previousTime = dateFields(original.occurredAt);
  if (form.date !== previousTime.date || form.time !== previousTime.time)
    patch.occurredAt = body.occurredAt;
  if (
    body.latitude !== original.latitude ||
    body.longitude !== original.longitude
  ) {
    patch.latitude = body.latitude;
    patch.longitude = body.longitude;
  }
  return patch;
}
