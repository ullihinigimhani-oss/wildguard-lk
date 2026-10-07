const repository = require("../repositories/patrol.repository");
const invalid = (fields) =>
  Object.assign(new Error("Please check your patrol details."), {
    status: 400,
    validationError: true,
    fields,
  });
exports.getAssignableRangers = () => repository.findAssignableRangers();
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
