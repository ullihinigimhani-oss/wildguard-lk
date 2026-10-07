const request = require("supertest");
const jwt = require("jsonwebtoken");
jest.mock("../../src/config/database", () => ({
  park: { findUnique: jest.fn() },
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  patrol: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
}));
const db = require("../../src/config/database");
const app = require("../../src/app");

let accounts;
const token = (id) =>
  jwt.sign({}, process.env.JWT_SECRET, {
    subject: id,
    issuer: "wildguard-lk",
    audience: "wildguard-web",
    expiresIn: "1h",
  });
const payload = (overrides) => ({
  patrol_title: "Northern boundary sweep",
  park_ranger_area: "park-a",
  assigned_ranger: "ranger-1",
  patrol_date: "2026-10-10",
  start_time: "06:30",
  expected_end_time: "10:00",
  ...overrides,
});
const asManager = () => "Bearer " + token("manager");
beforeEach(() => {
  process.env.JWT_SECRET = "isolated-patrol-api-secret-at-least-32-chars";
  accounts = {
    manager: {
      id: "manager",
      name: "Existing Manager",
      email: "manager@example.test",
      role: "PARK_MANAGER",
      approvalStatus: "APPROVED",
      isActive: true,
    },
    "ranger-1": {
      id: "ranger-1",
      name: "A. Perera",
      email: "ranger-1@example.test",
      role: "RANGER",
      approvalStatus: "APPROVED",
      isActive: true,
      parkId: "park-a",
    },
  };
  db.user.findUnique.mockImplementation(
    async ({ where }) => accounts[where.id] || null,
  );
  db.user.findMany.mockResolvedValue([
    { id: "ranger-1", name: "A. Perera", email: "ranger-1@example.test", parkId: "park-a" },
  ]);
  db.park.findUnique.mockImplementation(async ({ where }) =>
    where.id === "park-a"
      ? { id: "park-a", name: "Yala National Park" }
      : null,
  );
  db.patrol.create.mockImplementation(async ({ data }) => ({
    id: "patrol-1",
    createdAt: new Date("2026-10-07T10:00:00.000Z"),
    ranger: { id: "ranger-1", name: "A. Perera", email: "ranger-1@example.test" },
    park: { id: "park-a", name: "Yala National Park" },
    createdBy: { id: "manager", name: "Existing Manager" },
    ...data,
  }));
  db.patrol.findMany.mockResolvedValue([]);
  db.patrol.findUnique.mockResolvedValue(null);
  db.patrol.count.mockResolvedValue(0);
});
test("unauthenticated requests are rejected", async () => {
  await request(app).get("/api/patrols/mine").expect(401);
  await request(app).get("/api/patrols/rangers").expect(401);
  await request(app)
    .post("/api/patrols")
    .send(payload())
    .expect(401);
  expect(db.user.findMany).not.toHaveBeenCalled();
  expect(db.patrol.create).not.toHaveBeenCalled();
});
test("manager-created record is visible only to its assigned authenticated ranger", async () => {
  accounts["ranger-2"] = { ...accounts["ranger-1"], id: "ranger-2" };
  const created = await request(app).post("/api/patrols").set("Authorization", asManager()).send(payload()).expect(201);
  db.patrol.findMany.mockImplementation(async ({ where }) => where.rangerId === created.body.patrol.rangerId ? [created.body.patrol] : []);
  const a = await request(app).get("/api/patrols/mine?rangerId=ranger-2").set("Authorization", "Bearer " + token("ranger-1")).expect(200);
  expect(a.body.patrols[0].id).toBe(created.body.patrol.id);
  const b = await request(app).get("/api/patrols/mine?rangerId=ranger-1").set("Authorization", "Bearer " + token("ranger-2")).expect(200);
  expect(b.body.patrols).toEqual([]);
  expect(db.patrol.findMany.mock.calls.map(([query]) => query.where.rangerId)).toEqual(["ranger-1", "ranger-2"]);
  expect(a.headers["cache-control"]).toBe("no-store");
  await request(app).get("/api/patrols/mine").set("Authorization", asManager()).expect(403);
  accounts["ranger-1"].approvalStatus = "PENDING";
  await request(app).get("/api/patrols/mine").set("Authorization", "Bearer " + token("ranger-1")).expect(403);
});
test.each(["RANGER", "COMMUNITY_LIAISON", "RESEARCHER", "COMMUNITY_USER"])(
  "%s cannot manage patrols",
  async (role) => {
    accounts.intruder = {
      id: "intruder",
      name: "Test " + role,
      email: "intruder@example.test",
      role,
      approvalStatus: "APPROVED",
      isActive: true,
    };
    const denied = await request(app)
      .get("/api/patrols/rangers")
      .set("Authorization", "Bearer " + token("intruder"))
      .expect(403);
    expect(denied.body).toEqual({
      success: false,
      message: "You do not have permission to perform this action.",
    });
    await request(app)
      .post("/api/patrols")
      .set("Authorization", "Bearer " + token("intruder"))
      .send(payload())
      .expect(403);
    expect(db.user.findMany).not.toHaveBeenCalled();
    expect(db.patrol.create).not.toHaveBeenCalled();
  },
);
test("session approval status is re-checked for every request", async () => {
  const saved = asManager();
  accounts.manager.approvalStatus = "PENDING";
  await request(app)
    .get("/api/patrols/rangers")
    .set("Authorization", saved)
    .expect(403);
  accounts.manager.approvalStatus = "APPROVED";
  accounts.manager.role = "RANGER";
  await request(app)
    .get("/api/patrols/rangers")
    .set("Authorization", saved)
    .expect(403);
});
test("ranger list only exposes active approved rangers without secrets", async () => {
  const { body } = await request(app)
    .get("/api/patrols/rangers")
    .set("Authorization", asManager())
    .expect(200);
  expect(body.success).toBe(true);
  expect(body.rangers).toHaveLength(1);
  expect(body.rangers[0].id).toBe("ranger-1");
  expect(JSON.stringify(body)).not.toMatch(/password|isActive|approvalStatus/);
  const options = db.user.findMany.mock.calls[0][0];
  expect(options.where).toEqual({
    role: "RANGER",
    approvalStatus: "APPROVED",
    isActive: true,
  });
  expect(options.select.passwordHash).toBeUndefined();
  expect(options.take).toBe(200);
  expect(options.orderBy).toEqual([{ name: "asc" }, { id: "asc" }]);
});
test("creates a scheduled patrol with defaults for optional fields", async () => {
  const { body } = await request(app)
    .post("/api/patrols")
    .set("Authorization", asManager())
    .send(payload())
    .expect(201);
  expect(body.success).toBe(true);
  expect(body.message).toBe("Patrol created successfully.");
  expect(body.patrol).toEqual(
    expect.objectContaining({
      id: "patrol-1",
      status: "SCHEDULED",
      routeName: "Northern boundary sweep",
      patrolType: "ROUTINE",
      priority: "MEDIUM",
    }),
  );
  expect(db.patrol.create).toHaveBeenCalledTimes(1);
  expect(db.patrol.create.mock.calls[0][0].data).toEqual({
    routeName: "Northern boundary sweep",
    parkId: "park-a",
    rangerId: "ranger-1",
    scheduledDate: new Date("2026-10-10T00:00:00.000Z"),
    startTime: new Date(2026, 9, 10, 6, 30),
    endTime: new Date(2026, 9, 10, 10, 0),
    description: null,
    patrolType: "ROUTINE",
    priority: "MEDIUM",
    startLocation: null,
    latitude: null,
    longitude: null,
    status: "SCHEDULED",
    createdById: "manager",
  });
});
test("passes patrol type, priority, notes and coordinates through", async () => {
  const { body } = await request(app)
    .post("/api/patrols")
    .set("Authorization", asManager())
    .send(
      payload({
        instructions_notes: "Focus near the reservoir.",
        patrol_type: "ANTI_POACHING",
        priority: "HIGH",
        start_location: "Main gate",
        latitude: "7.5",
        longitude: 80.7,
      }),
    )
    .expect(201);
  expect(db.patrol.create.mock.calls[0][0].data).toEqual(
    expect.objectContaining({
      description: "Focus near the reservoir.",
      patrolType: "ANTI_POACHING",
      priority: "HIGH",
      startLocation: "Main gate",
      latitude: 7.5,
      longitude: 80.7,
    }),
  );
  expect(body.patrol.latitude).toBe(7.5);
});
test.each([
  [{ patrol_title: "go" }, "patrol_title"],
  [{ patrol_title: "" }, "patrol_title"],
  [{ park_ranger_area: "" }, "park_ranger_area"],
  [{ assigned_ranger: "" }, "assigned_ranger"],
  [{ patrol_date: "2026-02-30" }, "patrol_date"],
  [{ start_time: "24:00" }, "start_time"],
  [{ start_time: "12:00", expected_end_time: "09:00" }, "expected_end_time"],
  [{ patrol_type: "SLEEPING" }, "patrol_type"],
  [{ priority: "URGENT" }, "priority"],
  [{ latitude: 91 }, "latitude"],
  [{ longitude: 181 }, "longitude"],
  [{ instructions_notes: "n".repeat(2001) }, "instructions_notes"],
  [{ start_location: "x" }, "start_location"],
])("rejects invalid payload focusing on %s", async (overrides, field) => {
  const { body } = await request(app)
    .post("/api/patrols")
    .set("Authorization", asManager())
    .send(payload(overrides))
    .expect(400);
  expect(body).toEqual(
    expect.objectContaining({
      success: false,
      message: "Please check your patrol details.",
    }),
  );
  expect(body.errors).toHaveProperty(field);
  expect(db.patrol.create).not.toHaveBeenCalled();
});
test("unknown park returns a field error", async () => {
  const { body } = await request(app)
    .post("/api/patrols")
    .set("Authorization", asManager())
    .send(payload({ park_ranger_area: "missing-park" }))
    .expect(400);
  expect(body.errors.park_ranger_area).toBe(
    "Select a valid park or ranger area.",
  );
  expect(db.patrol.create).not.toHaveBeenCalled();
});
test.each([
  ["missing ranger", null],
  ["pending ranger", { approvalStatus: "PENDING" }],
  ["inactive ranger", { isActive: false }],
  ["non-ranger", { role: "COMMUNITY_LIAISON" }],
])("%s cannot be assigned", async (name, patch) => {
  accounts["ranger-1"] = patch && { ...accounts["ranger-1"], ...patch };
  const { body } = await request(app)
    .post("/api/patrols")
    .set("Authorization", asManager())
    .send(payload())
    .expect(400);
  expect(body.errors.assigned_ranger).toBe("Select an approved ranger.");
  expect(db.patrol.create).not.toHaveBeenCalled();
});
test("rejects malformed JSON", async () => {
  await request(app)
    .post("/api/patrols")
    .set("Authorization", asManager())
    .set("Content-Type", "application/json")
    .send("{")
    .expect(400);
  expect(db.patrol.create).not.toHaveBeenCalled();
});
test("database errors stay private", async () => {
  db.patrol.create.mockRejectedValue(new Error("private database info"));
  const { body } = await request(app)
    .post("/api/patrols")
    .set("Authorization", asManager())
    .send(payload())
    .expect(500);
  expect(body.message).toBe("Internal server error");
  db.user.findMany.mockRejectedValue(new Error("private database info"));
  const list = await request(app)
    .get("/api/patrols/rangers")
    .set("Authorization", asManager())
    .expect(500);
  expect(list.body.message).toBe("Internal server error");
});
const lastPatrolQuery = () =>
  db.patrol.findMany.mock.calls[db.patrol.findMany.mock.calls.length - 1][0];
test("manager lists patrols with pagination metadata and latest status", async () => {
  db.patrol.findMany.mockResolvedValue([
    { id: "patrol-1", status: "IN_PROGRESS" },
  ]);
  db.patrol.count.mockResolvedValue(26);
  const { body } = await request(app)
    .get("/api/patrols")
    .set("Authorization", asManager())
    .expect(200);
  expect(body).toEqual({
    success: true,
    patrols: [{ id: "patrol-1", status: "IN_PROGRESS" }],
    total: 26,
    page: 1,
    pageSize: 25,
  });
  expect(body.patrols[0].status).toBe("IN_PROGRESS");
  const query = lastPatrolQuery();
  expect(query.take).toBe(25);
  expect(query.skip).toBe(0);
  expect(query.where).toEqual({});
  expect(query.select).toHaveProperty("startLocation");
  expect(query.select).toHaveProperty("latitude");
  expect(body.patrols[0]).not.toHaveProperty("passwordHash");
});
test("applies every list filter on the server", async () => {
  const { body } = await request(app)
    .get(
      "/api/patrols?search=fence&status=IN_PROGRESS&patrolType=ANTI_POACHING&priority=HIGH&rangerId=ranger-1&date=2026-10-10&page=2",
    )
    .set("Authorization", asManager())
    .expect(200);
  expect(body).toEqual({
    success: true,
    patrols: [],
    total: 0,
    page: 2,
    pageSize: 25,
  });
  expect(lastPatrolQuery().where).toEqual({
    status: "IN_PROGRESS",
    patrolType: "ANTI_POACHING",
    priority: "HIGH",
    rangerId: "ranger-1",
    scheduledDate: { gte: new Date("2026-10-10"), lt: new Date("2026-10-11") },
    routeName: { contains: "fence", mode: "insensitive" },
  });
  expect(lastPatrolQuery().skip).toBe(25);
});
test.each([
  "status=SLEEPING",
  "patrolType=NAPPING",
  "priority=URGENT",
  "date=2026-02-30",
  "page=0",
  "page=abc",
  "search=" + "x".repeat(121),
])("rejects invalid filter %s", async (query) => {
  const { body } = await request(app)
    .get("/api/patrols?" + query)
    .set("Authorization", asManager())
    .expect(400);
  expect(body).toEqual({ success: false, message: "Invalid patrol filters." });
  expect(db.patrol.findMany).not.toHaveBeenCalled();
});
test("patrol details return the latest persisted record", async () => {
  db.patrol.findUnique.mockResolvedValue({
    id: "patrol-1",
    status: "IN_PROGRESS",
    routeName: "Northern boundary sweep",
    startLocation: "Main gate",
    latitude: 7.5,
    longitude: 80.7,
    description: "Check the fence line.",
    park: { id: "park-a", name: "Yala National Park" },
    ranger: { id: "ranger-1", name: "A. Perera", email: "ranger-1@example.test" },
  });
  const { body } = await request(app)
    .get("/api/patrols/patrol-1")
    .set("Authorization", asManager())
    .expect(200);
  expect(body.success).toBe(true);
  expect(body.patrol).toEqual(
    expect.objectContaining({
      status: "IN_PROGRESS",
      startLocation: "Main gate",
      latitude: 7.5,
      longitude: 80.7,
      description: "Check the fence line.",
      ranger: expect.objectContaining({ name: "A. Perera" }),
    }),
  );
  expect(db.patrol.findUnique).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: "patrol-1" } }),
  );
  expect(body.patrol).not.toHaveProperty("passwordHash");
});
test("unknown patrol id returns a 404 message", async () => {
  const { body } = await request(app)
    .get("/api/patrols/does-not-exist")
    .set("Authorization", asManager())
    .expect(404);
  expect(body).toEqual({ success: false, message: "Patrol not found." });
  expect(db.patrol.findUnique).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: "does-not-exist" } }),
  );
});
test("list and details require an authenticated park manager", async () => {
  accounts.intruder = {
    id: "intruder",
    name: "Community Person",
    email: "intruder@example.test",
    role: "COMMUNITY_USER",
    approvalStatus: "APPROVED",
    isActive: true,
  };
  const user = "Bearer " + token("intruder");
  await request(app).get("/api/patrols").set("Authorization", user).expect(403);
  await request(app)
    .get("/api/patrols/patrol-1")
    .set("Authorization", user)
    .expect(403);
  await request(app).get("/api/patrols").expect(401);
  await request(app).get("/api/patrols/patrol-1").expect(401);
  expect(db.patrol.findMany).not.toHaveBeenCalled();
  expect(db.patrol.findUnique).not.toHaveBeenCalled();
});
