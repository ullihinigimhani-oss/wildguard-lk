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
    manager: {
      id: "manager",
      name: "Park Manager",
      email: "manager@example.test",
      role: "PARK_MANAGER",
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

  describe("GET /api/alerts/unread-count (Unread Counter)", () => {
    test("returns active unread count for unauthenticated visitor", async () => {
      db.alert.count.mockResolvedValue(2);
      const res = await request(app).get("/api/alerts/unread-count").expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.unreadCount).toBe(2);
      expect(res.headers["cache-control"]).toBe("no-store");
    });

    test("computes user-specific unread count excluding acknowledged alerts", async () => {
      db.alert.count.mockResolvedValue(1);
      const res = await request(app)
        .get("/api/alerts/unread-count")
        .set("Authorization", `Bearer ${token("user-1")}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.unreadCount).toBe(1);
      expect(db.alert.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "ACTIVE",
            acknowledgements: { none: { userId: "user-1" } },
          }),
        })
      );
    });
  });

  describe("POST /api/alerts/:id/read (Mark as Read - User-Specific)", () => {
    test("rejects unauthenticated request with 401", async () => {
      await request(app).post("/api/alerts/alert-1/read").expect(401);
      expect(db.alertAcknowledgement.upsert).not.toHaveBeenCalled();
    });

    test("rejects invalid alert ID with 400", async () => {
      const res = await request(app)
        .post("/api/alerts/%20%20/read")
        .set("Authorization", `Bearer ${token("user-1")}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid alert ID format.");
    });

    test("persists user-specific read receipt without modifying global alert status", async () => {
      db.alert.findUnique.mockResolvedValue({ id: "alert-1", status: "ACTIVE" });
      const now = new Date();
      db.alertAcknowledgement.upsert.mockResolvedValue({
        id: "ack-1",
        alertId: "alert-1",
        userId: "user-1",
        acknowledgedAt: now,
      });

      const res = await request(app)
        .post("/api/alerts/alert-1/read")
        .set("Authorization", `Bearer ${token("user-1")}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Alert marked as read.");
      expect(res.body.isRead).toBe(true);
      expect(res.body.alertId).toBe("alert-1");
      expect(res.body.userId).toBe("user-1");
      expect(res.body.readAt).toBeDefined();

      // Confirms user-specific isolation: global alert table is NOT updated
      expect(db.alert.update).not.toHaveBeenCalled();

      // Confirms unique upsert pattern prevents duplicate records
      expect(db.alertAcknowledgement.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { alertId_userId: { alertId: "alert-1", userId: "user-1" } },
        })
      );
    });

    test("returns 404 for nonexistent alert", async () => {
      db.alert.findUnique.mockResolvedValue(null);

      await request(app)
        .post("/api/alerts/missing/read")
        .set("Authorization", `Bearer ${token("user-1")}`)
        .expect(404);
    });
  });

  describe("POST /api/alerts/read-all (Mark All As Read)", () => {
    test("rejects unauthenticated request with 401", async () => {
      await request(app).post("/api/alerts/read-all").expect(401);
    });

    test("marks all active alerts as read for user", async () => {
      db.alert.findMany.mockResolvedValue([{ id: "alert-1" }, { id: "alert-2" }]);
      db.alertAcknowledgement.upsert.mockResolvedValue({ id: "ack" });

      const res = await request(app)
        .post("/api/alerts/read-all")
        .set("Authorization", `Bearer ${token("user-1")}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("All active alerts marked as read.");
      expect(db.alertAcknowledgement.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe("POST /api/alerts/:id/acknowledge (Acknowledge Alert)", () => {
    test("rejects unauthenticated request with 401", async () => {
      await request(app).post("/api/alerts/alert-1/acknowledge").expect(401);
      expect(db.alertAcknowledgement.upsert).not.toHaveBeenCalled();
    });

    test("records alert acknowledgement for authenticated user and sets state to ACKNOWLEDGED", async () => {
      const now = new Date();
      db.alert.findUnique.mockResolvedValue({ id: "alert-1", status: "ACTIVE", acknowledgements: [] });
      db.alertAcknowledgement.upsert.mockResolvedValue({
        id: "ack-1",
        alertId: "alert-1",
        userId: "user-1",
        readAt: now,
        acknowledgedAt: now,
      });

      const res = await request(app)
        .post("/api/alerts/alert-1/acknowledge")
        .set("Authorization", `Bearer ${token("user-1")}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Alert acknowledged successfully.");
      expect(res.body.isAcknowledged).toBe(true);
      expect(res.body.acknowledgedAt).toBeDefined();
      expect(res.body.isRead).toBe(true);
      expect(res.body.userState).toBe("ACKNOWLEDGED");
      expect(res.body.alreadyAcknowledged).toBe(false);
      expect(db.alertAcknowledgement.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { alertId_userId: { alertId: "alert-1", userId: "user-1" } },
        })
      );
    });

    test("prevents duplicate acknowledgement and preserves original timestamp", async () => {
      const existingTime = new Date("2026-10-08T10:00:00.000Z");
      db.alert.findUnique.mockResolvedValue({
        id: "alert-1",
        status: "ACTIVE",
        acknowledgements: [{ userId: "user-1", readAt: existingTime, acknowledgedAt: existingTime }],
      });

      const res = await request(app)
        .post("/api/alerts/alert-1/acknowledge")
        .set("Authorization", `Bearer ${token("user-1")}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Alert has already been acknowledged.");
      expect(res.body.alreadyAcknowledged).toBe(true);
      expect(res.body.isAcknowledged).toBe(true);
      expect(res.body.acknowledgedAt).toBe(existingTime.toISOString());
      expect(res.body.userState).toBe("ACKNOWLEDGED");
      // Verify upsert was not called again since alert was already acknowledged
      expect(db.alertAcknowledgement.upsert).not.toHaveBeenCalled();
    });

    test("rejects acknowledgement when alert is RESOLVED (not applicable)", async () => {
      db.alert.findUnique.mockResolvedValue({
        id: "alert-resolved",
        status: "RESOLVED",
        resolvedAt: new Date(),
        acknowledgements: [],
      });

      const res = await request(app)
        .post("/api/alerts/alert-resolved/acknowledge")
        .set("Authorization", `Bearer ${token("user-1")}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Acknowledgement is not applicable for resolved alerts.");
      expect(db.alertAcknowledgement.upsert).not.toHaveBeenCalled();
    });

    test("rejects acknowledgement when alert is expired (older than 72 hours)", async () => {
      const ancientDate = new Date(Date.now() - 80 * 60 * 60 * 1000);
      db.alert.findUnique.mockResolvedValue({
        id: "alert-expired",
        status: "ACTIVE",
        generatedAt: ancientDate,
        acknowledgements: [],
      });

      const res = await request(app)
        .post("/api/alerts/alert-expired/acknowledge")
        .set("Authorization", `Bearer ${token("user-1")}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Acknowledgement is not applicable for expired alerts.");
      expect(db.alertAcknowledgement.upsert).not.toHaveBeenCalled();
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

  describe("GET /api/alerts/attention (Alerts Requiring Operational Attention)", () => {
    test("rejects unauthenticated request with 401", async () => {
      await request(app).get("/api/alerts/attention").expect(401);
    });

    test("forbids COMMUNITY_USER from viewing operational attention alerts with 403", async () => {
      await request(app)
        .get("/api/alerts/attention")
        .set("Authorization", `Bearer ${token("user-1")}`)
        .expect(403);
    });

    test("allows COMMUNITY_LIAISON to view alerts requiring attention", async () => {
      const res = await request(app)
        .get("/api/alerts/attention")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.alerts)).toBe(true);
      expect(res.body.alerts).toHaveLength(2);
      expect(res.body.total).toBe(2);
      expect(res.headers["cache-control"]).toBe("no-store");
    });

    test("allows PARK_MANAGER to view alerts requiring attention", async () => {
      const res = await request(app)
        .get("/api/alerts/attention")
        .set("Authorization", `Bearer ${token("manager")}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.alerts).toHaveLength(2);
    });
  });

  describe("POST /api/alerts/:id/respond (Operational Alert Response)", () => {
    test("rejects unauthenticated request with 401", async () => {
      await request(app)
        .post("/api/alerts/alert-1/respond")
        .send({ responseNote: "Community perimeter notified and flares deployed." })
        .expect(401);
    });

    test("forbids COMMUNITY_USER from responding to alerts with 403", async () => {
      const res = await request(app)
        .post("/api/alerts/alert-1/respond")
        .set("Authorization", `Bearer ${token("user-1")}`)
        .send({ responseNote: "Community perimeter notified." })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("permission");
    });

    test("returns 404 when alert does not exist", async () => {
      db.alert.findUnique.mockResolvedValue(null);

      await request(app)
        .post("/api/alerts/missing/respond")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({ responseNote: "Perimeter check conducted." })
        .expect(404);
    });

    test("rejects response when alert is already RESOLVED with 400", async () => {
      db.alert.findUnique.mockResolvedValue({
        id: "alert-1",
        status: "RESOLVED",
        resolvedAt: new Date(),
      });

      const res = await request(app)
        .post("/api/alerts/alert-1/respond")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({ responseNote: "Attempting to respond to resolved alert." })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Cannot respond to a resolved alert.");
    });

    test("rejects response when alert is expired (>72 hours) with 400", async () => {
      db.alert.findUnique.mockResolvedValue({
        id: "alert-1",
        status: "ACTIVE",
        generatedAt: new Date(Date.now() - 80 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post("/api/alerts/alert-1/respond")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({ responseNote: "Attempting to respond to old alert." })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Cannot respond to an expired alert.");
    });

    test("rejects response note shorter than 5 characters with 400", async () => {
      db.alert.findUnique.mockResolvedValue({
        id: "alert-1",
        status: "ACTIVE",
        generatedAt: new Date(),
      });

      const res = await request(app)
        .post("/api/alerts/alert-1/respond")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({ responseNote: "ok" })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("between 5 and 1000 characters");
    });

    test("rejects invalid status transitions with 400", async () => {
      db.alert.findUnique.mockResolvedValue({
        id: "alert-1",
        status: "ACKNOWLEDGED",
        generatedAt: new Date(),
      });

      const res = await request(app)
        .post("/api/alerts/alert-1/respond")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({ status: "ACTIVE" })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Cannot revert an acknowledged alert to active");
    });

    test("allows COMMUNITY_LIAISON to acknowledge responsibility and record response note", async () => {
      db.alert.findUnique.mockResolvedValue({
        id: "alert-1",
        status: "ACTIVE",
        riskLevel: "CRITICAL",
        message: "Elephant herd near border.",
        generatedAt: new Date(),
        animal: { species: "Elephas maximus" },
        riskZone: { name: "Sector 3 Buffer", park: { name: "Yala" } },
      });

      const now = new Date();
      db.alert.update.mockResolvedValue({
        id: "alert-1",
        status: "ACKNOWLEDGED",
        riskLevel: "CRITICAL",
        message: "Elephant herd near border.",
        generatedAt: new Date(),
        responseNote: "Liaison established contact with village committee; flares distributed.",
        respondedById: "liaison",
        respondedAt: now,
        responder: { id: "liaison", name: "Liaison Officer", role: "COMMUNITY_LIAISON" },
        animal: { species: "Elephas maximus" },
        riskZone: { name: "Sector 3 Buffer", park: { name: "Yala" } },
      });

      const res = await request(app)
        .post("/api/alerts/alert-1/respond")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({
          responseNote: "Liaison established contact with village committee; flares distributed.",
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Operational response recorded successfully.");
      expect(res.body.alert.status).toBe("ACKNOWLEDGED");
      expect(res.body.alert.responseNote).toContain("flares distributed");
      expect(res.body.alert.responder.name).toBe("Liaison Officer");
      expect(res.body.alert.isResponded).toBe(true);
      expect(db.alert.update).toHaveBeenCalled();
    });

    test("detects duplicate response without redundant update", async () => {
      const existingNote = "Liaison established contact with village committee; flares distributed.";
      db.alert.findUnique.mockResolvedValue({
        id: "alert-1",
        status: "ACKNOWLEDGED",
        responseNote: existingNote,
        respondedById: "liaison",
        generatedAt: new Date(),
      });

      const res = await request(app)
        .post("/api/alerts/alert-1/respond")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({ responseNote: existingNote })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.alreadyResponded).toBe(true);
      expect(res.body.message).toBe("Response already recorded.");
    });
  });

  describe("POST /api/alerts/:id/forward (Handoff / Forward to Ranger or Manager)", () => {
    test("rejects unauthenticated request with 401", async () => {
      await request(app)
        .post("/api/alerts/alert-1/forward")
        .send({ forwardTo: "RANGER" })
        .expect(401);
    });

    test("forbids COMMUNITY_USER from forwarding alerts with 403", async () => {
      await request(app)
        .post("/api/alerts/alert-1/forward")
        .set("Authorization", `Bearer ${token("user-1")}`)
        .send({ forwardTo: "RANGER" })
        .expect(403);
    });

    test("rejects invalid forward target with 400", async () => {
      db.alert.findUnique.mockResolvedValue({
        id: "alert-1",
        status: "ACTIVE",
        generatedAt: new Date(),
      });

      const res = await request(app)
        .post("/api/alerts/alert-1/forward")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({ forwardTo: "POLICE" })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Permitted targets: RANGER, PARK_MANAGER");
    });

    test("forwards alert to RANGER with clear handoff payload without duplicating Ranger dispatch", async () => {
      db.alert.findUnique.mockResolvedValue({
        id: "alert-1",
        status: "ACTIVE",
        riskLevel: "CRITICAL",
        message: "Elephant herd spotted near northern boundary.",
        generatedAt: new Date(),
        animal: { id: "anim-1", species: "Elephas maximus", animalCode: "ELE-01", name: "Raja" },
        riskZone: { name: "Sector 3 Buffer", park: { name: "Yala" } },
      });

      const now = new Date();
      db.alert.update.mockResolvedValue({
        id: "alert-1",
        status: "ACKNOWLEDGED",
        riskLevel: "CRITICAL",
        message: "Elephant herd spotted near northern boundary.",
        generatedAt: new Date(),
        responseNote: "Escalated to Ranger patrol for immediate ground containment.",
        respondedById: "liaison",
        respondedAt: now,
        forwardedTo: "RANGER",
        forwardedAt: now,
        responder: { id: "liaison", name: "Liaison Officer", role: "COMMUNITY_LIAISON" },
        animal: { id: "anim-1", species: "Elephas maximus", animalCode: "ELE-01", name: "Raja" },
        riskZone: { name: "Sector 3 Buffer", park: { name: "Yala" } },
      });

      const res = await request(app)
        .post("/api/alerts/alert-1/forward")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({
          forwardTo: "RANGER",
          note: "Escalated to Ranger patrol for immediate ground containment.",
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Alert forwarded to RANGER successfully.");
      expect(res.body.alert.forwardedTo).toBe("RANGER");
      expect(res.body.alert.isForwarded).toBe(true);

      // Verify clear handoff integration contract
      expect(res.body.handoff).toBeDefined();
      expect(res.body.handoff.alertId).toBe("alert-1");
      expect(res.body.handoff.handoffTarget).toBe("RANGER");
      expect(res.body.handoff.urgency).toBe("IMMEDIATE");
      expect(res.body.handoff.riskLevel).toBe("CRITICAL");
      expect(res.body.handoff.affectedArea).toContain("Sector 3 Buffer");
      expect(res.body.handoff.forwardedBy.role).toBe("COMMUNITY_LIAISON");
      expect(res.body.handoff.recommendedAction).toContain("Mobilize ground patrol");
    });

    test("detects duplicate forward if already forwarded to same target", async () => {
      db.alert.findUnique.mockResolvedValue({
        id: "alert-1",
        status: "ACKNOWLEDGED",
        forwardedTo: "RANGER",
        responseNote: "Already escalated to Ranger.",
        generatedAt: new Date(),
      });

      const res = await request(app)
        .post("/api/alerts/alert-1/forward")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({ forwardTo: "RANGER", note: "Already escalated to Ranger." })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.alreadyForwarded).toBe(true);
      expect(res.body.message).toContain("already been forwarded to RANGER");
    });
  });
});

