const request = require("supertest");
const jwt = require("jsonwebtoken");
const { Writable } = require("node:stream");
jest.mock("../../src/config/database", () => ({}));
jest.mock("../../src/repositories/incident.repository", () => ({
  findIncident: jest.fn(),
  withActivePatrol: jest.fn(),
  lockIncident: jest.fn(),
}));
jest.mock("../../src/repositories/auth.repository", () => ({
  findSessionUser: jest.fn(),
}));
jest.mock("../../src/services/auth.service", () => ({
  authenticate: jest.fn(),
}));
jest.mock("file-type", () => ({ fileTypeFromBuffer: jest.fn() }), {
  virtual: true,
});
jest.mock("cloudinary", () => ({
  v2: {
    config: jest.fn(),
    uploader: { upload_stream: jest.fn(), destroy: jest.fn() },
    utils: { private_download_url: jest.fn() },
  },
}));
const cloud = require("cloudinary").v2;
const repository = require("../../src/repositories/incident.repository");
const accounts = require("../../src/repositories/auth.repository");
const auth = require("../../src/services/auth.service");
process.env.CLOUDINARY_CLOUD_NAME = "mock-cloud";
process.env.CLOUDINARY_API_KEY = "mock-only-cloud-key";
process.env.CLOUDINARY_API_SECRET = "mock-only-cloud-secret";
process.env.JWT_SECRET = "mock-only-evidence-jwt-secret-at-least-32";
const app = require("../../src/app");
const owner = {
  id: "r",
  role: "RANGER",
  approvalStatus: "APPROVED",
  isActive: true,
};
const bearer = (role = "RANGER") =>
  "Bearer " +
  jwt.sign({ role }, process.env.JWT_SECRET, {
    subject: role === "RANGER" ? "r" : "m",
    expiresIn: "1h",
  });
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
let items, locked, tx, originalFetch, diagnosticLog;
beforeEach(() => {
  diagnosticLog = jest.spyOn(console, "info").mockImplementation(() => {});
  items = [];
  locked = { status: "PENDING", withdrawnAt: null };
  tx = {
    incidentEvidence: {
      findMany: jest.fn(async () => items),
      create: jest.fn(async ({ data }) => {
        const item = { ...data, id: "e-1" };
        items.push(item);
        return item;
      }),
    },
  };
  auth.authenticate.mockImplementation(async (token) => {
    const claims = jwt.verify(token, process.env.JWT_SECRET);
    return { ...owner, id: claims.sub, role: claims.role };
  });
  accounts.findSessionUser.mockResolvedValue(owner);
  repository.findIncident.mockImplementation(async (id, reader) =>
    reader.id === "r" || reader.role === "PARK_MANAGER"
      ? { id, patrolId: "p", evidence: items }
      : null,
  );
  repository.withActivePatrol.mockImplementation(async (p, r, action) =>
    action(tx),
  );
  repository.lockIncident.mockImplementation(async () => locked);
  require("file-type").fileTypeFromBuffer.mockResolvedValue({
    mime: "image/png",
    ext: "png",
  });
  cloud.uploader.destroy.mockResolvedValue({ result: "ok" });
  cloud.uploader.upload_stream.mockImplementation(
    (options, done) =>
      new Writable({
        write(chunk, encoding, next) {
          next();
        },
        final(next) {
          done(null, {
            asset_id: "asset-1",
            public_id: options.public_id,
            resource_type: options.resource_type,
            type: options.type,
            format: "png",
            version: 1,
            width: 1,
            height: 1,
            bytes: png.length,
          });
          next();
        },
      }),
  );
  cloud.utils.private_download_url.mockReturnValue(
    "https://api.cloudinary.com/mock-private-download?api_key=mock-only-cloud-key",
  );
  originalFetch = global.fetch;
  global.fetch = jest.fn(
    async () =>
      new Response(png, { headers: { "content-length": String(png.length) } }),
  );
});
afterEach(() => {
  diagnosticLog.mockRestore();
  global.fetch = originalFetch;
});
const upload = (role = "RANGER") =>
  request(app)
    .post("/api/incidents/i/evidence")
    .set("Authorization", bearer(role))
    .field("source", "GALLERY_UPLOAD")
    .field("uploadKey", "retry-upload-key-123456")
    .attach("file", png, { filename: "photo.png", contentType: "image/png" });
test("async receipt returns before slow storage completes; authenticated polling confirms one record", async () => {
  let finish;
  cloud.uploader.upload_stream.mockImplementation(
    (options, callback) =>
      new Writable({
        write(chunk, encoding, done) {
          done();
        },
        final(done) {
          finish = () =>
            callback(null, {
              asset_id: "asset-async",
              public_id: options.public_id,
              resource_type: "image",
              type: "authenticated",
              format: "png",
              version: 1,
              width: 1,
              height: 1,
              bytes: png.length,
            });
          done();
        },
      }),
  );
  const receipt = await upload().set("Prefer", "respond-async").expect(202);
  expect(items).toHaveLength(0);
  const path = `/api/incidents/i/evidence/uploads/${receipt.body.upload.id}`;
  await request(app).get(path).expect(401);
  const processing = await request(app)
    .get(path)
    .set("Authorization", bearer())
    .expect(200);
  expect(processing.body.upload.status).toBe("PROCESSING");
  await upload().expect(429); // Receipt response must not release the in-flight upload slot.
  finish();
  await new Promise((resolve) => setImmediate(resolve));
  const completed = await request(app)
    .get(path)
    .set("Authorization", bearer())
    .expect(200);
  expect(completed.body.evidence.id).toBe("e-1");
  expect(items).toHaveLength(1);
  expect(completed.body.evidence.fileUrl).toBeNull();
});
test("patrol completion during async processing still blocks finalization and cleans storage", async () => {
  let finish;
  cloud.uploader.upload_stream.mockImplementation(
    (options, callback) =>
      new Writable({
        write(chunk, encoding, done) {
          done();
        },
        final(done) {
          finish = () =>
            callback(null, {
              asset_id: "asset-async",
              public_id: options.public_id,
              resource_type: "image",
              type: "authenticated",
              format: "png",
              version: 1,
              width: 1,
              height: 1,
              bytes: png.length,
            });
          done();
        },
      }),
  );
  const receipt = await upload().set("Prefer", "respond-async").expect(202);
  repository.withActivePatrol.mockRejectedValue(
    Object.assign(new Error("locked"), {
      incidentError: true,
      status: 409,
      code: "PATROL_NOT_ACTIVE",
    }),
  );
  finish();
  await new Promise((resolve) => setImmediate(resolve));
  const result = await request(app)
    .get(`/api/incidents/i/evidence/uploads/${receipt.body.upload.id}`)
    .set("Authorization", bearer())
    .expect(409);
  expect(result.body.code).toBe("PATROL_NOT_ACTIVE");
  expect(items).toHaveLength(0);
  expect(cloud.uploader.destroy).toHaveBeenCalled();
});
test("diagnostics confirm receipt of bytes and ordered stages while logging only safe fields", async () => {
  const response = await upload().expect(201);
  expect(response.headers["x-evidence-request-id"]).toMatch(
    /^[A-Za-z0-9-]{16,80}$/,
  );
  const entries = diagnosticLog.mock.calls.map(([line]) => JSON.parse(line));
  expect(entries.map((entry) => entry.stage)).toEqual(
    expect.arrayContaining([
      "request_received",
      "authenticated",
      "authorization_preflight",
      "multipart_receiving",
      "file_received",
      "media_validated",
      "cloudinary_upload",
      "database_finalization",
      "upload_complete",
    ]),
  );
  expect(
    entries.find((entry) => entry.stage === "file_received"),
  ).toMatchObject({ mimeType: "image/png", fileSize: png.length });
  for (const entry of entries)
    expect(
      Object.keys(entry).every((key) =>
        [
          "requestId",
          "incidentId",
          "stage",
          "httpStatus",
          "code",
          "mimeType",
          "fileSize",
          "elapsedMs",
        ].includes(key),
      ),
    ).toBe(true);
  expect(JSON.stringify(entries)).not.toMatch(
    /mock-only-cloud|Bearer|api_key|photo\.png|latitude|longitude/,
  );
});
test("missing multipart boundary is classified before provider upload", async () => {
  const response = await request(app)
    .post("/api/incidents/i/evidence")
    .set("Authorization", bearer())
    .set("Content-Type", "multipart/form-data")
    .send("not a multipart body")
    .expect(400);
  expect(response.body).toMatchObject({
    code: "MULTIPART_INVALID",
    diagnostic: { stage: "multipart_receiving", code: "MULTIPART_INVALID" },
  });
  expect(cloud.uploader.upload_stream).not.toHaveBeenCalled();
});
test.each([
  [401, "CLOUDINARY_AUTH_FAILED"],
  [404, "CLOUDINARY_CONFIG_REJECTED"],
  [499, "CLOUDINARY_TIMEOUT"],
])(
  "provider %s is safely classified with the failing stage",
  async (http_code, code) => {
    cloud.uploader.upload_stream.mockImplementation(
      (options, callback) =>
        new Writable({
          write(chunk, encoding, done) {
            done();
          },
          final(done) {
            callback({
              http_code,
              message: "mock-only-cloud-secret signed-url-token",
            });
            done();
          },
        }),
    );
    const response = await upload().expect(503);
    expect(response.body).toMatchObject({
      code,
      diagnostic: { stage: "cloudinary_upload", code },
    });
    expect(items).toHaveLength(0);
    expect(JSON.stringify(diagnosticLog.mock.calls)).not.toContain(
      "mock-only-cloud-secret",
    );
    expect(JSON.stringify(response.body)).not.toContain("signed-url-token");
  },
);
test("database finalization failure is distinguished and cleans the private asset", async () => {
  tx.incidentEvidence.create.mockRejectedValue(
    new Error("private database details"),
  );
  const response = await upload().expect(503);
  expect(response.body).toMatchObject({
    code: "EVIDENCE_SAVE_FAILED",
    diagnostic: { stage: "database_finalization" },
  });
  expect(cloud.uploader.destroy).toHaveBeenCalled();
  expect(JSON.stringify(diagnosticLog.mock.calls)).not.toContain(
    "private database details",
  );
});
test("authenticated multipart upload calls signed SDK with authenticated delivery and never exposes storage credentials/URL", async () => {
  const response = await upload().expect(201);
  expect(response.body.evidence.id).toBe("e-1");
  expect(response.body.evidence.fileUrl).toBeNull();
  expect(cloud.uploader.upload_stream).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "authenticated",
      resource_type: "image",
      allowed_formats: ["png"],
      overwrite: false,
    }),
    expect.any(Function),
  );
  expect(JSON.stringify(response.body)).not.toMatch(
    /mock-only-cloud|asset-1|cloudinary:|storage/,
  );
  expect(response.headers["cache-control"]).toContain("no-store");
});
test("Ranger-only upload rejects manager and missing auth before reading multipart bytes", async () => {
  await upload("PARK_MANAGER").expect(403);
  await request(app).post("/api/incidents/i/evidence").expect(401);
  expect(cloud.uploader.upload_stream).not.toHaveBeenCalled();
});
test("locked incident and multipart injection cannot reach Cloudinary", async () => {
  locked.status = "UNDER_REVIEW";
  await upload().expect(409);
  expect(cloud.uploader.upload_stream).not.toHaveBeenCalled();
  locked.status = "PENDING";
  await request(app)
    .post("/api/incidents/i/evidence")
    .set("Authorization", bearer())
    .field("source", "GALLERY_UPLOAD")
    .field("uploadKey", "retry-upload-key-123456")
    .field("fileUrl", "https://untrusted.example/photo.png")
    .attach("file", png, { filename: "photo.png", contentType: "image/png" })
    .expect(400);
  expect(cloud.uploader.upload_stream).not.toHaveBeenCalled();
});
test("private read returns only time-bound backend ticket; proxy handles bytes/ranges without redirect/public URL", async () => {
  await upload().expect(201);
  const access = await request(app)
    .get("/api/incidents/i/evidence/e-1/access")
    .set("Authorization", bearer())
    .expect(200);
  expect(JSON.stringify(access.body)).not.toMatch(
    /mock-only-cloud|api\.cloudinary/,
  );
  const media = await request(app)
    .get("/api" + access.body.access.path)
    .set("Range", "bytes=0-10")
    .expect(200);
  expect(media.headers["content-type"]).toContain("image/png");
  expect(media.headers["cache-control"]).toContain("no-store");
  expect(media.headers.location).toBeUndefined();
  expect(global.fetch).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      redirect: "error",
      headers: { Range: "bytes=0-10" },
    }),
  );
  expect(cloud.utils.private_download_url).toHaveBeenCalledWith(
    expect.any(String),
    "png",
    expect.objectContaining({
      type: "authenticated",
      expires_at: expect.any(Number),
    }),
  );
  await request(app).get("/api/incidents/i/evidence/e-1/media").expect(401);
});
test("ticket cannot be reused for another evidence, expired access cannot load, and revoked accounts lose access", async () => {
  await upload();
  const access = await request(app)
    .get("/api/incidents/i/evidence/e-1/access")
    .set("Authorization", bearer());
  const ticket = access.body.access.path.split("ticket=")[1];
  await request(app)
    .get("/api/incidents/i/evidence/other/media?ticket=" + ticket)
    .expect(403);
  const expired = jwt.sign(
    {
      incidentId: "i",
      evidenceId: "e-1",
      exp: Math.floor(Date.now() / 1000) - 1,
    },
    process.env.JWT_SECRET,
    { subject: "r", issuer: "wildguard-lk", audience: "wildguard-evidence" },
  );
  await request(app)
    .get("/api/incidents/i/evidence/e-1/media")
    .query({ ticket: expired })
    .expect(401);
  accounts.findSessionUser.mockResolvedValue({
    ...owner,
    approvalStatus: "REJECTED",
  });
  await request(app)
    .get("/api" + access.body.access.path)
    .expect(403);
  expect(global.fetch).not.toHaveBeenCalled();
});
test("SDK failures are sanitized, cleanup runs, incident remains and no evidence is inserted", async () => {
  cloud.uploader.upload_stream.mockImplementation(
    (options, callback) =>
      new Writable({
        write(chunk, encoding, done) {
          done();
        },
        final(done) {
          callback(new Error("mock-only-cloud-secret"));
          done();
        },
      }),
  );
  const response = await upload().expect(503);
  expect(JSON.stringify(response.body)).not.toContain("mock-only-cloud-secret");
  expect(cloud.uploader.destroy).toHaveBeenCalled();
  expect(items).toHaveLength(0);
});

test("cleanup retries are bounded and a failed provider delete is explicitly reported", async () => {
  cloud.uploader.upload_stream.mockImplementation(
    (options, callback) =>
      new Writable({
        write(chunk, encoding, done) {
          done();
        },
        final(done) {
          callback(new Error("mock provider failure"));
          done();
        },
      }),
  );
  cloud.uploader.destroy.mockRejectedValue(new Error("mock-only-cloud-secret"));
  const response = await upload().expect(503);
  expect(response.body.code).toBe("MEDIA_CLEANUP_FAILED");
  expect(cloud.uploader.destroy).toHaveBeenCalledTimes(3);
  expect(items).toHaveLength(0);
  expect(JSON.stringify(response.body)).not.toContain("mock-only-cloud-secret");
});
