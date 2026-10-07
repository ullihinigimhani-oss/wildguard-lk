import lifecycle from "../../../shared/patrolLifecycle";
export const { classifyPatrol, matchesFilter, patrolFilters, dashboardPatrols, delayDuration, PATROL_TIME_ZONE, scheduleDateKey } = lifecycle;
export const patrolStatuses = { SCHEDULED: "Scheduled", IN_PROGRESS: "In Progress", COMPLETED: "Completed" };
export const patrolTime = value => value ? new Date(value).toLocaleTimeString("en-GB", { timeZone: PATROL_TIME_ZONE, hour: "2-digit", minute: "2-digit" }) : "Not specified";
export const patrolDate = value => value ? new Date(value).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }) : "Not specified";
export const actualPatrolTime = value => value ? new Date(value).toLocaleString("en-GB", { timeZone: PATROL_TIME_ZONE, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Not recorded";
