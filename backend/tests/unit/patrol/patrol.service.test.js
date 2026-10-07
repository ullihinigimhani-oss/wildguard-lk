jest.mock("../../../src/repositories/patrol.repository");
const repository = require("../../../src/repositories/patrol.repository");
const service = require("../../../src/services/patrol.service");

const input = () => ({
  routeName: "Northern boundary sweep",
  parkId: "park-1",
  rangerId: "ranger-1",
  scheduledDate: new Date("2026-10-10T00:00:00.000Z"),
  startTime: new Date(2026, 9, 10, 6, 30),
  endTime: new Date(2026, 9, 10, 10, 0),
  description: "Check the fence line.",
  patrolType: "ROUTINE",
  priority: "MEDIUM",
  startLocation: "Main gate",
  latitude: 7.5,
  longitude: 80.7,
});
const approvedRanger = {
  id: "ranger-1",
  role: "RANGER",
  approvalStatus: "APPROVED",
  isActive: true,
};
beforeEach(() => {
  repository.findPark.mockResolvedValue({ id: "park-1", name: "Yala" });
  repository.findRanger.mockResolvedValue(approvedRanger);
  repository.createPatrol.mockImplementation(async (data) => ({
    id: "patrol-1",
    status: data.status,
    ...data,
  }));
  repository.findAssignableRangers.mockResolvedValue([]);
});
test("creates a SCHEDULED patrol owned by the creator", async () => {
  const patrol = await service.createPatrol(input(), "manager-1");
  expect(repository.findPark).toHaveBeenCalledWith("park-1");
  expect(repository.findRanger).toHaveBeenCalledWith("ranger-1");
  expect(repository.createPatrol).toHaveBeenCalledWith({
    ...input(),
    status: "SCHEDULED",
    createdById: "manager-1",
  });
  expect(patrol).toEqual(
    expect.objectContaining({ id: "patrol-1", status: "SCHEDULED" }),
  );
});
test("rejects an unknown park without touching the patrol table", async () => {
  repository.findPark.mockResolvedValue(null);
  await expect(service.createPatrol(input(), "manager-1")).rejects.toMatchObject({
    status: 400,
    validationError: true,
    fields: { park_ranger_area: "Select a valid park or ranger area." },
  });
  expect(repository.createPatrol).not.toHaveBeenCalled();
});
test.each([
  ["missing ranger", null],
  [
    "wrong role",
    { id: "ranger-1", role: "COMMUNITY_LIAISON", approvalStatus: "APPROVED", isActive: true },
  ],
  [
    "pending ranger",
    { id: "ranger-1", role: "RANGER", approvalStatus: "PENDING", isActive: true },
  ],
  [
    "inactive ranger",
    { id: "ranger-1", role: "RANGER", approvalStatus: "APPROVED", isActive: false },
  ],
])("rejects %s", async (name, ranger) => {
  repository.findRanger.mockResolvedValue(ranger);
  await expect(service.createPatrol(input(), "manager-1")).rejects.toMatchObject({
    status: 400,
    validationError: true,
    fields: { assigned_ranger: "Select an approved ranger." },
  });
  expect(repository.createPatrol).not.toHaveBeenCalled();
});
test("propagates unexpected database failures", async () => {
  repository.createPatrol.mockRejectedValue(new Error("private database info"));
  await expect(service.createPatrol(input(), "manager-1")).rejects.toThrow(
    "private database info",
  );
});
test("ranger list is a pass-through to the repository", async () => {
  const rangers = [{ id: "ranger-1", name: "A. Perera" }];
  repository.findAssignableRangers.mockResolvedValue(rangers);
  await expect(service.getAssignableRangers()).resolves.toEqual(rangers);
  expect(repository.findAssignableRangers).toHaveBeenCalledTimes(1);
});
