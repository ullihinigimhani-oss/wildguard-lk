const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../../src/config/database", () => ({
  user: { findUnique: jest.fn() },
  patrol: { findMany: jest.fn() },
  incident: { findMany: jest.fn() },
  communityReport: { findMany: jest.fn() },
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

const at = (iso) => new Date(iso);
const incidentRow = (over = {}) => ({
  status: "PENDING",
  incidentType: "POACHING_SNARE",
  reportedAt: at("2026-10-08T04:00:00.000Z"),
  manualLocation: "Weerawila",
  ...over,
});
const patrolRow = (over = {}) => ({
  status: "SCHEDULED",
  patrolType: "ROUTINE",
  priority: "MEDIUM",
  scheduledDate: at("2026-10-01T00:00:00.000Z"),
  actualStartTime: null,
  createdAt: at("2026-09-28T02:00:00.000Z"),
  startLocation: "Bundala gate",
  ...over,
});
const reportRow = (over = {}) => ({
  status: "PENDING",
  reportType: "WILDLIFE_SIGHTING",
  submittedAt: at("2026-10-06T10:00:00.000Z"),
  manualLocation: "Kataragama North",
  ...over,
});

beforeEach(() => {
  process.env.JWT_SECRET = "isolated-analytics-api-secret-key-32";
  accounts = {
    manager: {
      id: "manager",
      name: "Park Manager",
      email: "manager@example.test",
      role: "PARK_MANAGER",
      approvalStatus: "APPROVED",
      isActive: true,
      parkId: "park-1",
      park: { id: "park-1", name: "Yala" },
    },
    "ranger-1": {
      id: "ranger-1",
      name: "Ranger One",
      email: "ranger1@example.test",
      role: "RANGER",
      approvalStatus: "APPROVED",
      isActive: true,
      parkId: "park-1",
      park: { id: "park-1", name: "Yala" },
    },
  };
  db.user.findUnique.mockImplementation(
    async ({ where }) => accounts[where.id] || null,
  );
  db.incident.findMany.mockResolvedValue([]);
  db.patrol.findMany.mockResolvedValue([]);
  db.communityReport.findMany.mockResolvedValue([]);
});

describe("Analytics APIs", () => {
  describe("access control", () => {
    test("rejects unauthenticated requests with 401", async () => {
      await request(app).get("/api/analytics/kpis").expect(401);
    });

    test("rejects non-Park-Manager roles with 403", async () => {
      const res = await request(app)
        .get("/api/analytics/kpis")
        .set("Authorization", `Bearer ${token("ranger-1")}`)
        .expect(403);
      expect(res.body.success).toBe(false);
      expect(db.incident.findMany).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/analytics/kpis", () => {
    test("reports exact counts scoped to the manager's park", async () => {
      db.patrol.findMany.mockResolvedValue([
        patrolRow({ status: "SCHEDULED" }),
        patrolRow({ status: "SCHEDULED" }),
        patrolRow({ status: "IN_PROGRESS" }),
        patrolRow({ status: "COMPLETED" }),
      ]);
      db.incident.findMany.mockResolvedValue([
        incidentRow(),
        incidentRow(),
        incidentRow(),
        incidentRow(),
        incidentRow({ status: "VERIFIED" }),
      ]);
      db.communityReport.findMany.mockResolvedValue([
        reportRow(),
        reportRow({ reportType: "HUMAN_WILDLIFE_CONFLICT" }),
        reportRow({ reportType: "HUMAN_WILDLIFE_CONFLICT" }),
      ]);
      const res = await request(app)
        .get("/api/analytics/kpis")
        .set("Authorization", `Bearer ${token("manager")}`)
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.patrols).toEqual({
        total: 4,
        scheduled: 2,
        inProgress: 1,
        completed: 1,
        cancelled: 0,
      });
      // 5 incidents in the database must be reported as exactly 5.
      expect(res.body.data.incidents).toEqual({ total: 5 });
      expect(res.body.data.community).toEqual({
        total: 3,
        conflictCount: 2,
      });
      expect(db.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ parkId: "park-1" }),
        }),
      );
    });
  });

  describe("GET /api/analytics/incidents", () => {
    test("returns chart-ready trend and breakdowns", async () => {
      db.incident.findMany.mockResolvedValue([
        incidentRow(),
        incidentRow({ incidentType: "WILDLIFE_CONFLICT", status: "VERIFIED" }),
        incidentRow({ reportedAt: at("2026-11-02T03:30:00.000Z") }),
      ]);
      const res = await request(app)
        .get("/api/analytics/incidents?period=month&from=2026-10-01&to=2026-11-30")
        .set("Authorization", `Bearer ${token("manager")}`)
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.trend).toEqual([
        { bucket: "2026-10-01T00:00:00.000Z", label: "2026-10", count: 2 },
        { bucket: "2026-11-01T00:00:00.000Z", label: "2026-11", count: 1 },
      ]);
      expect(res.body.data.byStatus).toContainEqual({ key: "VERIFIED", count: 1 });
      expect(res.body.data.byType).toContainEqual({
        key: "WILDLIFE_CONFLICT",
        count: 1,
      });
    });

    test("passes filters into the database query", async () => {
      await request(app)
        .get(
          "/api/analytics/incidents?type=POACHING_SNARE&status=PENDING&from=2026-10-01&to=2026-10-31&area=weerawila",
        )
        .set("Authorization", `Bearer ${token("manager")}`);
      expect(db.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parkId: "park-1",
            incidentType: "POACHING_SNARE",
            status: "PENDING",
            reportedAt: {
              gte: at("2026-10-01T00:00:00.000Z"),
              lte: at("2026-10-31T00:00:00.000Z"),
            },
            manualLocation: { contains: "weerawila", mode: "insensitive" },
          }),
        }),
      );
    });
  });

  describe("GET /api/analytics/patrols", () => {
    test("returns patrol status distribution and priority breakdown", async () => {
      db.patrol.findMany.mockResolvedValue([
        patrolRow({ status: "IN_PROGRESS", priority: "HIGH" }),
        patrolRow({ status: "COMPLETED", priority: "HIGH" }),
        patrolRow({ status: "COMPLETED", priority: "LOW" }),
      ]);
      const res = await request(app)
        .get("/api/analytics/patrols")
        .set("Authorization", `Bearer ${token("manager")}`)
        .expect(200);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.byStatus).toEqual([
        { key: "COMPLETED", count: 2 },
        { key: "IN_PROGRESS", count: 1 },
      ]);
      expect(res.body.data.byPriority).toEqual([
        { key: "HIGH", count: 2 },
        { key: "LOW", count: 1 },
      ]);
    });
  });

  describe("GET /api/analytics/community-reports", () => {
    test("returns community trend, types, statuses and common areas", async () => {
      db.communityReport.findMany.mockResolvedValue([
        reportRow(),
        reportRow({ reportType: "HUMAN_WILDLIFE_CONFLICT", manualLocation: "Weerawila" }),
        reportRow({ reportType: "HUMAN_WILDLIFE_CONFLICT", manualLocation: "Weerawila", status: "VERIFIED" }),
      ]);
      const res = await request(app)
        .get("/api/analytics/community-reports")
        .set("Authorization", `Bearer ${token("manager")}`)
        .expect(200);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.conflictCount).toBe(2);
      expect(res.body.data.byArea).toEqual([
        { key: "Weerawila", count: 2 },
        { key: "Kataragama North", count: 1 },
      ]);
    });

    test("does not scope the community query by park (no park column on reports)", async () => {
      db.communityReport.findMany.mockResolvedValue([]);
      await request(app)
        .get("/api/analytics/community-reports")
        .set("Authorization", `Bearer ${token("manager")}`)
        .expect(200);
      expect(db.communityReport.findMany).toHaveBeenCalledWith(
        expect.not.objectContaining({
          where: expect.objectContaining({ parkId: expect.anything() }),
        }),
      );
    });
  });

  describe("validation", () => {
    test("400 for unknown incident type", async () => {
      const res = await request(app)
        .get("/api/analytics/incidents?type=DRONE_SIGHTING")
        .set("Authorization", `Bearer ${token("manager")}`)
        .expect(400);
      expect(res.body.errors.type).toBeTruthy();
    });

    test("400 for unknown status and period", async () => {
      const res = await request(app)
        .get("/api/analytics/patrols?status=RESPONDING&period=year")
        .set("Authorization", `Bearer ${token("manager")}`)
        .expect(400);
      expect(res.body.errors.status).toBeTruthy();
      expect(res.body.errors.period).toBeTruthy();
    });

    test("400 when the date range end precedes the start", async () => {
      const res = await request(app)
        .get("/api/analytics/incidents?from=2026-11-01&to=2026-10-01")
        .set("Authorization", `Bearer ${token("manager")}`)
        .expect(400);
      expect(res.body.errors.to).toBeTruthy();
    });
  });

  describe("empty data", () => {
    test("empty database produces zero metrics and empty series", async () => {
      const res = await request(app)
        .get("/api/analytics/incidents?from=2026-05-01&to=2026-05-31")
        .set("Authorization", `Bearer ${token("manager")}`)
        .expect(200);
      expect(res.body.data.total).toBe(0);
      // Bounded ranges return a zero-filled series; the empty state is total 0.
      expect(res.body.data.trend).toEqual([
        { bucket: "2026-05-01T00:00:00.000Z", label: "2026-05", count: 0 },
      ]);
      expect(res.body.data.byType).toEqual([]);
      expect(res.body.data.byStatus).toEqual([]);
    });
  });
});