const request = require("supertest");
const jwt = require("jsonwebtoken");
jest.mock("../../src/config/database", () => ({
  user: { findUnique: jest.fn() },
  patrol: { findMany: jest.fn(), findUnique: jest.fn() },
  patrolLocation: { findFirst: jest.fn(), findMany: jest.fn() },
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
const manager = () => "Bearer " + token("manager");
const now = new Date("2026-10-08T09:00:00.000Z");
const livePatrol = (overrides) => ({
  id: "patrol-1",
  routeName: "Northern boundary sweep",
  status: "IN_PROGRESS",
  patrolType: "ANTI_POACHING",
  priority: "HIGH",
  startLocation: "Main gate",
  actualStartTime: now,
  park: { id: "park-a", name: "Yala National Park" },
  ranger: { id: "ranger-1", name: "A. Perera", email: "ranger-1@example.test" },
  ...overrides,
});
beforeEach(() => {
  process.env.JWT_SECRET = "live-ranger-test-secret-with-enough-length";
  accounts = {
    manager: {
      id: "manager",
      role: "PARK_MANAGER",
      approvalStatus: "APPROVED",
      isActive: true,
      name: "Park Manager",
    },
    ranger: {
      id: "ranger-1",
      role: "RANGER",
      approvalStatus: "APPROVED",
      isActive: true,
      name: "A. Perera",
    },
    outsider: {
      id: "outsider",
      role: "COMMUNITY_USER",
      approvalStatus: "APPROVED",
      isActive: true,
      name: "Community Person",
    },
  };
  db.user.findUnique.mockImplementation(async ({ where }) => accounts[where.id] || null);
  db.patrol.findMany.mockResolvedValue([]);
  db.patrol.findUnique.mockResolvedValue(null);
  db.patrolLocation.findFirst.mockResolvedValue(null);
  db.patrolLocation.findMany.mockResolvedValue([]);
});
afterEach(() => {
  process.env.JWT_SECRET = undefined;
});

test("live monitoring requires authentication", async () => {
  await request(app).get("/api/patrols/live").expect(401);
  await request(app).get("/api/patrols/patrol-1/locations").expect(401);
  expect(db.patrol.findMany).not.toHaveBeenCalled();
  expect(db.patrolLocation.findMany).not.toHaveBeenCalled();
});
test.each(["ranger", "outsider"])("%s is forbidden from live monitoring", async (who) => {
  const user = "Bearer " + token(who);
  await request(app).get("/api/patrols/live").set("Authorization", user).expect(403);
  await request(app).get("/api/patrols/patrol-1/locations").set("Authorization", user).expect(403);
  expect(db.patrol.findMany).not.toHaveBeenCalled();
});

test("lists only in-progress patrols with their latest GPS fix and freshness window", async () => {
  db.patrol.findMany.mockResolvedValue([
    livePatrol(),
    livePatrol({
      id: "patrol-2",
      routeName: "Riverbank inspection",
      ranger: { id: "ranger-2", name: "B. Silva", email: "ranger-2@example.test" },
    }),
    livePatrol({ id: "patrol-3", routeName: "No fix yet" }),
  ]);
  db.patrolLocation.findFirst.mockImplementation(async ({ where }) =>
    where.patrolId === "patrol-1"
      ? { latitude: 6.4173, longitude: 81.4192, recordedAt: now }
      : where.patrolId === "patrol-2"
        ? { latitude: 6.5, longitude: 81.5, recordedAt: new Date("2026-10-08T08:50:00.000Z") }
        : null,
  );
  const { body, headers } = await request(app)
    .get("/api/patrols/live")
    .set("Authorization", manager())
    .expect(200);
  expect(headers["cache-control"]).toBe("no-store");
  expect(body.freshnessSeconds).toBe(120);
  expect(body.rangers).toHaveLength(3);
  expect(body.rangers[0]).toMatchObject({
    id: "patrol-1",
    routeName: "Northern boundary sweep",
    status: "IN_PROGRESS",
    patrolType: "ANTI_POACHING",
    priority: "HIGH",
    startLocation: "Main gate",
    park: { id: "park-a", name: "Yala National Park" },
    ranger: { id: "ranger-1", name: "A. Perera" },
    location: { latitude: 6.4173, longitude: 81.4192 },
  });
  expect(body.rangers[0].location.recordedAt).toBe(now.toISOString());
  // A stale fix is still returned raw; the client decides staleness from recordedAt.
  expect(body.rangers[1].location).toMatchObject({
    latitude: 6.5,
    recordedAt: "2026-10-08T08:50:00.000Z",
  });
  // A started patrol with no GPS samples yet is reported with a null location.
  expect(body.rangers[2].location).toBeNull();
  expect(JSON.stringify(body)).not.toMatch(/passwordHash|password/);
  const query = db.patrol.findMany.mock.calls[0][0];
  expect(query.where).toEqual({ status: "IN_PROGRESS" });
  expect(query.take).toBe(100);
  expect(query.select).not.toHaveProperty("passwordHash");
  expect(query.select).toHaveProperty("ranger");
  expect(query.select).toHaveProperty("park");
});
test("returns an empty list when no patrol is in progress", async () => {
  const { body } = await request(app).get("/api/patrols/live").set("Authorization", manager()).expect(200);
  expect(body).toEqual({ success: true, rangers: [], freshnessSeconds: 120 });
});

test("manager can read a patrol GPS trail in recorded order", async () => {
  db.patrol.findUnique.mockResolvedValue({ id: "patrol-1", waypoints: [] });
  db.patrolLocation.findMany.mockResolvedValue([
    { latitude: 6.41, longitude: 81.41, recordedAt: new Date("2026-10-08T08:00:00.000Z") },
    { latitude: 6.42, longitude: 81.42, recordedAt: new Date("2026-10-08T08:10:00.000Z") },
  ]);
  const { body } = await request(app)
    .get("/api/patrols/patrol-1/locations")
    .set("Authorization", manager())
    .expect(200);
  expect(body.success).toBe(true);
  expect(body.locations).toHaveLength(2);
  expect(body.locations[0].recordedAt).toBe("2026-10-08T08:00:00.000Z");
  const query = db.patrolLocation.findMany.mock.calls[0][0];
  expect(query.where).toEqual({ patrolId: "patrol-1" });
  expect(query.take).toBe(1000);
  expect(query.select).toEqual({ latitude: true, longitude: true, recordedAt: true });
});
test("unknown patrol trail returns a 404 message", async () => {
  const { body } = await request(app)
    .get("/api/patrols/missing/locations")
    .set("Authorization", manager())
    .expect(404);
  expect(body).toEqual({ success: false, message: "Patrol not found." });
  expect(db.patrolLocation.findMany).not.toHaveBeenCalled();
});

test("live endpoint never exposes database details on failure", async () => {
  db.patrol.findMany.mockRejectedValue(new Error("private database info"));
  const { body } = await request(app).get("/api/patrols/live").set("Authorization", manager()).expect(500);
  expect(body.message).toBe("Internal server error");
});