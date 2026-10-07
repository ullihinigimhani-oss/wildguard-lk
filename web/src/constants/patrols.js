import { routeError, routePayload } from "../components/patrol/routePlanning";
export const patrolTypes = [
  ["ROUTINE", "Routine patrol"],
  ["ANTI_POACHING", "Anti-poaching operation"],
  ["WILDLIFE_MONITORING", "Wildlife monitoring"],
  ["CONFLICT_RESPONSE", "Human-wildlife conflict response"],
  ["SPECIAL", "Special assignment"],
];
export const patrolPriorities = [
  ["LOW", "Low"],
  ["MEDIUM", "Medium"],
  ["HIGH", "High"],
];
export const patrolStatuses = [
  ["SCHEDULED", "Scheduled"],
  ["IN_PROGRESS", "In progress"],
  ["COMPLETED", "Completed"],
  ["CANCELLED", "Cancelled"],
];
const label = (choices) => (value) =>
  (choices.find(([choice]) => choice === value) || [value, value])[1];
export const patrolStatusLabel = label(patrolStatuses);
export const patrolTypeLabel = label(patrolTypes);
export const patrolPriorityLabel = label(patrolPriorities);
export const statusBadge = (value) =>
  "badge badge-" + String(value).toLowerCase().replace("_", "-");
export const priorityBadge = (value) =>
  "badge badge-" + String(value).toLowerCase();
export const initialPatrol = {
  plannedRoute: [],
  patrol_title: "",
  park_ranger_area: "",
  assigned_ranger: "",
  patrol_date: "",
  start_time: "",
  expected_end_time: "",
  patrol_type: "ROUTINE",
  priority: "MEDIUM",
  start_location: "",
  latitude: "",
  longitude: "",
  instructions_notes: "",
};
const HHMM = /^([0-9]{2}):([0-9]{2})$/;
function timeMinutes(value) {
  const match = HHMM.exec(value || "");
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}
function coordinate(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}
export function validatePatrol(values) {
  const errors = {};
  const title = String(values.patrol_title || "").trim();
  if (title.length < 3 || title.length > 150)
    errors.patrol_title = "Enter a patrol title of 3 to 150 characters.";
  if (!values.park_ranger_area)
    errors.park_ranger_area = "Select a valid park or ranger area.";
  if (!values.assigned_ranger)
    errors.assigned_ranger = "Select the ranger leading this patrol.";
  const date = values.patrol_date;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(date + "T00:00:00.000Z")
    : null;
  if (
    !parsed ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    errors.patrol_date = "Enter a valid patrol date.";
  const start = timeMinutes(values.start_time);
  const end = timeMinutes(values.expected_end_time);
  if (start === null) errors.start_time = "Enter a valid start time.";
  if (end === null)
    errors.expected_end_time = "Enter a valid expected end time.";
  if (start !== null && end !== null && end <= start)
    errors.expected_end_time = "Expected end time must be after the start time.";
  if (!patrolTypes.some(([value]) => value === values.patrol_type))
    errors.patrol_type = "Select a valid patrol type.";
  if (!patrolPriorities.some(([value]) => value === values.priority))
    errors.priority = "Select a valid priority.";
  const location = String(values.start_location || "").trim();
  if (location && (location.length < 2 || location.length > 200))
    errors.start_location = "Enter a starting point of 2 to 200 characters.";
  const latitude = coordinate(values.latitude);
  if (
    (latitude !== null && Number.isNaN(latitude)) ||
    (latitude !== null && (latitude < -90 || latitude > 90))
  )
    errors.latitude = "Latitude must be a number between -90 and 90.";
  const longitude = coordinate(values.longitude);
  if (
    (longitude !== null && Number.isNaN(longitude)) ||
    (longitude !== null && (longitude < -180 || longitude > 180))
  )
    errors.longitude = "Longitude must be a number between -180 and 180.";
  const notes = String(values.instructions_notes || "");
  if (notes.length > 2000)
    errors.instructions_notes = "Use up to 2000 characters for instructions.";
  const routeValidation = routeError(values.plannedRoute);
  if (routeValidation) errors.plannedRoute = routeValidation;
  return errors;
}
export function patrolPayload(values) {
  const location = String(values.start_location || "").trim();
  const notes = String(values.instructions_notes || "").trim();
  return {
    plannedRoute: routePayload(values.plannedRoute),
    patrol_title: String(values.patrol_title || "").trim(),
    park_ranger_area: values.park_ranger_area,
    assigned_ranger: values.assigned_ranger,
    patrol_date: values.patrol_date,
    start_time: values.start_time,
    expected_end_time: values.expected_end_time,
    patrol_type: values.patrol_type,
    priority: values.priority,
    ...(location && { start_location: location }),
    ...(notes && { instructions_notes: notes }),
    ...(values.latitude !== "" && { latitude: Number(values.latitude) }),
    ...(values.longitude !== "" && { longitude: Number(values.longitude) }),
  };
}
