const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../../src/config/database", () => ({
  user: { findUnique: jest.fn() },
  communityReport: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  incident: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  park: {
    findFirst: jest.fn(),
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

const validReportPayload = (overrides = {}) => ({
  reportType: "WILDLIFE_SIGHTING",
  species: "Asian Elephant",
  description: "Herd of 3 elephants spotted near village tank.",
  manualLocation: "Kataragama North, near Weerawila tank",
  reporterName: "Sunil Silva",
  reporterPhone: "0771234567",
  evidence: [
    { fileUrl: "https://example.test/elephant.jpg", fileType: "image/jpeg" },
  ],
  ...overrides,
});

beforeEach(() => {
  process.env.JWT_SECRET = "isolated-community-report-api-secret-key-32";
  accounts = {
    "community-user-1": {
      id: "community-user-1",
      name: "Kamal Perera",
      email: "kamal@example.test",
      phone: "0711112233",
      role: "COMMUNITY_USER",
      approvalStatus: "APPROVED",
      isActive: true,
    },
    "community-user-2": {
      id: "community-user-2",
      name: "Nimal Fernando",
      email: "nimal@example.test",
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

  db.communityReport.create.mockImplementation(async ({ data }) => ({
    id: "report-101",
    status: "PENDING",
    submittedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...data,
    evidence: data.evidence?.create || [],
  }));

  db.communityReport.count.mockResolvedValue(1);
  db.park.findFirst.mockResolvedValue({ id: "park-yala", name: "Yala National Park" });
  db.incident.create.mockImplementation(async ({ data }) => ({
    id: "incident-from-report-1",
    status: "PENDING",
    syncStatus: "SYNCED",
    createdAt: new Date(),
    ...data,
  }));
});

describe("Community Report APIs", () => {
  describe("POST /api/community-reports (Submission)", () => {
    test("submits an anonymous report successfully", async () => {
      const res = await request(app)
        .post("/api/community-reports")
        .send(validReportPayload())
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Report submitted successfully.");
      expect(res.body.report.id).toBe("report-101");
      expect(res.body.report.status).toBe("PENDING");
      expect(res.body.report.reporterId).toBeNull();
      expect(db.communityReport.create).toHaveBeenCalledTimes(1);
    });

    test("submits an authenticated report and binds reporterId", async () => {
      const res = await request(app)
        .post("/api/community-reports")
        .set("Authorization", `Bearer ${token("community-user-1")}`)
        .send(validReportPayload({ reporterName: undefined, reporterPhone: undefined }))
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.report.reporterId).toBe("community-user-1");
      expect(res.body.report.reporterName).toBe("Kamal Perera");
    });

    test("rejects invalid report type", async () => {
      const res = await request(app)
        .post("/api/community-reports")
        .send(validReportPayload({ reportType: "INVALID_TYPE" }))
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors.reportType).toBe("Invalid report type selected.");
      expect(db.communityReport.create).not.toHaveBeenCalled();
    });

    test("rejects short or empty description", async () => {
      const res = await request(app)
        .post("/api/community-reports")
        .send(validReportPayload({ description: "bad" }))
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors.description).toBe("Provide a description of at least 5 characters.");
    });

    test("rejects whitespace-only description", async () => {
      const res = await request(app)
        .post("/api/community-reports")
        .send(validReportPayload({ description: "     " }))
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors.description).toBe("Provide a description of at least 5 characters.");
    });

    test("rejects when both manualLocation and GPS coordinates are missing", async () => {
      const res = await request(app)
        .post("/api/community-reports")
        .send(validReportPayload({ manualLocation: "", latitude: undefined, longitude: undefined }))
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors.location).toBe("Provide a location description or GPS coordinates.");
    });

    test("rejects partial coordinates when latitude is provided without longitude", async () => {
      const res = await request(app)
        .post("/api/community-reports")
        .send(validReportPayload({ manualLocation: "Village Sector 3", latitude: 6.543, longitude: undefined }))
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors.longitude).toBe("Longitude is required when latitude is provided.");
    });

    test("rejects out of range GPS coordinates", async () => {
      const res = await request(app)
        .post("/api/community-reports")
        .send(validReportPayload({ manualLocation: "Village Sector 3", latitude: 95.0, longitude: -190.0 }))
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors.latitude).toBe("Latitude must be a valid number between -90 and 90.");
      expect(res.body.errors.longitude).toBe("Longitude must be a valid number between -180 and 180.");
    });

    test("accepts valid GPS coordinates without manual location", async () => {
      const res = await request(app)
        .post("/api/community-reports")
        .send(validReportPayload({ manualLocation: "", latitude: 6.543, longitude: 80.987 }))
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.report.latitude).toBe(6.543);
      expect(res.body.report.longitude).toBe(80.987);
    });
  });

  describe("GET /api/community-reports/mine (Community Member History)", () => {
    test("rejects unauthenticated requests with 401", async () => {
      await request(app).get("/api/community-reports/mine").expect(401);
    });

    test("returns reports for the authenticated community user with cache-control no-store", async () => {
      db.communityReport.findMany.mockResolvedValue([
        { id: "rep-1", reporterId: "community-user-1", reportType: "WILDLIFE_SIGHTING", status: "PENDING" },
      ]);

      const res = await request(app)
        .get("/api/community-reports/mine")
        .set("Authorization", `Bearer ${token("community-user-1")}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.reports).toHaveLength(1);
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(db.communityReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ reporterId: "community-user-1" }),
        })
      );
    });

    test("forbids non-COMMUNITY_USER roles from calling /mine", async () => {
      await request(app)
        .get("/api/community-reports/mine")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .expect(403);
    });
  });

  describe("GET /api/community-reports (Liaison & Manager Review)", () => {
    test("forbids COMMUNITY_USER from accessing liaison list", async () => {
      await request(app)
        .get("/api/community-reports")
        .set("Authorization", `Bearer ${token("community-user-1")}`)
        .expect(403);
    });

    test("allows COMMUNITY_LIAISON to access report list", async () => {
      db.communityReport.findMany.mockResolvedValue([
        { id: "rep-1", reportType: "WILDLIFE_SIGHTING", status: "PENDING" },
      ]);

      const res = await request(app)
        .get("/api/community-reports")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.reports).toHaveLength(1);
    });

    test("allows PARK_MANAGER to access report list", async () => {
      db.communityReport.findMany.mockResolvedValue([]);
      const res = await request(app)
        .get("/api/community-reports")
        .set("Authorization", `Bearer ${token("manager")}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
    test("filters reports by status, reportType, and search query", async () => {
      db.communityReport.findMany.mockResolvedValue([
        { id: "rep-search-1", reportType: "HUMAN_WILDLIFE_CONFLICT", status: "UNDER_REVIEW" },
      ]);
      db.communityReport.count.mockResolvedValue(1);

      const res = await request(app)
        .get("/api/community-reports?status=UNDER_REVIEW&reportType=HUMAN_WILDLIFE_CONFLICT&search=elephant")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.reports).toHaveLength(1);
      expect(db.communityReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "UNDER_REVIEW",
            reportType: "HUMAN_WILDLIFE_CONFLICT",
            OR: expect.any(Array),
          }),
        })
      );
    });

    test("redacts anonymous reporter personal identity when listed for liaison", async () => {
      db.communityReport.findMany.mockResolvedValue([
        {
          id: "rep-anon-list",
          reportType: "SUSPICIOUS_ACTIVITY",
          isAnonymous: true,
          reporterName: "Secret Person",
          reporterPhone: "0771234567",
          status: "PENDING",
        },
      ]);
      db.communityReport.count.mockResolvedValue(1);

      const res = await request(app)
        .get("/api/community-reports")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.reports[0].isAnonymous).toBe(true);
      expect(res.body.reports[0].reporterName).toBeNull();
      expect(res.body.reports[0].reporterPhone).toBeNull();
    });
  });

  describe("PATCH /api/community-reports/:id/status (Status Transitions)", () => {
    test("allows COMMUNITY_LIAISON to transition PENDING to UNDER_REVIEW", async () => {
      db.communityReport.findUnique.mockResolvedValue({
        id: "rep-1",
        status: "PENDING",
      });
      db.communityReport.update.mockResolvedValue({
        id: "rep-1",
        status: "UNDER_REVIEW",
      });

      const res = await request(app)
        .patch("/api/community-reports/rep-1/status")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({ status: "UNDER_REVIEW" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.report.status).toBe("UNDER_REVIEW");
      expect(db.communityReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "rep-1" },
          data: { status: "UNDER_REVIEW" },
        })
      );
    });

    test("allows COMMUNITY_LIAISON to transition UNDER_REVIEW to RESPONSE_IN_PROGRESS", async () => {
      db.communityReport.findUnique.mockResolvedValue({
        id: "rep-1",
        status: "UNDER_REVIEW",
      });
      db.communityReport.update.mockResolvedValue({
        id: "rep-1",
        status: "RESPONSE_IN_PROGRESS",
      });

      const res = await request(app)
        .patch("/api/community-reports/rep-1/status")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({ status: "RESPONSE_IN_PROGRESS" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.report.status).toBe("RESPONSE_IN_PROGRESS");
    });

    test("allows COMMUNITY_LIAISON to flag invalid/duplicate report as REJECTED", async () => {
      db.communityReport.findUnique.mockResolvedValue({
        id: "rep-dup",
        status: "PENDING",
      });
      db.communityReport.update.mockResolvedValue({
        id: "rep-dup",
        status: "REJECTED",
      });

      const res = await request(app)
        .patch("/api/community-reports/rep-dup/status")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({ status: "REJECTED" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.report.status).toBe("REJECTED");
    });

    test("rejects arbitrary status strings with 400", async () => {
      db.communityReport.findUnique.mockResolvedValue({
        id: "rep-1",
        status: "PENDING",
      });

      const res = await request(app)
        .patch("/api/community-reports/rep-1/status")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({ status: "ARBITRARY_STATUS" })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Select a valid report status/);
    });

    test("rejects invalid status transition PENDING to RESOLVED with 400", async () => {
      db.communityReport.findUnique.mockResolvedValue({
        id: "rep-1",
        status: "PENDING",
      });

      const res = await request(app)
        .patch("/api/community-reports/rep-1/status")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({ status: "RESOLVED" })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Cannot transition report from PENDING to RESOLVED/);
      expect(db.communityReport.update).not.toHaveBeenCalled();
    });

    test("forbids COMMUNITY_USER from updating report status with 403", async () => {
      await request(app)
        .patch("/api/community-reports/rep-1/status")
        .set("Authorization", `Bearer ${token("community-user-1")}`)
        .send({ status: "UNDER_REVIEW" })
        .expect(403);
    });
  });

  describe("POST /api/community-reports/:id/escalate (Operational Escalation)", () => {
    test("allows COMMUNITY_LIAISON to escalate report to operational response", async () => {
      db.communityReport.findUnique.mockResolvedValue({
        id: "rep-esc-1",
        reportType: "HUMAN_WILDLIFE_CONFLICT",
        species: "Wild Elephant",
        description: "Elephant broke farm boundary fence",
        manualLocation: "Post 12",
        status: "PENDING",
        isAnonymous: false,
        evidence: [],
      });
      db.communityReport.update
        .mockResolvedValueOnce({ id: "rep-esc-1", status: "UNDER_REVIEW" })
        .mockResolvedValueOnce({
          id: "rep-esc-1",
          reportType: "HUMAN_WILDLIFE_CONFLICT",
          species: "Wild Elephant",
          description: "Elephant broke farm boundary fence",
          manualLocation: "Post 12",
          status: "RESPONSE_IN_PROGRESS",
          isAnonymous: false,
          evidence: [],
        });

      const res = await request(app)
        .post("/api/community-reports/rep-esc-1/escalate")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({ urgency: "HIGH", notes: "Immediate dispatch needed" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/escalated to operational response/);
      expect(res.body.escalation).toBeDefined();
      expect(res.body.escalation.reportId).toBe("rep-esc-1");
      expect(res.body.escalation.urgency).toBe("HIGH");
      expect(res.body.escalation.notes).toBe("Immediate dispatch needed");
      expect(res.body.escalation.escalatedBy.role).toBe("COMMUNITY_LIAISON");
      expect(res.body.report.status).toBe("RESPONSE_IN_PROGRESS");
    });

    test("forbids COMMUNITY_USER from escalating report with 403", async () => {
      await request(app)
        .post("/api/community-reports/rep-esc-1/escalate")
        .set("Authorization", `Bearer ${token("community-user-1")}`)
        .send({})
        .expect(403);
    });

    test("rejects unauthenticated requests to escalate with 401", async () => {
      await request(app)
        .post("/api/community-reports/rep-esc-1/escalate")
        .send({})
        .expect(401);
    });
  });

  describe("GET /api/community-reports/:id (Single Report Details)", () => {
    test("returns 404 when report does not exist", async () => {
      db.communityReport.findUnique.mockResolvedValue(null);

      await request(app)
        .get("/api/community-reports/missing-rep")
        .expect(404);
    });

    test("returns report details when found for unauthenticated guest report", async () => {
      db.communityReport.findUnique.mockResolvedValue({
        id: "rep-1",
        description: "Elephant spotted near road",
        status: "PENDING",
      });

      const res = await request(app)
        .get("/api/community-reports/rep-1")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.report.id).toBe("rep-1");
    });

    test("allows COMMUNITY_USER to view their own report details", async () => {
      db.communityReport.findUnique.mockResolvedValue({
        id: "rep-own",
        reportType: "WILDLIFE_SIGHTING",
        description: "Elephant spotted",
        status: "PENDING",
        reporterId: "community-user-1",
      });

      const res = await request(app)
        .get("/api/community-reports/rep-own")
        .set("Authorization", `Bearer ${token("community-user-1")}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.report.id).toBe("rep-own");
    });

    test("forbids COMMUNITY_USER from accessing another user's report (IDOR protection)", async () => {
      db.communityReport.findUnique.mockResolvedValue({
        id: "rep-other",
        reportType: "WILDLIFE_SIGHTING",
        description: "Elephant near fence",
        status: "PENDING",
        reporterId: "other-user-99",
      });

      await request(app)
        .get("/api/community-reports/rep-other")
        .set("Authorization", `Bearer ${token("community-user-1")}`)
        .expect(403);
    });

    test("forbids COMMUNITY_USER from accessing reports without reporterId", async () => {
      db.communityReport.findUnique.mockResolvedValue({
        id: "rep-guest",
        reportType: "WILDLIFE_SIGHTING",
        description: "Guest filed report",
        status: "PENDING",
        reporterId: null,
      });

      await request(app)
        .get("/api/community-reports/rep-guest")
        .set("Authorization", `Bearer ${token("community-user-1")}`)
        .expect(403);
    });

    test("forbids unauthenticated caller from accessing registered user's non-anonymous report", async () => {
      db.communityReport.findUnique.mockResolvedValue({
        id: "rep-registered",
        reportType: "WILDLIFE_SIGHTING",
        description: "Registered report",
        status: "PENDING",
        isAnonymous: false,
        reporterId: "community-user-1",
      });

      await request(app)
        .get("/api/community-reports/rep-registered")
        .expect(403);
    });
  });

  describe("POST /api/community-reports/:id/forward-incident (Chanuka Incident Response Integration)", () => {
    test("rejects unauthenticated request to forward with 401", async () => {
      await request(app)
        .post("/api/community-reports/rep-1/forward-incident")
        .send({})
        .expect(401);
    });

    test("forbids COMMUNITY_USER from forwarding report with 403", async () => {
      await request(app)
        .post("/api/community-reports/rep-1/forward-incident")
        .set("Authorization", `Bearer ${token("community-user-1")}`)
        .send({})
        .expect(403);
    });

    test("returns 404 when report does not exist", async () => {
      db.communityReport.findUnique.mockResolvedValue(null);

      await request(app)
        .post("/api/community-reports/missing-rep/forward-incident")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({})
        .expect(404);
    });

    test("rejects forwarding when report is already RESOLVED with 400", async () => {
      db.communityReport.findUnique.mockResolvedValue({
        id: "rep-res",
        status: "RESOLVED",
      });

      const res = await request(app)
        .post("/api/community-reports/rep-res/forward-incident")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({})
        .expect(400);

      expect(res.body.message).toMatch(/Cannot forward an already resolved community report/);
    });

    test("rejects forwarding when report is REJECTED with 400", async () => {
      db.communityReport.findUnique.mockResolvedValue({
        id: "rep-rej",
        status: "REJECTED",
      });

      const res = await request(app)
        .post("/api/community-reports/rep-rej/forward-incident")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({})
        .expect(400);

      expect(res.body.message).toMatch(/Cannot forward a rejected community report/);
    });

    test("forwards reviewed report to Incident Response, creating incident with preserved reference and location", async () => {
      db.communityReport.findUnique.mockResolvedValue({
        id: "rep-fwd-1",
        reportType: "HUMAN_WILDLIFE_CONFLICT",
        species: "Wild Elephant",
        description: "Elephant broke farm boundary fence",
        latitude: 6.273,
        longitude: 81.334,
        manualLocation: "Post 12, Katagamuwa",
        status: "UNDER_REVIEW",
        isAnonymous: false,
        reporterName: "Sunil Silva",
        reporterPhone: "0771234567",
        submittedAt: new Date("2026-10-08T08:00:00Z"),
        evidence: [
          { id: "ev-1", fileUrl: "https://example.test/damage.jpg", fileType: "image/jpeg" },
        ],
      });

      db.communityReport.update.mockResolvedValue({
        id: "rep-fwd-1",
        reportType: "HUMAN_WILDLIFE_CONFLICT",
        species: "Wild Elephant",
        description: "Elephant broke farm boundary fence",
        status: "RESPONSE_IN_PROGRESS",
        incidentId: "incident-from-report-1",
        forwardedAt: new Date(),
        forwardedById: "liaison",
        forwardingNotes: "Dispatched patrol unit to secure village border",
      });

      const res = await request(app)
        .post("/api/community-reports/rep-fwd-1/forward-incident")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({
          urgency: "HIGH",
          notes: "Dispatched patrol unit to secure village border",
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/forwarded to Incident Response successfully/);
      expect(res.body.report.status).toBe("RESPONSE_IN_PROGRESS");
      expect(res.body.incident).toBeDefined();
      expect(res.body.handoff.sourceReportId).toBe("rep-fwd-1");
      expect(res.body.handoff.targetDepartment).toBe("CONSERVATION_OPERATIONS");
      expect(res.body.handoff.status).toBe("DISPATCHED");
      expect(res.body.handoff.urgency).toBe("HIGH");

      // Verify incident creation arguments
      expect(db.incident.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            communityReportId: "rep-fwd-1",
            incidentType: "WILDLIFE_CONFLICT",
            latitude: 6.273,
            longitude: 81.334,
            reporterId: "liaison",
            status: "PENDING",
          }),
        })
      );
    });

    test("respects anonymous-report privacy by withholding reporter personal info from incident", async () => {
      db.communityReport.findUnique.mockResolvedValue({
        id: "rep-anon-fwd",
        reportType: "POACHING",
        species: "Spotted Deer",
        description: "Wire snares spotted along forest boundary",
        latitude: 6.301,
        longitude: 81.350,
        manualLocation: "Buffer zone sector 4",
        status: "UNDER_REVIEW",
        isAnonymous: true,
        reporterName: "Secret Whistleblower",
        reporterPhone: "0779998877",
        submittedAt: new Date("2026-10-08T09:00:00Z"),
        evidence: [],
      });

      db.communityReport.update.mockResolvedValue({
        id: "rep-anon-fwd",
        reportType: "POACHING",
        status: "RESPONSE_IN_PROGRESS",
        incidentId: "incident-from-report-1",
        isAnonymous: true,
      });

      const res = await request(app)
        .post("/api/community-reports/rep-anon-fwd/forward-incident")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({ notes: "Ranger patrol required immediately" })
        .expect(200);

      expect(res.body.success).toBe(true);
      // Privacy check: sanitized report output has no private reporter fields
      expect(res.body.report.reporterName).toBeNull();
      expect(res.body.report.reporterPhone).toBeNull();

      // Check incident description does not leak the whistleblower's real name/phone
      const createCall = db.incident.create.mock.calls[db.incident.create.mock.calls.length - 1][0];
      expect(createCall.data.description).toContain("Anonymous Community Reporter");
      expect(createCall.data.description).not.toContain("Secret Whistleblower");
      expect(createCall.data.description).not.toContain("0779998877");
      expect(createCall.data.incidentType).toBe("POACHING_SNARE");
    });

    test("prevents duplicate forwarding when report is already forwarded", async () => {
      db.incident.create.mockClear();

      db.communityReport.findUnique.mockResolvedValue({
        id: "rep-already-fwd",
        reportType: "HUMAN_WILDLIFE_CONFLICT",
        status: "RESPONSE_IN_PROGRESS",
        incidentId: "existing-incident-999",
        forwardedAt: new Date("2026-10-08T10:00:00Z"),
      });

      const res = await request(app)
        .post("/api/community-reports/rep-already-fwd/forward-incident")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({ urgency: "HIGH" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.alreadyForwarded).toBe(true);
      expect(res.body.incidentId).toBe("existing-incident-999");
      expect(res.body.message).toMatch(/already been forwarded/);
      // Verify db.incident.create was NOT called again
      expect(db.incident.create).not.toHaveBeenCalled();
    });
  });
});
