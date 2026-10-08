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
  process.env.JWT_SECRET = "anonymous-report-test-secret-key-32";
  accounts = {
    "comm-user-1": {
      id: "comm-user-1",
      name: "Kamal Perera",
      email: "kamal@example.test",
      phone: "0711112233",
      role: "COMMUNITY_USER",
      approvalStatus: "APPROVED",
      isActive: true,
    },
    "comm-user-2": {
      id: "comm-user-2",
      name: "Nimal Fernando",
      email: "nimal@example.test",
      phone: "0722223344",
      role: "COMMUNITY_USER",
      approvalStatus: "APPROVED",
      isActive: true,
    },
    liaison: {
      id: "liaison-1",
      name: "Liaison Officer",
      role: "COMMUNITY_LIAISON",
      approvalStatus: "APPROVED",
      isActive: true,
    },
  };

  db.user.findUnique.mockImplementation(async ({ where }) => accounts[where.id] || null);

  db.communityReport.create.mockImplementation(async ({ data }) => ({
    id: "rep-anon-1",
    status: "PENDING",
    submittedAt: new Date("2026-10-08T09:00:00Z"),
    createdAt: new Date("2026-10-08T09:00:00Z"),
    updatedAt: new Date("2026-10-08T09:00:00Z"),
    ...data,
    evidence: [],
  }));
});

describe("Task 6: Anonymous Community Reporting APIs", () => {
  describe("Report Submission (Identified vs Anonymous)", () => {
    test("submits an identified report (isAnonymous: false) preserving authenticated user identity", async () => {
      const res = await request(app)
        .post("/api/community-reports")
        .set("Authorization", `Bearer ${token("comm-user-1")}`)
        .send({
          reportType: "WILDLIFE_SIGHTING",
          species: "Asian Elephant",
          description: "Elephant group grazing near boundary canal.",
          manualLocation: "Weerawila South canal bank",
          isAnonymous: false,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.report.id).toBe("rep-anon-1");
      expect(res.body.report.isAnonymous).toBe(false);
      expect(res.body.report.reporterName).toBe("Kamal Perera");
      expect(res.body.report.reporterPhone).toBe("0711112233");
      expect(res.body.report.status).toBe("PENDING");

      // Verify repository was called with correct ownership and identity
      expect(db.communityReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isAnonymous: false,
            reporterId: "comm-user-1",
            reporterName: "Kamal Perera",
            reporterPhone: "0711112233",
          }),
        })
      );
    });

    test("submits an anonymous report (isAnonymous: true) masking reporter identity while preserving internal tracking", async () => {
      const res = await request(app)
        .post("/api/community-reports")
        .set("Authorization", `Bearer ${token("comm-user-1")}`)
        .send({
          reportType: "SUSPICIOUS_ACTIVITY",
          description: "Wire snare trap spotted attached to fence pole.",
          manualLocation: "Boundary fence post 14",
          isAnonymous: true,
          reporterName: "Should Be Ignored",
          reporterPhone: "0770000000",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.report.isAnonymous).toBe(true);
      expect(res.body.report.reporterName).toBeNull();
      expect(res.body.report.reporterPhone).toBeNull();
      expect(res.body.report.description).toBe("Wire snare trap spotted attached to fence pole.");
      expect(res.body.report.status).toBe("PENDING");

      // Verify repository recorded isAnonymous=true with sanitized name/phone and preserved reporterId
      expect(db.communityReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isAnonymous: true,
            reporterId: "comm-user-1",
            reporterName: null,
            reporterPhone: null,
          }),
        })
      );
    });

    test("prevents client manipulation of reporterId and ignores client-provided reporter identity on anonymous reports", async () => {
      const res = await request(app)
        .post("/api/community-reports")
        .set("Authorization", `Bearer ${token("comm-user-1")}`)
        .send({
          reportType: "HUMAN_WILDLIFE_CONFLICT",
          description: "Crop damage by wild boars in private compound.",
          manualLocation: "Palatupana road village block",
          isAnonymous: true,
          reporterId: "forged-id-12345",
          reporter_id: "another-forged-id",
          reporterName: "Fake Reporter Name",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.report.isAnonymous).toBe(true);
      expect(res.body.report.reporterName).toBeNull();

      // Ensure reporterId is set strictly by the server session, never from client request body
      expect(db.communityReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reporterId: "comm-user-1",
            reporterName: null,
          }),
        })
      );
    });
  });

  describe("API Responses Respecting Anonymity", () => {
    test("redacts reporter personal identity when anonymous report is viewed by normal viewer", async () => {
      db.communityReport.findUnique.mockResolvedValueOnce({
        id: "rep-anon-99",
        reportType: "WILDLIFE_SIGHTING",
        description: "Solitary bull elephant moving towards road.",
        manualLocation: "Milepost 12",
        status: "PENDING",
        isAnonymous: true,
        reporterId: "comm-user-1",
        reporterName: null,
        reporterPhone: null,
        reporter: { id: "comm-user-1", name: "Kamal Perera", role: "COMMUNITY_USER" },
        evidence: [],
      });

      // Anonymous public / normal request
      const res = await request(app)
        .get("/api/community-reports/rep-anon-99")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.report.isAnonymous).toBe(true);
      expect(res.body.report.reporterName).toBeNull();
      expect(res.body.report.reporterPhone).toBeNull();
      expect(res.body.report.reporterId).toBeNull();
      expect(res.body.report.reporter).toBeNull();
      // Public fields are present
      expect(res.body.report.description).toBe("Solitary bull elephant moving towards road.");
      expect(res.body.report.manualLocation).toBe("Milepost 12");
      expect(res.body.report.status).toBe("PENDING");
    });

    test("redacts personal identity for liaison staff viewing anonymous reports", async () => {
      db.communityReport.findUnique.mockResolvedValueOnce({
        id: "rep-anon-99",
        reportType: "WILDLIFE_SIGHTING",
        description: "Solitary bull elephant moving towards road.",
        manualLocation: "Milepost 12",
        status: "PENDING",
        isAnonymous: true,
        reporterId: "comm-user-1",
        reporterName: null,
        reporterPhone: null,
        reporter: { id: "comm-user-1", name: "Kamal Perera", role: "COMMUNITY_USER" },
        evidence: [],
      });

      const res = await request(app)
        .get("/api/community-reports/rep-anon-99")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.report.isAnonymous).toBe(true);
      expect(res.body.report.reporterName).toBeNull();
      expect(res.body.report.reporterPhone).toBeNull();
      expect(res.body.report.reporter).toBeNull();
    });

    test("allows authenticated user to track their anonymous reports under /mine", async () => {
      db.communityReport.findMany.mockResolvedValueOnce([
        {
          id: "rep-anon-1",
          reportType: "SUSPICIOUS_ACTIVITY",
          description: "Illegal snare trap",
          isAnonymous: true,
          status: "UNDER_REVIEW",
          reporterId: "comm-user-1",
          reporterName: null,
          reporterPhone: null,
          evidence: [],
        },
        {
          id: "rep-ident-2",
          reportType: "WILDLIFE_SIGHTING",
          description: "Elephant herd",
          isAnonymous: false,
          status: "VERIFIED",
          reporterId: "comm-user-1",
          reporterName: "Kamal Perera",
          reporterPhone: "0711112233",
          evidence: [],
        },
      ]);
      db.communityReport.count.mockResolvedValueOnce(2);

      const res = await request(app)
        .get("/api/community-reports/mine")
        .set("Authorization", `Bearer ${token("comm-user-1")}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.reports).toHaveLength(2);
      expect(res.body.reports[0].isAnonymous).toBe(true);
      expect(res.body.reports[0].reporterName).toBeNull();
      expect(res.body.reports[1].isAnonymous).toBe(false);
      expect(res.body.reports[1].reporterName).toBe("Kamal Perera");
    });
  });
});
