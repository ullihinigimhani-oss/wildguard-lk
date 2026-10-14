jest.mock("../../../src/repositories/patrol.repository");
jest.mock('../../../src/services/patrolRouteValidation.service', () => ({ validate: jest.fn().mockResolvedValue({}) }));
const repository = require("../../../src/repositories/patrol.repository");
const service = require("../../../src/services/patrol.service");

describe('Batch 1 patrol persistence seams', () => {
  const validation = require('../../../src/services/patrolRouteValidation.service');
  beforeEach(() => {
    validation.validate.mockReset().mockResolvedValue({});
    repository.findPatrolById.mockResolvedValue({ id: 'p', status: 'SCHEDULED' });
  });
  test('[B1-PAT-01] route validation failure prevents scheduled creation', async () => {
    const failure = Object.assign(new Error('No risk avoiding route'), { status: 422 });
    validation.validate.mockRejectedValue(failure);
    await expect(service.createPatrol(input(), 'manager')).rejects.toBe(failure);
    expect(repository.createPatrol).not.toHaveBeenCalled();
  });
  test('[B1-PAT-02] editing cannot reassign an assigned Ranger to another park', async () => {
    repository.findRanger.mockResolvedValue({ ...approvedRanger, parkId: 'other' });
    await expect(service.updatePatrol('p', input(), 'manager')).rejects.toMatchObject({ status: 400,
      fields: { assigned_ranger: 'This ranger is assigned to a different park.' } });
    expect(validation.validate).not.toHaveBeenCalled();
    expect(repository.updateScheduledPatrol).not.toHaveBeenCalled();
  });
  test('[B1-PAT-03] approved unassigned Ranger remains eligible for editing', async () => {
    repository.updateScheduledPatrol.mockResolvedValue({ id: 'p', status: 'SCHEDULED' });
    await expect(service.updatePatrol('p', input(), 'manager')).resolves.toMatchObject({ id: 'p' });
    expect(validation.validate).toHaveBeenCalledWith('park-1', undefined, 'manager');
    expect(repository.updateScheduledPatrol).toHaveBeenCalledWith('p', input());
  });
  test('[B1-PAT-04] edit persistence failure is not converted into successful readback', async () => {
    const failure = new Error('Mock edit failed'); repository.updateScheduledPatrol.mockRejectedValue(failure);
    await expect(service.updatePatrol('p', input(), 'manager')).rejects.toBe(failure);
  });
  test('[B1-PAT-05] cancellation persistence failure is propagated', async () => {
    const failure = new Error('Mock cancel failed'); repository.updateScheduledPatrol.mockRejectedValue(failure);
    await expect(service.cancelPatrol('p')).rejects.toBe(failure);
    expect(repository.updateScheduledPatrol).toHaveBeenCalledWith('p', { status: 'CANCELLED' });
  });
  test('[B1-PAT-06] cancelled assignments are excluded without discarding completed history or mutating the repository list', async () => {
    const rows = Object.freeze([Object.freeze({ id: 'cancelled', status: 'CANCELLED' }),
      Object.freeze({ id: 'done', status: 'COMPLETED' }), Object.freeze({ id: 'active', status: 'IN_PROGRESS' })]);
    repository.findRangerPatrols.mockResolvedValue(rows);
    expect((await service.getRangerPatrols('r')).map(row => row.id)).toEqual(['done', 'active']);
    expect(rows).toHaveLength(3); expect(repository.findRangerPatrols).toHaveBeenCalledWith('r');
  });
});

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
test("listPatrols builds the where clause from every filter", async () => {
  repository.findPatrols.mockResolvedValue([[{ id: "patrol-1" }], 1]);
  const result = await service.listPatrols({
    search: "fence",
    status: "IN_PROGRESS",
    patrolType: "ANTI_POACHING",
    priority: "HIGH",
    rangerId: "ranger-1",
    date: "2026-10-10",
    page: 2,
  });
  expect(repository.findPatrols).toHaveBeenCalledWith(
    {
      status: "IN_PROGRESS",
      patrolType: "ANTI_POACHING",
      priority: "HIGH",
      rangerId: "ranger-1",
      scheduledDate: { gte: new Date("2026-10-10"), lt: new Date("2026-10-11") },
      routeName: { contains: "fence", mode: "insensitive" },
    },
    2,
  );
  expect(result).toEqual([[{ id: "patrol-1" }], 1]);
});
test("listPatrols with no active filters queries the whole table", async () => {
  repository.findPatrols.mockResolvedValue([[], 0]);
  const result = await service.listPatrols({
    search: "",
    status: "",
    patrolType: "",
    priority: "",
    rangerId: "",
    date: "",
    page: 1,
  });
  expect(repository.findPatrols).toHaveBeenCalledWith({}, 1);
  expect(result).toEqual([[], 0]);
});
test("getPatrol returns the persisted patrol including ranger-updated status", async () => {
  const patrol = { id: "patrol-1", status: "IN_PROGRESS", latitude: 7.5 };
  repository.findPatrolById.mockResolvedValue(patrol);
  await expect(service.getPatrol("patrol-1")).resolves.toEqual(patrol);
  expect(repository.findPatrolById).toHaveBeenCalledWith("patrol-1");
});
test("getPatrol throws a 404 for an unknown patrol", async () => {
  repository.findPatrolById.mockResolvedValue(null);
  await expect(service.getPatrol("missing")).rejects.toMatchObject({
    status: 404,
    message: "Patrol not found.",
  });
});
