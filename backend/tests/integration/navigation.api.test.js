const request = require("supertest");
const jwt = require("jsonwebtoken");
jest.mock("../../src/config/database", () => ({
  user: { findUnique: jest.fn() },
  patrol: { findFirst: jest.fn() },
  patrolWaypoint: { findFirst: jest.fn(), findMany: jest.fn() },
  riskZone: { findMany: jest.fn() },
  patrolLocation: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
}));
jest.mock("../../src/services/ors.service", () => ({
  walkingRoute: jest.fn(),
}));
const db = require("../../src/config/database"),
  ors = require("../../src/services/ors.service"),
  app = require("../../src/app");
let user, patrol, waypoint;
const auth = (id) =>
  "Bearer " +
  jwt.sign({}, process.env.JWT_SECRET, {
    subject: id,
    issuer: "wildguard-lk",
    audience: "wildguard-web",
    expiresIn: "1h",
  });
const input = () => ({
  patrolId: "p",
  destinationWaypointId: "w",
  currentLocation: { latitude: 7.5, longitude: 80.7 },
});
const route = (body = input(), id = "a") =>
  request(app)
    .post("/api/navigation/route")
    .set("Authorization", auth(id))
    .send(body);
const sample = (body = {}, id = "a") =>
  request(app)
    .post("/api/patrols/mine/p/locations")
    .set("Authorization", auth(id))
    .send({
      latitude: 7.5,
      longitude: 80.7,
      accuracy: 10,
      recordedAt: new Date().toISOString(),
      ...body,
    });
beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = "isolated-navigation-secret-more-than-32-chars";
  user = {
    id: "a",
    role: "RANGER",
    approvalStatus: "APPROVED",
    isActive: true,
  };
  patrol = {
    id: "p",
    parkId: "park",
    status: "IN_PROGRESS",
    actualStartTime: new Date(Date.now() - 600000),
  };
  waypoint = {
    id: "w",
    type: "CHECKPOINT",
    latitude: 7.6,
    longitude: 80.8,
    label: "Boundary",
  };
  db.user.findUnique.mockImplementation(async ({ where }) => ({
    ...user,
    id: where.id,
  }));
  db.riskZone.findMany.mockResolvedValue([]);
  db.patrol.findFirst.mockImplementation(async ({ where }) =>
    where.rangerId === "a" ? patrol : null,
  );
  db.patrolWaypoint.findFirst.mockImplementation(async ({ where }) =>
    where.id === "w" && where.patrolId === "p" ? waypoint : null,
  );
  ors.walkingRoute.mockResolvedValue({
    geometry: {
      type: "LineString",
      coordinates: [
        [80.7, 7.5],
        [80.8, 7.6],
      ],
    },
    distanceMeters: 120,
    durationSeconds: 80,
    destination: { waypointId: "w" },
  });
  db.$transaction.mockImplementation((callback) => callback(db));
  db.patrolLocation.findUnique.mockResolvedValue(null);
  db.patrolLocation.findFirst.mockResolvedValue(null);
  db.patrolLocation.create.mockImplementation(async ({ data }) => data);
  db.patrolLocation.findMany.mockResolvedValue([]);
});
test("authoritative owner destination ignores forged client destination coordinates", async () => {
  const response = await route({
    ...input(),
    destination: { latitude: 0, longitude: 0 },
  }).expect(200);
  expect(response.body.route.geometry.type).toBe("LineString");
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(ors.walkingRoute).toHaveBeenCalledWith({
    patrolId: "p",
    rangerId: "a",
    destination: waypoint,
    currentLocation: input().currentLocation,
    riskZones: [],
  });
});
test("Ranger B cannot route, fetch trail or create GPS on A patrol", async () => {
  await route(input(), "b").expect(404);
  await sample({}, "b").expect(404);
  await request(app)
    .get("/api/patrols/mine/p/locations")
    .set("Authorization", auth("b"))
    .expect(404);
  expect(ors.walkingRoute).not.toHaveBeenCalled();
  expect(db.patrolLocation.create).not.toHaveBeenCalled();
});
test.each(["HIGH_RISK", null, "UNKNOWN"])(
  "%s cannot be a destination",
  async (type) => {
    waypoint.type = type;
    await route().expect(400);
    expect(ors.walkingRoute).not.toHaveBeenCalled();
  },
);
test.each(["START", "OBSERVATION", "END"])(
  "%s is an allowed saved destination",
  async (type) => {
    waypoint.type = type;
    await route().expect(200);
  },
);
test("foreign waypoint and malformed GPS are denied before ORS", async () => {
  await route({ ...input(), destinationWaypointId: "foreign" }).expect(400);
  await route({
    ...input(),
    currentLocation: { latitude: 91, longitude: 80 },
  }).expect(400);
  await route({
    ...input(),
    currentLocation: { latitude: "7", longitude: 80 },
  }).expect(400);
  expect(ors.walkingRoute).not.toHaveBeenCalled();
});
test.each(["SCHEDULED", "COMPLETED", "CANCELLED"])(
  "%s cannot route or record GPS",
  async (status) => {
    patrol.status = status;
    await route().expect(409);
    await sample().expect(409);
    expect(db.patrolLocation.create).not.toHaveBeenCalled();
  },
);
test.each(["manager", "PENDING", "REJECTED", "inactive", "signed-out"])(
  "%s cannot access navigation APIs",
  async (restriction) => {
    if (restriction === "manager") user.role = "PARK_MANAGER";
    else if (restriction === "inactive") user.isActive = false;
    else user.approvalStatus = restriction;
    const response = await request(app)
      .post("/api/navigation/route")
      .set("Authorization", restriction === "signed-out" ? "" : auth("a"))
      .send(input());
    expect([401, 403]).toContain(response.status);
    expect(db.patrol.findFirst).not.toHaveBeenCalled();
  },
);
test("GPS sampling preserves timestamp and locks owner patrol row", async () => {
  const recordedAt = new Date().toISOString();
  const response = await sample({ recordedAt }).expect(200);
  expect(response.body.accepted).toBe(true);
  expect(response.body.location.recordedAt).toBe(recordedAt);
  expect(db.$queryRaw).toHaveBeenCalled();
  const data = db.patrolLocation.create.mock.calls[0][0].data;
  expect(data.id).toMatch(/^gps_[a-f0-9]{64}$/);
  expect(data.patrolId).toBe("p");
});
test("duplicate GPS submission does not write", async () => {
  db.patrolLocation.findUnique.mockResolvedValue({ id: "existing" });
  const response = await sample().expect(200);
  expect(response.body.reason).toBe("DUPLICATE");
  expect(db.patrolLocation.create).not.toHaveBeenCalled();
});
test("tiny GPS jitter is throttled, substantial movement after minimum interval saves", async () => {
  db.patrolLocation.findFirst.mockResolvedValue({
    latitude: 7.5,
    longitude: 80.7,
    recordedAt: new Date(Date.now() - 15000),
  });
  expect((await sample().expect(200)).body.reason).toBe("THROTTLED");
  await sample({ latitude: 7.501 }).expect(200);
  expect(db.patrolLocation.create).toHaveBeenCalledTimes(1);
});
test("pre-start, stale, future and poor accuracy samples are not saved", async () => {
  patrol.actualStartTime = new Date(Date.now() + 1000);
  expect((await sample().expect(200)).body.reason).toBe("BEFORE_START");
  await sample({
    recordedAt: new Date(Date.now() - 180000).toISOString(),
  }).expect(400);
  await sample({
    recordedAt: new Date(Date.now() + 60000).toISOString(),
  }).expect(400);
  await sample({ accuracy: 150 }).expect(400);
  expect(db.patrolLocation.create).not.toHaveBeenCalled();
});
test("provider errors are sanitized and retry timing is returned", async () => {
  ors.walkingRoute.mockRejectedValue(
    Object.assign(new Error("Walking routing is temporarily busy."), {
      navigationError: true,
      status: 429,
      code: "ROUTE_RATE_LIMIT",
      retryAfterSeconds: 60,
    }),
  );
  const response = await route().expect(429);
  expect(response.headers["retry-after"]).toBe("60");
  expect(response.body.code).toBe("ROUTE_RATE_LIMIT");
});
const riskRecord = (changes = {}) => ({
  id: "risk",
  name: "Known danger",
  description: "Recorded warning",
  riskLevel: "HIGH",
  isActive: true,
  parkId: "park",
  centerLatitude: 7.55,
  centerLongitude: 80.75,
  radiusMeters: 50,
  ...changes,
});
test("active HIGH/CRITICAL zones are selected from the authoritative patrol park, and other parks/inactive/low zones are excluded", async () => {
  db.riskZone.findMany.mockResolvedValue([
    riskRecord(),
    riskRecord({
      id: "critical",
      riskLevel: "CRITICAL",
      centerLatitude: 7.551,
    }),
    riskRecord({ id: "other", parkId: "other" }),
    riskRecord({ id: "inactive", isActive: false }),
    riskRecord({ id: "low", riskLevel: "LOW" }),
  ]);
  await route().expect(200);
  const query = db.riskZone.findMany.mock.calls[0][0];
  expect(query.where).toEqual({
    parkId: "park",
    isActive: true,
    riskLevel: { in: ["HIGH", "CRITICAL"] },
  });
  const zones = ors.walkingRoute.mock.calls[0][0].riskZones;
  expect(zones.map((zone) => zone.id)).toEqual(["risk", "critical"]);
  expect(zones[0].geometry.type).toBe("Polygon");
  expect(zones[0]).not.toHaveProperty("parkId");
});
test("destination inside zone blocks provider and keeps zone geometry visible in error", async () => {
  db.riskZone.findMany.mockResolvedValue([
    riskRecord({
      centerLatitude: waypoint.latitude,
      centerLongitude: waypoint.longitude,
    }),
  ]);
  const response = await route().expect(422);
  expect(response.body.code).toBe("DESTINATION_IN_RISK_ZONE");
  expect(response.body.riskZones[0].geometry.type).toBe("Polygon");
  expect(ors.walkingRoute).not.toHaveBeenCalled();
});
test("Ranger inside zone is a separate explicit warning without claiming a safe exit", async () => {
  db.riskZone.findMany.mockResolvedValue([
    riskRecord({ centerLatitude: 7.5, centerLongitude: 80.7 }),
  ]);
  const response = await route().expect(422);
  expect(response.body.code).toBe("RANGER_IN_RISK_ZONE");
  expect(ors.walkingRoute).not.toHaveBeenCalled();
});
test("invalid active zone fails closed while valid area remains in sanitized context", async () => {
  db.riskZone.findMany.mockResolvedValue([
    riskRecord(),
    riskRecord({ id: "invalid", radiusMeters: -1 }),
  ]);
  const response = await route().expect(422);
  expect(response.body.code).toBe("RISK_ZONE_DATA_INVALID");
  expect(response.body.riskZones).toHaveLength(1);
  expect(ors.walkingRoute).not.toHaveBeenCalled();
});
test("excessive zones are not silently dropped to obtain an unsafe normal route", async () => {
  db.riskZone.findMany.mockResolvedValue(
    Array.from({ length: 33 }, (_, index) => riskRecord({ id: String(index) })),
  );
  const response = await route().expect(422);
  expect(response.body.code).toBe("RISK_AVOIDANCE_LIMIT");
  expect(ors.walkingRoute).not.toHaveBeenCalled();
});
test.each(["options", "avoid_polygons", "riskZones", "avoidanceGeometry"])(
  "client %s is rejected before ORS/database risk access",
  async (key) => {
    const response = await route({
      ...input(),
      [key]: { malicious: true },
    }).expect(400);
    expect(response.body.code).toBe("CUSTOM_AVOIDANCE_NOT_ALLOWED");
    expect(ors.walkingRoute).not.toHaveBeenCalled();
    expect(db.riskZone.findMany).not.toHaveBeenCalled();
  },
);
test("risk context is owner-protected, active-only and uses no ORS request or mutation", async () => {
  db.riskZone.findMany.mockResolvedValue([riskRecord()]);
  const read = (id) =>
    request(app)
      .get("/api/navigation/patrols/p/risk-zones")
      .set("Authorization", auth(id));
  const response = await read("a").expect(200);
  expect(response.body.riskZones[0].name).toBe("Known danger");
  await read("b").expect(404);
  patrol.status = "COMPLETED";
  await read("a").expect(409);
  expect(ors.walkingRoute).not.toHaveBeenCalled();
  expect(db.patrolLocation.create).not.toHaveBeenCalled();
});
test("provider failures retain relevant zones and reroutes reload current park risk data", async () => {
  db.riskZone.findMany.mockResolvedValue([riskRecord()]);
  ors.walkingRoute.mockRejectedValue(
    Object.assign(new Error("Walking navigation is currently unavailable."), {
      navigationError: true,
      status: 503,
      code: "ROUTING_UNAVAILABLE",
    }),
  );
  const response = await route().expect(503);
  expect(response.body.riskZones).toHaveLength(1);
  await route().expect(503);
  expect(db.riskZone.findMany).toHaveBeenCalledTimes(2);
  expect(
    ors.walkingRoute.mock.calls.every(
      ([input]) => input.riskZones.length === 1,
    ),
  ).toBe(true);
});

const fullSaved = () =>
  ["START", "CHECKPOINT", "HIGH_RISK", "CHECKPOINT", "OBSERVATION", "END"].map(
    (type, order) => ({
      id: "full-" + order,
      type,
      order,
      label: type,
      latitude: 7.5 + order / 100,
      longitude: 80.7,
    }),
  );
const fullRequest = (id = "a") =>
  request(app)
    .get("/api/navigation/patrols/p/route")
    .set("Authorization", auth(id));
test("full route loads authoritative ordered points, excludes HIGH_RISK and uses trusted park avoidance", async () => {
  db.patrolWaypoint.findMany.mockResolvedValue(fullSaved());
  db.riskZone.findMany.mockResolvedValue([riskRecord()]);
  await fullRequest()
    .query({ waypoints: "forged", avoid_polygons: "forged" })
    .expect(200);
  const options = ors.walkingRoute.mock.calls[0][0];
  expect(options.waypoints.map((p) => p.id)).toEqual([
    "full-0",
    "full-1",
    "full-3",
    "full-4",
    "full-5",
  ]);
  expect(options.currentLocation.id).toBe("full-0");
  expect(options.destination.id).toBe("full-5");
  expect(options.riskZones[0].id).toBe("risk");
  expect(db.patrolWaypoint.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { patrolId: "p" },
      orderBy: { order: "asc" },
    }),
  );
  expect(db.patrolLocation.create).not.toHaveBeenCalled();
});
test("foreign Ranger cannot obtain full patrol route", async () => {
  await fullRequest("b").expect(404);
  expect(ors.walkingRoute).not.toHaveBeenCalled();
});
test.each([
  { role: "PARK_MANAGER" },
  { approvalStatus: "PENDING" },
  { isActive: false },
])(
  "full-route endpoint requires active approved Ranger: %j",
  async (changes) => {
    Object.assign(user, changes);
    await fullRequest().expect(changes.isActive === false ? 401 : 403);
    expect(ors.walkingRoute).not.toHaveBeenCalled();
  },
);
test("a later mandatory destination inside a risk zone blocks full routing instead of skipping it", async () => {
  const saved = fullSaved();
  db.patrolWaypoint.findMany.mockResolvedValue(saved);
  db.riskZone.findMany.mockResolvedValue([
    riskRecord({
      centerLatitude: saved[3].latitude,
      centerLongitude: saved[3].longitude,
    }),
  ]);
  const response = await fullRequest().expect(422);
  expect(response.body.code).toBe("DESTINATION_IN_RISK_ZONE");
  expect(response.body.riskZones).toHaveLength(1);
  expect(ors.walkingRoute).not.toHaveBeenCalled();
});
test("invalid full sequence and inactive patrol do not call ORS", async () => {
  db.patrolWaypoint.findMany.mockResolvedValue(fullSaved().slice(1));
  await fullRequest().expect(422);
  patrol.status = "SCHEDULED";
  await fullRequest().expect(409);
  expect(ors.walkingRoute).not.toHaveBeenCalled();
});
