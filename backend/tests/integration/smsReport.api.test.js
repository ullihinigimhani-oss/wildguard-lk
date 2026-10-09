const request = require("supertest");

jest.mock("../../src/config/database", () => ({
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  communityReport: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  communityReportEvidence: {
    create: jest.fn(),
  },
}));

const db = require("../../src/config/database");
const app = require("../../src/app");
const { clearDeduplicationCache } = require("../../src/services/sms/smsGateway.service");

describe("SMS Community Reporting APIs (/api/sms)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDeduplicationCache();

    db.user.findFirst.mockResolvedValue(null);
    db.communityReport.create.mockImplementation(({ data, select }) =>
      Promise.resolve({
        id: "rep-sms-01",
        reportType: data.reportType,
        species: data.species || null,
        description: data.description,
        manualLocation: data.manualLocation,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        status: "PENDING",
        isAnonymous: data.isAnonymous,
        reporterName: data.reporterName || null,
        reporterPhone: data.reporterPhone || null,
        reporterId: data.reporterId || null,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        evidence: [],
      })
    );
  });

  describe("GET /api/sms/format", () => {
    test("returns public SMS format guidelines, supported types, and examples", async () => {
      const res = await request(app).get("/api/sms/format").expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.formatTemplate).toBe("REPORT <TYPE> # <LOCATION> # <DESCRIPTION>");
      expect(Array.isArray(res.body.supportedTypes)).toBe(true);
      expect(res.body.supportedTypes.some((t) => t.keyword === "SIGHTING")).toBe(true);
      expect(res.body.supportedTypes.some((t) => t.keyword === "CONFLICT")).toBe(true);
      expect(res.body.supportedTypes.some((t) => t.keyword === "SUSPICIOUS")).toBe(true);
      expect(Array.isArray(res.body.examples)).toBe(true);
    });
  });

  describe("POST /api/sms/incoming (Provider Webhook & Ingestion)", () => {
    test("creates community report from valid JSON SMS payload", async () => {
      const res = await request(app)
        .post("/api/sms/incoming")
        .send({
          senderPhone: "+94771234567",
          message: "REPORT SIGHTING # Yala Sector 3 buffer # 3 wild elephants approaching paddy fields",
          providerMessageId: "msg-test-101",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.report).toBeDefined();
      expect(res.body.report.reportType).toBe("WILDLIFE_SIGHTING");
      expect(res.body.report.manualLocation).toBe("Yala Sector 3 buffer");
      expect(res.body.report.description).toContain("3 wild elephants");
      expect(res.body.replyText).toContain("WildGuard LK: Safety report");
      expect(db.communityReport.create).toHaveBeenCalledTimes(1);
    });

    test("prevents duplicate processing when same providerMessageId is received", async () => {
      const payload = {
        senderPhone: "+94771234567",
        message: "REPORT SIGHTING # Yala Sector 3 buffer # 3 wild elephants approaching paddy fields",
        providerMessageId: "msg-duplicate-test",
      };

      // First delivery creates the report
      const firstRes = await request(app)
        .post("/api/sms/incoming")
        .send(payload)
        .expect(201);

      expect(firstRes.body.success).toBe(true);
      expect(firstRes.body.duplicate).toBeFalsy();
      expect(db.communityReport.create).toHaveBeenCalledTimes(1);

      // Second delivery with same message ID returns duplicate confirmation without calling DB create
      const duplicateRes = await request(app)
        .post("/api/sms/incoming")
        .send(payload)
        .expect(200);

      expect(duplicateRes.body.success).toBe(true);
      expect(duplicateRes.body.duplicate).toBe(true);
      expect(duplicateRes.body.message).toContain("Duplicate SMS message already processed");
      expect(db.communityReport.create).toHaveBeenCalledTimes(1); // Not called second time
    });

    test("associates report with registered user when sender phone matches account", async () => {
      db.user.findFirst.mockResolvedValueOnce({
        id: "usr-comm-1",
        name: "Sunil Perera",
        phone: "+94771234567",
        role: "COMMUNITY_USER",
      });

      const res = await request(app)
        .post("/api/sms/incoming")
        .send({
          senderPhone: "+94771234567",
          message: "REPORT CONFLICT # Wilpattu boundary village # Wild elephant damaged boundary fence and storehouse",
          providerMessageId: "msg-auth-user",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(db.communityReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reporterId: "usr-comm-1",
            reporterName: "Sunil Perera",
          }),
        })
      );
    });

    test("respects ANON keyword and omits reporter identity even if phone matches user", async () => {
      db.user.findFirst.mockResolvedValueOnce({
        id: "usr-comm-1",
        name: "Sunil Perera",
        phone: "+94771234567",
        role: "COMMUNITY_USER",
      });

      const res = await request(app)
        .post("/api/sms/incoming")
        .send({
          senderPhone: "+94771234567",
          message: "REPORT ANON SUSPICIOUS # Ridge path # Traps found along trail",
          providerMessageId: "msg-anon-user",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.report.isAnonymous).toBe(true);
      expect(db.communityReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isAnonymous: true,
            reporterId: null,
            reporterName: null,
          }),
        })
      );
    });

    test("handles Twilio form-encoded payload with TwiML XML response", async () => {
      const res = await request(app)
        .post("/api/sms/incoming")
        .type("form")
        .send({
          From: "+94779876543",
          Body: "REPORT SIGHTING # Minneriya lake edge # Large elephant herd bathing near shore",
          MessageSid: "SM1234567890abcdef",
          AccountSid: "ACmocktwilioaccountsid",
        })
        .expect(200);

      expect(res.headers["content-type"]).toContain("text/xml");
      expect(res.text).toContain("<Response>");
      expect(res.text).toContain("<Message>");
      expect(res.text).toContain("WildGuard LK:");
      expect(db.communityReport.create).toHaveBeenCalledTimes(1);
    });

    test("rejects missing sender phone with 400", async () => {
      const res = await request(app)
        .post("/api/sms/incoming")
        .send({
          message: "REPORT SIGHTING # Yala # Elephant spotted",
        })
        .expect(400);

      expect(res.body.message).toContain("Sender phone number is required");
    });

    test("rejects invalid phone number with 400", async () => {
      const res = await request(app)
        .post("/api/sms/incoming")
        .send({
          senderPhone: "invalid-phone",
          message: "REPORT SIGHTING # Yala # Elephant spotted",
        })
        .expect(400);

      expect(res.body.message).toContain("Invalid sender phone number format");
    });

    test("rejects missing message body with 400", async () => {
      const res = await request(app)
        .post("/api/sms/incoming")
        .send({
          senderPhone: "+94771234567",
          message: "",
        })
        .expect(400);

      expect(res.body.message).toContain("SMS message body is required");
    });

    test("rejects malformed message (missing location) with 400", async () => {
      const res = await request(app)
        .post("/api/sms/incoming")
        .send({
          senderPhone: "+94771234567",
          message: "REPORT SIGHTING # # Elephant spotted",
        })
        .expect(400);

      expect(res.body.message).toContain("Location is missing");
    });

    test("rejects unsupported report type with 400", async () => {
      const res = await request(app)
        .post("/api/sms/incoming")
        .send({
          senderPhone: "+94771234567",
          message: "REPORT WEATHER # Colombo # Raining",
        })
        .expect(400);

      expect(res.body.message).toContain("Unsupported report type");
    });
  });

  describe("POST /api/sms/simulate (Demo & Academic Simulator)", () => {
    test("allows simulated SMS report submission without real carrier connection", async () => {
      const res = await request(app)
        .post("/api/sms/simulate")
        .send({
          senderPhone: "+94711122334",
          message: "REPORT CONFLICT # Kataragama village # Wild boar damaged home garden fencing",
          providerMessageId: "sim-001",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.report.reportType).toBe("HUMAN_WILDLIFE_CONFLICT");
      expect(res.body.report.manualLocation).toBe("Kataragama village");
      expect(res.body.replyText).toContain("WildGuard LK: Safety report");
      expect(db.communityReport.create).toHaveBeenCalledTimes(1);
    });
  });
});
