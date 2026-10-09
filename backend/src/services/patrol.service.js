const repository = require("../repositories/patrol.repository");
const { localDateKey, scheduleDateKey } = require("../../../shared/patrolLifecycle");
const { NAVIGATION } = require("../../../shared/patrolNavigation");
const patrolError = (status, message) => Object.assign(new Error(message), { status, patrolError: true });
exports.getRangerPatrol = async (id, rangerId) => {
  const patrol = await repository.findRangerPatrol(id, rangerId);
  if (!patrol) throw patrolError(404, "This patrol is not available.");
  return patrol;
};
async function transition(id, rangerId, action) {
  const patrol = await exports.getRangerPatrol(id, rangerId);
  const starting = action === "start";
  const from = starting ? "SCHEDULED" : "IN_PROGRESS";
  const to = starting ? "IN_PROGRESS" : "COMPLETED";
  if (patrol.status === to) return patrol;
  if (patrol.status !== from) throw patrolError(409, starting ? "This patrol cannot be started in its current state." : "Start this patrol before completing it.");
  const now = new Date();
  if (starting) {
    const day = scheduleDateKey(patrol);
    if (!day) throw patrolError(409, "This patrol does not have a confirmed schedule.");
    if (day > localDateKey(now)) throw patrolError(409, "This patrol can be started on its scheduled day.");
  }
  const result = await repository.transitionRangerPatrol(id, rangerId, from, {
    status: to, ...(starting ? { actualStartTime: now } : { actualEndTime: now }),
  }, patrol.updatedAt);
  const updated = await exports.getRangerPatrol(id, rangerId);
  if (!result.count && updated.status !== to) throw patrolError(409, "This patrol changed. Refresh it and try again.");
  return updated;
}
exports.startRangerPatrol = (id, rangerId) => transition(id, rangerId, "start");
exports.completeRangerPatrol = (id, rangerId) => transition(id, rangerId, "complete");
const invalid = (fields) =>
  Object.assign(new Error("Please check your patrol details."), {
    status: 400,
    validationError: true,
    fields,
  });
const httpError = (status, message) =>
  Object.assign(new Error(message), { status, authError: true });
exports.getAssignableRangers = () => repository.findAssignableRangers();
exports.getRangerPatrols = async (rangerId) => (await repository.findRangerPatrols(rangerId)).filter(patrol => patrol.status !== "CANCELLED");
exports.listPatrols = (filters) => {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.patrolType) where.patrolType = filters.patrolType;
  if (filters.priority) where.priority = filters.priority;
  if (filters.rangerId) where.rangerId = filters.rangerId;
  if (filters.date) {
    const start = new Date(filters.date);
    where.scheduledDate = { gte: start, lt: new Date(start.getTime() + 86400000) };
  }
  if (filters.search)
    where.routeName = { contains: filters.search, mode: "insensitive" };
  return repository.findPatrols(where, filters.page);
};
exports.getPatrol = async (id) => {
  const patrol = await repository.findPatrolById(id);
  if (!patrol) throw httpError(404, "Patrol not found.");
  return patrol;
};
// GPS samples older than sampleMaxAgeMs are rejected at ingest, so anything
// beyond that window is definitively not fresh. It also allows one missed
// update: a stationary Ranger reports roughly every trailIntervalMs (60s).
exports.liveFreshnessSeconds = Math.floor(NAVIGATION.sampleMaxAgeMs / 1000);
exports.getLiveRangers = async () => {
  const patrols = await repository.findLivePatrols();
  const rangers = await Promise.all(
    patrols.map(async (patrol) => ({
      ...patrol,
      location: await repository.findLatestLocation(patrol.id),
    })),
  );
  return { rangers, freshnessSeconds: exports.liveFreshnessSeconds };
};
exports.getPatrolTrail = async (id) => {
  await exports.getPatrol(id);
  return repository.findPatrolTrail(id);
};
exports.createPatrol = async (input, createdById) => {
  const park = await repository.findPark(input.parkId);
  if (!park)
    throw invalid({
      park_ranger_area: "Select a valid park or ranger area.",
    });
  const ranger = await repository.findRanger(input.rangerId);
  if (
    !ranger ||
    ranger.role !== "RANGER" ||
    ranger.approvalStatus !== "APPROVED" ||
    !ranger.isActive
  )
    throw invalid({ assigned_ranger: "Select an approved ranger." });
  await require('./patrolRouteValidation.service').validate(input.parkId, input.waypoints?.create, createdById);
  return repository.createPatrol({ ...input, status: "SCHEDULED", createdById });
};

exports.updatePatrol = async (id, input, managerId) => {
  const patrol = await exports.getPatrol(id);
  if (patrol.status !== "SCHEDULED") throw patrolError(409, "Only scheduled patrols can be edited.");
  const park = await repository.findPark(input.parkId);
  if (!park) throw invalid({ park_ranger_area: "Select a valid park or ranger area." });
  const ranger = await repository.findRanger(input.rangerId);
  if (!ranger || ranger.role !== "RANGER" || ranger.approvalStatus !== "APPROVED" || !ranger.isActive)
    throw invalid({ assigned_ranger: "Select an approved ranger." });
  // Unassigned approved Rangers are eligible for any park; assigned Rangers
  // must match the patrol park. This preserves the existing global pool.
  if (ranger.parkId && ranger.parkId !== input.parkId)
    throw invalid({ assigned_ranger: "This ranger is assigned to a different park." });
  await require('./patrolRouteValidation.service').validate(input.parkId, input.waypoints?.create, managerId);
  return repository.updateScheduledPatrol(id, input);
};
exports.cancelPatrol = async id => {
  const patrol = await exports.getPatrol(id);
  if (patrol.status !== "SCHEDULED") throw patrolError(409, "Only scheduled patrols can be cancelled.");
  return repository.updateScheduledPatrol(id, { status: "CANCELLED" });
};
