const PATROL_TYPES = [
  "ROUTINE",
  "ANTI_POACHING",
  "WILDLIFE_MONITORING",
  "CONFLICT_RESPONSE",
  "SPECIAL",
];
const { scheduleInstant } = require("../../../shared/patrolLifecycle");
const PATROL_PRIORITIES = ["LOW", "MEDIUM", "HIGH"];
const text = (value) => (typeof value === "string" ? value.trim() : "");
const fail = (fields) =>
  Object.assign(new Error("Please check your patrol details."), {
    status: 400,
    validationError: true,
    fields,
  });
const HHMM = /^([0-9]{2}):([0-9]{2})$/;
function minutes(value) {
  const match = HHMM.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}
function calendarDate(value) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00.000Z");
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    return null;
  return date;
}
function coordinate(value) {
  if (value === undefined || value === null || value === "") return null;
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  return Number.isFinite(number) ? number : NaN;
}
function validatePatrolCreation(body) {
  const input =
    body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const fields = {};
  const routeName = text(input.patrol_title);
  const parkId = text(input.park_ranger_area);
  const rangerId = text(input.assigned_ranger);
  const dateText = text(input.patrol_date);
  const startText = text(input.start_time);
  const endText = text(input.expected_end_time);
  if (routeName.length < 3 || routeName.length > 150)
    fields.patrol_title = "Enter a patrol title of 3 to 150 characters.";
  if (!parkId || parkId.length > 128)
    fields.park_ranger_area = "Select a valid park or ranger area.";
  if (!rangerId || rangerId.length > 128)
    fields.assigned_ranger = "Select the ranger leading this patrol.";
  const scheduledDate = calendarDate(dateText);
  if (!scheduledDate)
    fields.patrol_date = "Enter a valid patrol date as YYYY-MM-DD.";
  const startMinutes = minutes(startText);
  const endMinutes = minutes(endText);
  if (startMinutes === null)
    fields.start_time = "Enter a valid start time as HH:MM.";
  if (endMinutes === null)
    fields.expected_end_time = "Enter a valid expected end time as HH:MM.";
  if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes)
    fields.expected_end_time = "Expected end time must be after the start time.";
  if (
    input.instructions_notes !== undefined &&
    input.instructions_notes !== null &&
    input.instructions_notes !== "" &&
    typeof input.instructions_notes !== "string"
  )
    fields.instructions_notes = "Enter patrol instructions as text.";
  else if (text(input.instructions_notes).length > 2000)
    fields.instructions_notes = "Use up to 2000 characters for instructions.";
  const patrolType =
    input.patrol_type === undefined ||
    input.patrol_type === null ||
    input.patrol_type === ""
      ? "ROUTINE"
      : input.patrol_type;
  if (!PATROL_TYPES.includes(patrolType))
    fields.patrol_type = "Select a valid patrol type.";
  const priority =
    input.priority === undefined ||
    input.priority === null ||
    input.priority === ""
      ? "MEDIUM"
      : input.priority;
  if (!PATROL_PRIORITIES.includes(priority))
    fields.priority = "Select a valid priority.";
  if (
    input.start_location !== undefined &&
    input.start_location !== null &&
    input.start_location !== "" &&
    typeof input.start_location !== "string"
  )
    fields.start_location = "Enter the patrol starting point as text.";
  else if (
    text(input.start_location) &&
    (text(input.start_location).length < 2 ||
      text(input.start_location).length > 200)
  )
    fields.start_location = "Enter a starting point of 2 to 200 characters.";
  const latitude = coordinate(input.latitude);
  if (
    (Number.isNaN(latitude) && latitude !== null) ||
    (latitude !== null && (latitude < -90 || latitude > 90))
  )
    fields.latitude = "Latitude must be a number between -90 and 90.";
  const longitude = coordinate(input.longitude);
  if (
    (Number.isNaN(longitude) && longitude !== null) ||
    (longitude !== null && (longitude < -180 || longitude > 180))
  )
    fields.longitude = "Longitude must be a number between -180 and 180.";
  if (Object.keys(fields).length) throw fail(fields);
  return {
    routeName,
    parkId,
    rangerId,
    scheduledDate,
    startTime: scheduleInstant(dateText, startText),
    endTime: scheduleInstant(dateText, endText),
    description: text(input.instructions_notes) || null,
    patrolType,
    priority,
    startLocation: text(input.start_location) || null,
    latitude,
    longitude,
  };
}
module.exports = { validatePatrolCreation };
