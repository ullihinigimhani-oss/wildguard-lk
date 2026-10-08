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

    test("rejects invalid alert ID format with 400", async () => {
      const res = await request(app).get("/api/alerts/%20%20").expect(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid alert ID format.");
    });

    test("returns sanitized alert details with instructions, location coordinates, and no leaked user IDs", async () => {
      db.alert.findUnique.mockResolvedValue({
        id: "alert-1",
        riskLevel: "CRITICAL",
        message: "Elephant herd spotted near southern boundary.",
        status: "ACTIVE",
        generatedAt: new Date(),
        updatedAt: new Date(),
        animal: { species: "Elephas maximus", animalCode: "ELE-01", name: "Raja" },
        riskZone: {
          id: "zone-1",
          name: "Sector 3 Buffer",
          centerLatitude: 6.35,
          centerLongitude: 81.42,
          radiusMeters: 500,
          park: { id: "park-1", name: "Yala" },
        },
        acknowledgements: [{ userId: "secret-user-99", acknowledgedAt: new Date() }],
      });

      const res = await request(app).get("/api/alerts/alert-1").expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.alert.id).toBe("alert-1");
      expect(res.body.alert.title).toContain("CRITICAL Wildlife Alert");
      expect(res.body.alert.alertType).toBe("WILDLIFE_PROXIMITY");
      expect(res.body.alert.severity).toBe("CRITICAL");
      expect(res.body.alert.location.hasCoordinates).toBe(true);
      expect(res.body.alert.location.latitude).toBe(6.35);
      expect(res.body.alert.location.longitude).toBe(81.42);
      expect(res.body.alert.location.radiusMeters).toBe(500);

      // Verify sanitization: no raw acknowledgements or secret user IDs leaked
      expect(res.body.alert.acknowledgements).toBeUndefined();
      expect(res.body.alert.acknowledgementCount).toBe(1);

      // Verify clear, readable safety instructions
      expect(Array.isArray(res.body.alert.safetyInstructions)).toBe(true);
      const instructionsText = res.body.alert.safetyInstructions.join(" ");
      expect(instructionsText).toContain("Stay away from the affected perimeter area");
      expect(instructionsText).toContain("Do not approach");
      expect(instructionsText).toContain("Keep children");
      expect(instructionsText).toContain("Sector 3 Buffer");
    });

    test("returns resolved alert details with isResolved=true and resolvedAt", async () => {
      const resolvedDate = new Date();
      db.alert.findUnique.mockResolvedValue({
        id: "alert-resolved",
        riskLevel: "MEDIUM",
        message: "Deer herd moved back into core sanctuary.",
        status: "RESOLVED",
        resolvedAt: resolvedDate,
        acknowledgements: [],
      });

      const res = await request(app).get("/api/alerts/alert-resolved").expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.alert.status).toBe("RESOLVED");
      expect(res.body.alert.isResolved).toBe(true);
      expect(res.body.alert.isExpired).toBe(true);
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
