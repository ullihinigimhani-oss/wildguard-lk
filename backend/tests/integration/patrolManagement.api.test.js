const request = require("supertest");
const jwt = require("jsonwebtoken");
jest.mock("../../src/config/database", () => ({
  $transaction: jest.fn(),
  user: { findUnique: jest.fn() }, park: { findUnique: jest.fn() },
  patrol: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(), delete: jest.fn() },
  patrolWaypoint: { findMany: jest.fn(), update: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
  patrolLocation: { deleteMany: jest.fn() }, incident: { deleteMany: jest.fn() },
}));
const db = require("../../src/config/database");
const app = require("../../src/app");
let users, patrol, points, beforeUpdate, transactionSnapshot;
const route = () => ["START", "CHECKPOINT", "END"].map((type, order) => ({ type, order, latitude: 7.5 + order / 100, longitude: 80.7, label: type, note: null }));
const payload = (extra = {}) => ({ patrol_title: "Updated boundary patrol", park_ranger_area: "park", assigned_ranger: "a", patrol_date: "2026-10-07", start_time: "08:00", expected_end_time: "11:00", plannedRoute: route(), ...extra });
const header = id => "Bearer " + jwt.sign({}, process.env.JWT_SECRET, { subject: id, issuer: "wildguard-lk", audience: "wildguard-web", expiresIn: "1h" });
const edit = (body = payload(), who = "manager") => request(app).patch("/api/patrols/patrol").set("Authorization", header(who)).send(body);
const cancel = (who = "manager") => request(app).post("/api/patrols/patrol/cancel").set("Authorization", header(who));
const read = who => request(app).get("/api/patrols/mine/patrol").set("Authorization", header(who));
const start = () => request(app).post("/api/patrols/mine/patrol/start").set("Authorization", header("a"));
beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = "isolated-management-test-secret-at-least-32-chars";
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] }).setSystemTime(new Date("2026-10-07T09:00:00+05:30"));
  users = Object.fromEntries(["manager", "a", "b"].map(id => [id, { id, role: id === "manager" ? "PARK_MANAGER" : "RANGER", approvalStatus: "APPROVED", isActive: true, parkId: "park" }]));
  patrol = { id: "patrol", rangerId: "a", parkId: "park", status: "SCHEDULED", routeName: "Boundary patrol", scheduledDate: new Date("2026-10-07"), startTime: new Date("2026-10-07T08:00:00+05:30"), updatedAt: new Date("2026-10-06"), actualStartTime: null };
  points = route().map((point, i) => ({ ...point, id: "point-" + i, patrolId: "patrol" }));
  beforeUpdate = null; transactionSnapshot = null;
  const snapshot = () => ({ ...patrol, waypoints: points.filter(p => p.type && p.order !== null).map(p => ({ ...p })) });
  db.user.findUnique.mockImplementation(async ({ where }) => users[where.id] || null);
  db.park.findUnique.mockImplementation(async ({ where }) => where.id === "park" ? { id: "park" } : null);
  db.patrol.findUnique.mockImplementation(async ({ where }) => where.id === patrol.id ? snapshot() : null);
  db.patrol.findFirst.mockImplementation(async ({ where }) => where.rangerId === patrol.rangerId ? snapshot() : null);
  db.patrol.findMany.mockImplementation(async ({ where }) => where.rangerId === patrol.rangerId ? [snapshot()] : []);
  db.patrol.updateMany.mockImplementation(async ({ where, data }) => {
    if (beforeUpdate) { const action = beforeUpdate; beforeUpdate = null; action(); if (transactionSnapshot) transactionSnapshot.patrol = { ...patrol }; }
    if (where.status !== patrol.status || (where.rangerId && where.rangerId !== patrol.rangerId) || (where.updatedAt && +where.updatedAt !== +patrol.updatedAt)) return { count: 0 };
    Object.assign(patrol, data, { updatedAt: new Date() }); return { count: 1 };
  });
  db.patrolWaypoint.findMany.mockImplementation(async () => points.filter(p => p.type && p.order !== null));
  db.patrolWaypoint.update.mockImplementation(async ({ where, data }) => Object.assign(points.find(p => p.id === where.id), data));
  db.patrolWaypoint.create.mockImplementation(async ({ data }) => points.push({ ...data, id: "new-" + data.order }));
  db.patrolWaypoint.deleteMany.mockImplementation(async ({ where }) => { points = points.filter(p => !where.id.in.includes(p.id)); });
  db.$transaction.mockImplementation(async callback => {
    transactionSnapshot = { patrol: { ...patrol }, points: points.map(p => ({ ...p })) };
    try { return await callback(db); } catch (error) { patrol = transactionSnapshot.patrol; points = transactionSnapshot.points; throw error; } finally { transactionSnapshot = null; }
  });
});
afterEach(() => {
  jest.useRealTimers();
  expect(db.patrol.delete).not.toHaveBeenCalled();
  expect(db.patrolLocation.deleteMany).not.toHaveBeenCalled();
  expect(db.incident.deleteMany).not.toHaveBeenCalled();
});
test("edit updates the same assignment and route; reassignment immediately changes ownership", async () => {
  const changed = route(); changed[1].latitude = 7.57;
  const response = await edit(payload({ assigned_ranger: "b", plannedRoute: changed })).expect(200);
  expect(response.body.patrol.id).toBe("patrol");
  expect(response.body.patrol.plannedRoute[1].latitude).toBe(7.57);
  expect(points.map(p => p.id)).toEqual(["point-0", "point-1", "point-2"]);
  expect(db.patrolWaypoint.deleteMany).not.toHaveBeenCalled();
  await read("a").expect(404);
  const ranger = await read("b").expect(200);
  expect(ranger.body.patrol.routeName).toBe("Updated boundary patrol");
  expect(ranger.body.patrol.plannedRoute[1].latitude).toBe(7.57);
});
test.each(["IN_PROGRESS", "COMPLETED", "CANCELLED"])("%s cannot be edited or cancelled", async status => {
  patrol.status = status; await edit().expect(409); await cancel().expect(409);
  expect(db.$transaction).not.toHaveBeenCalled();
});
test("cancel preserves assignment and route, removes Ranger actionable list and blocks start and navigation", async () => {
  const before = JSON.stringify(points);
  await cancel().expect(200); expect(patrol.status).toBe("CANCELLED"); expect(JSON.stringify(points)).toBe(before);
  const history = await request(app).get("/api/patrols/patrol").set("Authorization", header("manager")).expect(200);
  expect(history.body.patrol.id).toBe("patrol");
  expect(history.body.patrol.status).toBe("CANCELLED");
  const list = await request(app).get("/api/patrols/mine").set("Authorization", header("a")).expect(200);
  expect(list.body.patrols).toEqual([]); await read("a").expect(200); await start().expect(409);
  const navigation = require("../../src/services/navigation.service");
  await expect(navigation.route({ patrolId: "patrol", destinationWaypointId: "point-1", currentLocation: { latitude: 7.5, longitude: 80.7 } }, "a")).rejects.toMatchObject({ status: 409, code: "PATROL_NOT_ACTIVE" });
  await expect(navigation.fullPatrolRoute("patrol", "a")).rejects.toMatchObject({ status: 409, code: "PATROL_NOT_ACTIVE" });
});
test.each(["a", "b"])("Ranger %s cannot edit or cancel", async who => {
  await edit(payload(), who).expect(403); await cancel(who).expect(403); expect(db.$transaction).not.toHaveBeenCalled();
});
test.each(["PENDING", "REJECTED", "inactive"])("%s Manager cannot mutate", async status => {
  if (status === "inactive") users.manager.isActive = false; else users.manager.approvalStatus = status;
  const response = await edit(); expect([401, 403]).toContain(response.status);
  const cancelled = await cancel(); expect([401, 403]).toContain(cancelled.status);
  expect(db.$transaction).not.toHaveBeenCalled();
});
test.each(["park", "inactive", "approval", "date", "route"])("invalid %s rejects without mutation", async kind => {
  let body = payload();
  if (kind === "park") users.a.parkId = "other";
  if (kind === "inactive") users.a.isActive = false;
  if (kind === "approval") users.a.approvalStatus = "PENDING";
  if (kind === "date") body.start_time = "25:00";
  if (kind === "route") body.plannedRoute[0].type = "END";
  await edit(body).expect(400); expect(db.$transaction).not.toHaveBeenCalled();
});
test("route failure rolls back patrol details and earlier waypoint updates", async () => {
  const before = JSON.stringify({ patrol, points });
  db.patrolWaypoint.update.mockRejectedValueOnce(new Error("isolated failure"));
  await edit().expect(500); expect(JSON.stringify({ patrol, points })).toBe(before);
});
test("route removal deletes only removed planned rows and retains legacy rows", async () => {
  points.push({ id: "legacy", patrolId: "patrol", type: null, order: null, latitude: 7.5, longitude: 80.7 });
  await edit(payload({ plannedRoute: [route()[0], { ...route()[2], order: 1 }] })).expect(200);
  expect(db.patrolWaypoint.deleteMany).toHaveBeenCalledWith({ where: { patrolId: "patrol", id: { in: ["point-2"] } } });
  expect(points.some(p => p.id === "legacy")).toBe(true);
});
test.each(["edit", "cancel"])("start winning before %s guarded mutation returns conflict", async action => {
  beforeUpdate = () => { patrol.status = "IN_PROGRESS"; };
  await (action === "edit" ? edit() : cancel()).expect(409);
  expect(db.patrolWaypoint.update).not.toHaveBeenCalled();
  expect(patrol.status).toBe("IN_PROGRESS");
});
test("edit winning after start reads schedule prevents starting the stale schedule", async () => {
  beforeUpdate = () => { patrol.scheduledDate = new Date("2026-10-20"); patrol.updatedAt = new Date("2026-10-07"); };
  await start().expect(409); expect(patrol.status).toBe("SCHEDULED");
});
test("cancellation winning after start reads patrol blocks its status transition", async () => {
  beforeUpdate = () => { patrol.status = "CANCELLED"; };
  await start().expect(409); expect(patrol.status).toBe("CANCELLED");
});


test("unauthenticated mutation is rejected and missing patrol is not created", async () => {
  await request(app).patch("/api/patrols/patrol").send(payload()).expect(401);
  await request(app).post("/api/patrols/patrol/cancel").expect(401);
  await request(app).patch("/api/patrols/missing").set("Authorization", header("manager")).send(payload()).expect(404);
  expect(db.$transaction).not.toHaveBeenCalled();
});
