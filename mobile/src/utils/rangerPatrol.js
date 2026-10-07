export const patrolStatuses = { SCHEDULED: "Scheduled", IN_PROGRESS: "In Progress", COMPLETED: "Completed" };
export const patrolAction = { SCHEDULED: "Start Patrol", IN_PROGRESS: "Continue Patrol", COMPLETED: "View Patrol" };
export function todayPatrol(patrols, now = new Date()) {
  // Manager API stores scheduledDate as a date-only value at UTC midnight.
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = type => parts.find(value => value.type === type).value;
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  return patrols.filter(p => p.scheduledDate?.slice(0, 10) === date).sort((a, b) => ["IN_PROGRESS", "SCHEDULED", "COMPLETED"].indexOf(a.status) - ["IN_PROGRESS", "SCHEDULED", "COMPLETED"].indexOf(b.status) || (a.startTime || "").localeCompare(b.startTime || ""))[0];
}
export const patrolTime = value => value ? new Date(value).toLocaleTimeString("en-GB", { timeZone: "Asia/Colombo", hour: "2-digit", minute: "2-digit" }) : "Not specified";
export const patrolDate = value => value ? new Date(value).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }) : "Not specified";
