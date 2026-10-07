const repository = require("../repositories/patrol.repository");
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
