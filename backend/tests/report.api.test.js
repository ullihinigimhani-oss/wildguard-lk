// Report API Integration Tests
// Tests report endpoints with authentication and authorization

const request = require("supertest");
const app = require("../src/app");
const db = require("../src/config/database");
const jwt = require("jsonwebtoken");

describe("Report API", () => {
  let testPark;
  let parkManager;
  let managerToken;
  let ranger;
  let rangerToken;

  beforeAll(async () => {
    // Set JWT secret
    process.env.JWT_SECRET = "test-report-api-secret-key";

    // Create test park
    testPark = await db.park.create({
      data: {
        name: "Test Park for Reports",
        location: "Test Location",
      },
    });

    // Create park manager
    parkManager = await db.user.create({
      data: {
        name: "Report Test Manager",
        email: `report-manager-${Date.now()}@test.com`,
        passwordHash: "test-hash",
        role: "PARK_MANAGER",
        parkId: testPark.id,
        approvalStatus: "APPROVED",
      },
    });

    // Create ranger (unauthorized for reports)
    ranger = await db.user.create({
      data: {
        name: "Report Test Ranger",
        email: `report-ranger-${Date.now()}@test.com`,
        passwordHash: "test-hash",
        role: "RANGER",
        parkId: testPark.id,
        approvalStatus: "APPROVED",
      },
    });

    // Generate tokens with correct format
    managerToken = jwt.sign(
      {},
      process.env.JWT_SECRET,
      {
        subject: parkManager.id,
        issuer: "wildguard-lk",
        audience: "wildguard-web",
        expiresIn: "1h",
      }
    );
    rangerToken = jwt.sign(
      {},
      process.env.JWT_SECRET,
      {
        subject: ranger.id,
        issuer: "wildguard-lk",
        audience: "wildguard-web",
        expiresIn: "1h",
      }
    );
  });

  afterAll(async () => {
    // Cleanup
    await db.user.deleteMany({
      where: {
        email: {
          contains: "report-",
        },
      },
    });
    await db.park.deleteMany({
      where: { name: "Test Park for Reports" },
    });
  });

  describe("GET /api/reports/types", () => {
    it("should return available report types", async () => {
      const response = await request(app)
        .get("/api/reports/types")
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(3);
      expect(response.body.data[0]).toHaveProperty("type");
      expect(response.body.data[0]).toHaveProperty("name");
      expect(response.body.data[0]).toHaveProperty("description");
      expect(response.body.data[0]).toHaveProperty("filters");
    });

    it("should require authentication", async () => {
      await request(app).get("/api/reports/types").expect(401);
    });

    it("should require PARK_MANAGER role", async () => {
      await request(app)
        .get("/api/reports/types")
        .set("Authorization", `Bearer ${rangerToken}`)
        .expect(403);
    });
  });

  describe("GET /api/reports/generate", () => {
    it("should generate incident report", async () => {
      const response = await request(app)
        .get("/api/reports/generate")
        .query({
          reportType: "INCIDENT",
          from: "2025-01-01",
          to: "2025-12-31",
        })
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reportType).toBe("INCIDENT_REPORT");
      expect(response.body.data.generatedBy.name).toBe(parkManager.name);
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.incidents).toBeInstanceOf(Array);
    });

    it("should generate patrol report", async () => {
      const response = await request(app)
        .get("/api/reports/generate")
        .query({
          reportType: "PATROL",
          from: "2025-01-01",
          to: "2025-12-31",
        })
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reportType).toBe("PATROL_OPERATIONS_REPORT");
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.patrols).toBeInstanceOf(Array);
    });

    it("should generate conflict trend report", async () => {
      const response = await request(app)
        .get("/api/reports/generate")
        .query({
          reportType: "CONFLICT_TREND",
          from: "2025-01-01",
          to: "2025-12-31",
        })
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reportType).toBe("CONFLICT_TREND_REPORT");
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.reports).toBeInstanceOf(Array);
    });

    it("should handle missing reportType parameter", async () => {
      const response = await request(app)
        .get("/api/reports/generate")
        .query({
          from: "2025-01-01",
          to: "2025-12-31",
        })
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it("should handle invalid reportType", async () => {
      const response = await request(app)
        .get("/api/reports/generate")
        .query({
          reportType: "INVALID",
          from: "2025-01-01",
          to: "2025-12-31",
        })
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it("should apply date filters", async () => {
      const response = await request(app)
        .get("/api/reports/generate")
        .query({
          reportType: "INCIDENT",
          from: "2025-06-01",
          to: "2025-06-30",
        })
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.data.filters.dateFrom).toBeDefined();
      expect(response.body.data.filters.dateTo).toBeDefined();
    });

    it("should apply type filter", async () => {
      const response = await request(app)
        .get("/api/reports/generate")
        .query({
          reportType: "INCIDENT",
          type: "POACHING_SNARE",
        })
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.data.filters.type).toBe("POACHING_SNARE");
    });

    it("should apply status filter", async () => {
      const response = await request(app)
        .get("/api/reports/generate")
        .query({
          reportType: "INCIDENT",
          status: "RESOLVED",
        })
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.data.filters.status).toBe("RESOLVED");
    });

    it("should require authentication", async () => {
      await request(app)
        .get("/api/reports/generate")
        .query({
          reportType: "INCIDENT",
        })
        .expect(401);
    });

    it("should require PARK_MANAGER role", async () => {
      await request(app)
        .get("/api/reports/generate")
        .query({
          reportType: "INCIDENT",
        })
        .set("Authorization", `Bearer ${rangerToken}`)
        .expect(403);
    });
  });

  describe("GET /api/reports/export", () => {
    it("should export report as JSON", async () => {
      const response = await request(app)
        .get("/api/reports/export")
        .query({
          reportType: "INCIDENT",
          format: "JSON",
          from: "2025-01-01",
          to: "2025-12-31",
        })
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(200);

      expect(response.headers["content-type"]).toContain("application/json");
      expect(response.headers["content-disposition"]).toContain("attachment");
      expect(response.body.reportType).toBe("INCIDENT_REPORT");
    });

    it("should export report as CSV", async () => {
      const response = await request(app)
        .get("/api/reports/export")
        .query({
          reportType: "PATROL",
          format: "CSV",
          from: "2025-01-01",
          to: "2025-12-31",
        })
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(200);

      expect(response.headers["content-type"]).toContain("text/csv");
      expect(response.headers["content-disposition"]).toContain("attachment");
      expect(response.headers["content-disposition"]).toContain(".csv");
      expect(response.text).toContain("Report Type");
    });

    it("should export report as HTML (for PDF conversion)", async () => {
      const response = await request(app)
        .get("/api/reports/export")
        .query({
          reportType: "CONFLICT_TREND",
          format: "PDF",
          from: "2025-01-01",
          to: "2025-12-31",
        })
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(200);

      expect(response.headers["content-type"]).toContain("text/html");
      expect(response.headers["content-disposition"]).toContain("attachment");
      expect(response.headers["content-disposition"]).toContain(".html");
      expect(response.text).toContain("<!DOCTYPE html>");
      expect(response.text).toContain("WildGuard Conservation Report");
    });

    it("should default to JSON if format not specified", async () => {
      const response = await request(app)
        .get("/api/reports/export")
        .query({
          reportType: "INCIDENT",
          from: "2025-01-01",
          to: "2025-12-31",
        })
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(200);

      expect(response.headers["content-type"]).toContain("application/json");
    });

    it("should set cache-control headers", async () => {
      const response = await request(app)
        .get("/api/reports/export")
        .query({
          reportType: "INCIDENT",
          format: "JSON",
        })
        .set("Authorization", `Bearer ${managerToken}`)
        .expect(200);

      expect(response.headers["cache-control"]).toBe("no-store");
    });

    it("should require authentication", async () => {
      await request(app)
        .get("/api/reports/export")
        .query({
          reportType: "INCIDENT",
          format: "CSV",
        })
        .expect(401);
    });

    it("should require PARK_MANAGER role", async () => {
      await request(app)
        .get("/api/reports/export")
        .query({
          reportType: "INCIDENT",
          format: "CSV",
        })
        .set("Authorization", `Bearer ${rangerToken}`)
        .expect(403);
    });
  });
});
