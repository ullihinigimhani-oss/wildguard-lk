jest.mock("../../../src/repositories/incident.repository", () => ({ findIncident: jest.fn(), withActivePatrol: jest.fn(), create: jest.fn() }));
const repo = require("../../../src/repositories/incident.repository");
const service = require("../../../src/services/incident.service");
const key = "01234567-89ab-4cde-8012-0123456789ab";
const body = { title: "Snare", incidentType: "POACHING_SNARE", description: "Observed snare", latitude: 7.5, longitude: 80.7, occurredAt: new Date("2026-10-08T08:00:00Z"), manualLocation: "Observed field location", evidence: [] };
const user = { id: "r", role: "RANGER" };
let records, tail, completed;
beforeEach(() => {
  jest.clearAllMocks(); records = new Map(); tail = Promise.resolve(); completed = false;
  repo.findIncident.mockImplementation(async (id, owner) => { const row = records.get(id); return row?.reporterId === owner.id ? row : null; });
  repo.withActivePatrol.mockImplementation((id, owner, callback) => {
    const operation = tail.then(() => {
      if (completed) throw Object.assign(new Error("Patrol completed"), { status: 409 });
      return callback({ incident: { findUnique: async ({ where }) => records.get(where.id) || null } }, { id, parkId: "park" });
    }); tail = operation.catch(() => {}); return operation;
  });
  repo.create.mockImplementation(async (_tx, row) => { const saved = { ...row, evidence: [], id: row.id || "online-id" }; records.set(saved.id, saved); return saved; });
});
test("concurrent and lost-response retries create one incident under patrol lock", async () => {
  const results = await Promise.all([service.create("p", body, user, key), service.create("p", body, user, key)]);
  expect(results[0].id).toBe(results[1].id); expect(repo.create).toHaveBeenCalledTimes(1);
  completed = true; expect((await service.create("p", body, user, key)).id).toBe(results[0].id);
  expect(repo.create).toHaveBeenCalledTimes(1);
});
test("new incident still blocked after completion; no authorization bypass", async () => {
  completed = true; await expect(service.create("p", body, user, key)).rejects.toMatchObject({ status: 409 });
  expect(repo.create).not.toHaveBeenCalled();
});
test("same client UUID is scoped to Ranger and patrol", async () => {
  const first = await service.create("p", body, user, key);
  const other = await service.create("p", body, { id: "other", role: "RANGER" }, key);
  const another = await service.create("q", body, user, key);
  expect(new Set([first.id, other.id, another.id]).size).toBe(3);
});
test("changed body conflicts and malformed keys fail before database mutation", async () => {
  await service.create("p", body, user, key);
  await expect(service.create("p", { ...body, title: "Changed" }, user, key)).rejects.toMatchObject({ status: 409, code: "IDEMPOTENCY_CONFLICT" });
  await expect(service.create("p", body, user, "invalid")).rejects.toMatchObject({ status: 409, code: "INVALID_IDEMPOTENCY_KEY" });
  expect(repo.create).toHaveBeenCalledTimes(1);
});
test("legacy online creation remains compatible without an idempotency key", async () => {
  const result = await service.create("p", body, user); expect(result.id).toBe("online-id");
  expect(repo.create.mock.calls[0][1]).not.toHaveProperty("id");
});

test('[B1-IDEM-01] uppercase UUID and equivalent timezone timestamp replay the same saved incident', async () => {
  const saved = await service.create('p', body, user, key);
  const replay = await service.create('p', { ...body, occurredAt: '2026-10-08T13:30:00+05:30' }, user, key.toUpperCase());
  expect(replay.id).toBe(saved.id); expect(repo.create).toHaveBeenCalledTimes(1);
});
test('[B1-IDEM-02] a null or omitted manual location is equivalent on replay', async () => {
  const { manualLocation, ...withoutLocation } = body;
  const saved = await service.create('p', withoutLocation, user, key);
  expect((await service.create('p', { ...withoutLocation, manualLocation: null }, user, key)).id).toBe(saved.id);
  expect(repo.create).toHaveBeenCalledTimes(1);
});
test('[B1-IDEM-03] replay cannot attach inline evidence to an already saved report', async () => {
  await service.create('p', body, user, key);
  await expect(service.create('p', { ...body, evidence: [{ uploadId: 'new' }] }, user, key))
    .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
  expect(repo.create).toHaveBeenCalledTimes(1);
});
test('[B1-IDEM-04] P2002 recovers only a matching owned persisted report', async () => {
  const saved = await service.create('p', body, user, key);
  repo.findIncident.mockResolvedValueOnce(null);
  repo.withActivePatrol.mockRejectedValueOnce(Object.assign(new Error('Mock conflict'), { code: 'P2002' }));
  expect((await service.create('p', body, user, key)).id).toBe(saved.id);
  expect(repo.findIncident).toHaveBeenLastCalledWith(saved.id, user);
  expect(repo.create).toHaveBeenCalledTimes(1);
});
test('[B1-IDEM-05] P2002 without an owned record preserves the original database error', async () => {
  const failure = Object.assign(new Error('Mock conflict'), { code: 'P2002' });
  repo.withActivePatrol.mockRejectedValueOnce(failure);
  await expect(service.create('p', body, user, key)).rejects.toBe(failure);
  expect(repo.create).not.toHaveBeenCalled();
});
test('[B1-IDEM-06] conflicting persisted content remains a 409 during database conflict recovery', async () => {
  await service.create('p', body, user, key);
  repo.findIncident.mockResolvedValueOnce(null);
  repo.withActivePatrol.mockRejectedValueOnce(Object.assign(new Error('Mock conflict'), { code: 'P2002' }));
  await expect(service.create('p', { ...body, longitude: 81 }, user, key)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  expect(repo.create).toHaveBeenCalledTimes(1);
});

test("completion winning the lock still recovers an already-persisted matching report", async () => {
  const saved = await service.create("p", body, user, key);
  repo.findIncident.mockResolvedValueOnce(null);
  repo.withActivePatrol.mockRejectedValueOnce(Object.assign(new Error("Completed"), { status: 409, code: "PATROL_NOT_ACTIVE" }));
  expect((await service.create("p", body, user, key)).id).toBe(saved.id);
  expect(repo.create).toHaveBeenCalledTimes(1);
});
