const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../../src/config/database", () => ({
  user: { findUnique: jest.fn() },
  alert: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  alertAcknowledgement: {
    upsert: jest.fn(),
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

beforeEach(() => {
  process.env.JWT_SECRET = "isolated-alert-api-secret-key-at-least-32";
  accounts = {
    "user-1": {
      id: "user-1",
      name: "Kasun Jay",
      email: "kasun@example.test",
      role: "COMMUNITY_USER",
      approvalStatus: "APPROVED",
      isActive: true,
    },
    liaison: {
      id: "liaison",
      name: "Liaison Officer",
      email: "liaison@example.test",
      role: "COMMUNITY_LIAISON",
      approvalStatus: "APPROVED",
      isActive: true,
    },
  };

  db.user.findUnique.mockImplementation(async ({ where }) => accounts[where.id] || null);

  db.alert.findMany.mockResolvedValue([
    {
      id: "alert-1",
      riskLevel: "CRITICAL",
      message: "Elephant herd spotted crossing near residential perimeter.",
      status: "ACTIVE",
      generatedAt: new Date(),
      animal: { id: "anim-1", species: "Elephas maximus", animalCode: "ELE-01" },
      riskZone: { id: "zone-1", name: "Sector 3 Buffer", park: { id: "park-1", name: "Yala" } },
      acknowledgements: [{ userId: "user-1", acknowledgedAt: new Date() }],
    },
    {
      id: "alert-2",
      riskLevel: "MEDIUM",
      message: "Leopard track observed near northern waterhole.",
      status: "ACTIVE",
      generatedAt: new Date(),
      animal: { id: "anim-2", species: "Panthera pardus kotiya", animalCode: "LEO-02" },
      riskZone: { id: "zone-2", name: "Northern Ridge", park: { id: "park-1", name: "Yala" } },
      acknowledgements: [],
    },
  ]);

  db.alert.count.mockResolvedValue(2);
});

describe("Safety Alert APIs", () => {
  describe("GET /api/alerts (List Alerts)", () => {
    test("returns active alerts with safety instructions without auth", async () => {
      const res = await request(app).get("/api/alerts").expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.alerts).toHaveLength(2);
      expect(res.body.alerts[0].title).toContain("CRITICAL Wildlife Alert");
      expect(res.body.alerts[0].affectedArea).toContain("Sector 3 Buffer");
      expect(res.body.alerts[0].shortMessage).toBeDefined();
      expect(res.body.alerts[0].safetyInstructions).toBeDefined();
      expect(Array.isArray(res.body.alerts[0].safetyInstructions)).toBe(true);
      expect(res.body.alerts[0].isAcknowledged).toBe(false);
      expect(res.headers["cache-control"]).toBe("no-store");
    });

    test("computes isAcknowledged for authenticated user", async () => {
      const res = await request(app)
        .get("/api/alerts")
        .set("Authorization", `Bearer ${token("user-1")}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.alerts[0].isAcknowledged).toBe(true);
      expect(res.body.alerts[1].isAcknowledged).toBe(false);
    });

    test("accepts status=HISTORY filter and status=RESOLVED filter", async () => {
      const resHistory = await request(app).get("/api/alerts?status=HISTORY").expect(200);
      expect(resHistory.body.success).toBe(true);

      const resResolved = await request(app).get("/api/alerts?status=RESOLVED").expect(200);
      expect(resResolved.body.success).toBe(true);
    });

    test("rejects invalid riskLevel filter with 400", async () => {
      const res = await request(app).get("/api/alerts?riskLevel=EXTREME").expect(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid riskLevel filter.");
    });
  });

  describe("GET /api/alerts/:id (Alert Details)", () => {
    test("returns 404 when alert is not found", async () => {
      db.alert.findUnique.mockResolvedValue(null);
      await request(app).get("/api/alerts/nonexistent").expect(404);
    });

    test("returns alert details with safety instructions", async () => {
      db.alert.findUnique.mockResolvedValue({
        id: "alert-1",
        riskLevel: "CRITICAL",
        message: "Elephant herd spotted.",
        status: "ACTIVE",
        animal: { species: "Elephas maximus" },
        acknowledgements: [],
      });

      const res = await request(app).get("/api/alerts/alert-1").expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.alert.id).toBe("alert-1");
      expect(res.body.alert.title).toContain("CRITICAL Wildlife Alert");
      expect(res.body.alert.safetyInstructions).toBeDefined();
    });
  });

  describe("POST /api/alerts/:id/acknowledge (Acknowledge Alert)", () => {
    test("rejects unauthenticated request with 401", async () => {
      await request(app).post("/api/alerts/alert-1/acknowledge").expect(401);
      expect(db.alertAcknowledgement.upsert).not.toHaveBeenCalled();
    });

    test("records alert acknowledgement for authenticated user", async () => {
      db.alert.findUnique.mockResolvedValue({ id: "alert-1" });
      db.alertAcknowledgement.upsert.mockResolvedValue({
        id: "ack-1",
        alertId: "alert-1",
        userId: "user-1",
        acknowledgedAt: new Date(),
      });

      const res = await request(app)
        .post("/api/alerts/alert-1/acknowledge")
        .set("Authorization", `Bearer ${token("user-1")}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Alert acknowledged successfully.");
      expect(db.alertAcknowledgement.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { alertId_userId: { alertId: "alert-1", userId: "user-1" } },
        })
      );
    });

    test("returns 404 if acknowledging nonexistent alert", async () => {
      db.alert.findUnique.mockResolvedValue(null);

      await request(app)
        .post("/api/alerts/missing/acknowledge")
        .set("Authorization", `Bearer ${token("user-1")}`)
        .expect(404);
    });
  });

  describe("PATCH /api/alerts/:id/status (Liaison & Manager Status Update)", () => {
    test("forbids COMMUNITY_USER from updating alert status with 403", async () => {
      await request(app)
        .patch("/api/alerts/alert-1/status")
        .set("Authorization", `Bearer ${token("user-1")}`)
        .send({ status: "RESOLVED" })
        .expect(403);
    });

    test("allows COMMUNITY_LIAISON to update alert status to RESOLVED", async () => {
      db.alert.findUnique.mockResolvedValue({ id: "alert-1", status: "ACTIVE" });
      db.alert.update.mockResolvedValue({ id: "alert-1", status: "RESOLVED" });

      const res = await request(app)
        .patch("/api/alerts/alert-1/status")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({ status: "RESOLVED" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.alert.status).toBe("RESOLVED");
      expect(db.alert.update).toHaveBeenCalled();
    });
  });
});
