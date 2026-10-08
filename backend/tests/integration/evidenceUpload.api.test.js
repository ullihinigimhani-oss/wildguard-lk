const request = require("supertest");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");

jest.mock("../../src/config/database", () => ({
  user: { findUnique: jest.fn() },
  communityReport: {
    findUnique: jest.fn(),
  },
  communityReportEvidence: {
    create: jest.fn(),
  },
}));

const db = require("../../src/config/database");
const app = require("../../src/app");
const { UPLOAD_DIR } = require("../../src/services/evidenceStorage.service");

let accounts;
const token = (id) =>
  jwt.sign({}, process.env.JWT_SECRET, {
    subject: id,
    issuer: "wildguard-lk",
    audience: "wildguard-web",
    expiresIn: "1h",
  });

beforeEach(() => {
  process.env.JWT_SECRET = "evidence-upload-test-secret-key-32";
  accounts = {
    "reporter-1": {
      id: "reporter-1",
      name: "Kasun Bandara",
      role: "COMMUNITY_USER",
      approvalStatus: "APPROVED",
      isActive: true,
    },
    "other-user": {
      id: "other-user",
      name: "Saman Kumara",
      role: "COMMUNITY_USER",
      approvalStatus: "APPROVED",
      isActive: true,
    },
    liaison: {
      id: "liaison",
      name: "Liaison Officer",
      role: "COMMUNITY_LIAISON",
      approvalStatus: "APPROVED",
      isActive: true,
    },
  };

  db.user.findUnique.mockImplementation(async ({ where }) => accounts[where.id] || null);
  db.communityReportEvidence.create.mockImplementation(async ({ data }) => ({
    id: "evidence-uuid-1",
    createdAt: new Date(),
    ...data,
  }));
});

afterAll(() => {
  // Clean up any test uploaded files in uploads/evidence directory
  try {
    if (fs.existsSync(UPLOAD_DIR)) {
      const files = fs.readdirSync(UPLOAD_DIR);
      for (const file of files) {
        if (file.startsWith("evidence-")) {
          fs.unlinkSync(path.join(UPLOAD_DIR, file));
        }
      }
    }
  } catch (_) {}
});

describe("Evidence Upload APIs", () => {
  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);
  const validJpegBase64 = validJpegBuffer.toString("base64");

  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  const validPngBase64 = validPngBuffer.toString("base64");

  const validMp4Buffer = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
  ]);
  const validMp4Base64 = validMp4Buffer.toString("base64");

  describe("POST /api/community-reports/evidence/upload", () => {
    test("successfully uploads a valid JPEG photo", async () => {
      const res = await request(app)
        .post("/api/community-reports/evidence/upload")
        .send({
          data: validJpegBase64,
          mimeType: "image/jpeg",
          originalName: "camera_photo.jpg",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.fileUrl).toMatch(/^\/uploads\/evidence\/evidence-.*\.jpg$/);
      expect(res.body.fileType).toBe("image/jpeg");
      expect(res.body.fileName).toBeDefined();
    });

    test("successfully uploads a valid PNG photo with data URI prefix", async () => {
      const dataUri = `data:image/png;base64,${validPngBase64}`;
      const res = await request(app)
        .post("/api/community-reports/evidence/upload")
        .send({
          data: dataUri,
          mimeType: "image/png",
          originalName: "screenshot.png",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.fileUrl).toMatch(/^\/uploads\/evidence\/evidence-.*\.png$/);
      expect(res.body.fileType).toBe("image/png");
    });

    test("successfully uploads a valid MP4 video", async () => {
      const res = await request(app)
        .post("/api/community-reports/evidence/upload")
        .send({
          data: validMp4Base64,
          mimeType: "video/mp4",
          originalName: "elephant_video.mp4",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.fileUrl).toMatch(/^\/uploads\/evidence\/evidence-.*\.mp4$/);
      expect(res.body.fileType).toBe("video/mp4");
    });

    test("rejects unsupported MIME types (e.g. application/pdf)", async () => {
      const res = await request(app)
        .post("/api/community-reports/evidence/upload")
        .send({
          data: Buffer.from("pdf dummy data").toString("base64"),
          mimeType: "application/pdf",
          originalName: "document.pdf",
        })
        .expect(400);

      expect(res.body.message).toMatch(/Unsupported file type/i);
    });

    test("rejects spoofed MIME type when magic bytes do not match", async () => {
      const fakeJpegData = Buffer.from("Plain text content claiming to be JPEG").toString("base64");
      const res = await request(app)
        .post("/api/community-reports/evidence/upload")
        .send({
          data: fakeJpegData,
          mimeType: "image/jpeg",
          originalName: "spoofed.jpg",
        })
        .expect(400);

      expect(res.body.message).toMatch(/signature verification failed|does not match/i);
    });

    test("rejects empty or zero-byte file payload", async () => {
      const res = await request(app)
        .post("/api/community-reports/evidence/upload")
        .send({
          data: "",
          mimeType: "image/jpeg",
          originalName: "empty.jpg",
        })
        .expect(400);

      expect(res.body.message).toMatch(/empty or corrupted/i);
    });

    test("rejects files exceeding size limits", async () => {
      // 10MB limit + 1KB for image
      const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024);
      // Valid JPEG header so size check is tested
      oversizedBuffer[0] = 0xff;
      oversizedBuffer[1] = 0xd8;
      oversizedBuffer[2] = 0xff;
      oversizedBuffer[3] = 0xe0;

      const res = await request(app)
        .post("/api/community-reports/evidence/upload")
        .send({
          data: oversizedBuffer.toString("base64"),
          mimeType: "image/jpeg",
          originalName: "huge.jpg",
        })
        .expect(400);

      expect(res.body.message).toMatch(/exceeds maximum size limit/i);
    });
  });

  describe("POST /api/community-reports/:id/evidence (Attach to report)", () => {
    beforeEach(() => {
      db.communityReport.findUnique.mockResolvedValue({
        id: "rep-100",
        reporterId: "reporter-1",
        reportType: "WILDLIFE_SIGHTING",
        status: "PENDING",
      });
    });

    test("allows the report owner to attach evidence", async () => {
      const res = await request(app)
        .post("/api/community-reports/rep-100/evidence")
        .set("Authorization", `Bearer ${token("reporter-1")}`)
        .send({
          data: validJpegBase64,
          mimeType: "image/jpeg",
          originalName: "evidence.jpg",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.evidence.reportId).toBe("rep-100");
      expect(db.communityReportEvidence.create).toHaveBeenCalled();
    });

    test("allows liaison staff to attach evidence to any report", async () => {
      const res = await request(app)
        .post("/api/community-reports/rep-100/evidence")
        .set("Authorization", `Bearer ${token("liaison")}`)
        .send({
          data: validJpegBase64,
          mimeType: "image/jpeg",
          originalName: "staff-note.jpg",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
    });

    test("rejects unauthorized non-staff user trying to attach evidence to another user report", async () => {
      const res = await request(app)
        .post("/api/community-reports/rep-100/evidence")
        .set("Authorization", `Bearer ${token("other-user")}`)
        .send({
          data: validJpegBase64,
          mimeType: "image/jpeg",
          originalName: "unauthorized.jpg",
        })
        .expect(403);

      expect(res.body.message).toMatch(/permission/i);
    });

    test("returns 404 if the target report does not exist", async () => {
      db.communityReport.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/community-reports/non-existent/evidence")
        .set("Authorization", `Bearer ${token("reporter-1")}`)
        .send({
          data: validJpegBase64,
          mimeType: "image/jpeg",
        })
        .expect(404);

      expect(res.body.message).toMatch(/not found/i);
    });
  });
});
