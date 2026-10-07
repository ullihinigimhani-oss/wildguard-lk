const repository = require("../repositories/patrol.repository");
const { localDateKey, scheduleDateKey } = require("../../../shared/patrolLifecycle");
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
  });
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
exports.getRangerPatrols = (rangerId) => repository.findRangerPatrols(rangerId);
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
  return repository.createPatrol({ ...input, status: "SCHEDULED", createdById });
};
