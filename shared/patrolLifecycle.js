// Patrol schedules use date-only UTC midnight + absolute timestamps. Field
// operations always use Sri Lanka's calendar, regardless of device/server zone.
const PATROL_TIME_ZONE = "Asia/Colombo";
const DAY = 86400000;
const localFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: PATROL_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
const instant = value => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};
function localParts(value) {
  return Object.fromEntries(localFormatter.formatToParts(new Date(value)).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
}
function localDateKey(value = new Date()) {
  const parts = localParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function scheduleDateKey(patrol) {
  const date = instant(patrol.scheduledDate);
  return date !== null ? new Date(date).toISOString().slice(0, 10)
    : instant(patrol.startTime) !== null ? localDateKey(patrol.startTime) : null;
}
function scheduleInstant(date, time) {
  // Resolve an IANA-zone wall clock, without relying on the host timezone or
  // embedding a numeric offset. Callers validate YYYY-MM-DD and HH:MM first.
  const wallTime = Date.parse(`${date}T${time}:00.000Z`);
  let timestamp = wallTime;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const p = localParts(timestamp);
    const displayed = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.000Z`);
    const difference = wallTime - displayed;
    timestamp += difference;
    if (!difference) break;
  }
  return new Date(timestamp);
}
function expectedEnd(patrol) {
  const end = instant(patrol.endTime);
  if (end !== null) return end;
  // Older date-only assignments remain actionable after their scheduled day.
  const day = scheduleDateKey(patrol);
  if (!day) return null;
  const next = new Date(Date.parse(`${day}T00:00:00Z`) + DAY).toISOString().slice(0, 10);
  return scheduleInstant(next, "00:00").getTime();
}
function delayDuration(milliseconds) {
  const minutes = Math.floor(milliseconds / 60000);
  if (minutes < 1) return "less than 1 minute";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainder = minutes % 60;
  if (!days && !hours) return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  return [days ? `${days} ${days === 1 ? "day" : "days"}` : "", hours ? `${hours}h` : "", remainder ? `${remainder}m` : ""].filter(Boolean).join(" ");
}
function classifyPatrol(patrol, now = new Date()) {
  const deadline = expectedEnd(patrol);
  const date = scheduleDateKey(patrol);
  const completed = patrol.status === "COMPLETED";
  const active = patrol.status === "IN_PROGRESS";
  const scheduled = patrol.status === "SCHEDULED";
  const todayKey = localDateKey(now);
  const overdue = (active || scheduled) && deadline !== null && instant(now) > deadline;
  const today = scheduled && !overdue && date === todayKey;
  const upcoming = scheduled && !overdue && date !== null && date > todayKey;
  // A legacy completion without an actual timestamp must not be called on time.
  const actualEnd = instant(patrol.actualEndTime);
  const lateness = completed && actualEnd !== null && instant(patrol.endTime) !== null ? Math.max(0, actualEnd - deadline) : null;
  const completedLate = lateness !== null && lateness > 0;
  const label = completed ? "COMPLETED" : active ? "IN PROGRESS" : overdue ? "OVERDUE" : today ? "TODAY" : upcoming ? "UPCOMING" : patrol.status.replace(/_/g, " ");
  const badges = [label, ...(active && overdue ? ["OVERDUE"] : []), ...(completedLate ? ["COMPLETED LATE"] : [])];
  const action = completed ? "View Summary" : active ? "Continue Patrol" : today || overdue ? "Start Patrol" : "View Details";
  return { today, upcoming, overdue, completed, completedLate, active, deadline, lateness, badges, action,
    completionText: lateness === null ? null : completedLate ? `Completed ${delayDuration(lateness)} after expected end` : "Completed on time" };
}
const patrolFilters = { ALL: "All", TODAY: "Today", UPCOMING: "Upcoming", IN_PROGRESS: "In Progress", OVERDUE: "Overdue", COMPLETED: "Completed" };
function matchesFilter(patrol, filter, now) {
  const state = classifyPatrol(patrol, now);
  return filter === "ALL" || ({ TODAY: state.today, UPCOMING: state.upcoming, IN_PROGRESS: state.active, OVERDUE: state.overdue, COMPLETED: state.completed })[filter] === true;
}
function dashboardPatrols(patrols, now = new Date()) {
  const ordered = [...patrols].sort((a, b) => (instant(a.startTime) ?? instant(a.scheduledDate) ?? Infinity) - (instant(b.startTime) ?? instant(b.scheduledDate) ?? Infinity) || a.id.localeCompare(b.id));
  const active = ordered.find(p => classifyPatrol(p, now).active);
  const today = ordered.find(p => classifyPatrol(p, now).today);
  const overdue = ordered.filter(p => classifyPatrol(p, now).overdue);
  const next = ordered.find(p => classifyPatrol(p, now).upcoming);
  const selected = active || today || overdue[0] || next;
  const todayAssignments = patrols.filter(p => p.status !== "CANCELLED" && scheduleDateKey(p) === localDateKey(now));
  return { selected, overdueCount: overdue.length, hasPatrolToday: todayAssignments.length > 0,
    allTodayCompleted: todayAssignments.length > 0 && todayAssignments.every(p => p.status === "COMPLETED"),
    heading: !selected ? "TODAY'S PATROL" : active ? "ACTIVE PATROL" : today ? "TODAY'S PATROL" : overdue.length ? "OVERDUE PATROL" : "NEXT PATROL" };
}
module.exports = { PATROL_TIME_ZONE, localDateKey, scheduleDateKey, scheduleInstant, expectedEnd, delayDuration, classifyPatrol, patrolFilters, matchesFilter, dashboardPatrols };
