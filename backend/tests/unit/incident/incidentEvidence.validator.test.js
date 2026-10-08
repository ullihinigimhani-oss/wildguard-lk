const { execFileSync } = require("node:child_process");
const path = require("node:path");
// The ESM detector runs in Node 22 in production. These tests exercise its real
// bytes without weakening Jest's existing CommonJS configuration or making network calls.
const {
  validateUpload,
  limits,
} = require("../../../src/validators/incidentEvidence.validator");
jest.mock("file-type", () => ({ fileTypeFromBuffer: jest.fn() }), {
  virtual: true,
});
const detect = require("file-type").fileTypeFromBuffer;
const fields = {
  source: "GALLERY_UPLOAD",
  uploadKey: "retry-evidence-123456789",
};
const file = () => ({
  buffer: Buffer.from("media"),
  mimetype: "image/jpeg",
  originalname: "photo.jpg",
});
beforeEach(() => detect.mockResolvedValue({ mime: "image/jpeg", ext: "jpg" }));
test("actual-byte detector recognizes real PNG and rejects renamed text", () => {
  const script =
    "(async()=>{const {fileTypeFromBuffer}=require('file-type');const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'); console.log(JSON.stringify([await fileTypeFromBuffer(png),await fileTypeFromBuffer(Buffer.from('not a photo'))]));})()";
  const result = JSON.parse(
    execFileSync(process.execPath, ["-e", script], {
      cwd: path.resolve(__dirname, "../../.."),
      encoding: "utf8",
    }),
  );
  expect(result[0].mime).toBe("image/png");
  expect(result[1]).toBeNull();
});
test("server derives MIME, size, hash and normalized metadata from actual bytes", async () => {
  const result = await validateUpload(file(), fields);
  expect(result.metadata).toMatchObject({
    mimeType: "image/jpeg",
    fileSize: 5,
    source: "GALLERY_UPLOAD",
  });
  expect(result.resourceType).toBe("image");
  expect(result.sha256).toHaveLength(64);
});
test.each([
  ["image/png", "image/jpeg"],
  ["application/pdf", "application/pdf"],
  ["image/svg+xml", "image/svg+xml"],
])("rejects spoofed/unsupported media %s", async (actual, declared) => {
  detect.mockResolvedValue({ mime: actual });
  await expect(
    validateUpload({ ...file(), mimetype: declared }, fields),
  ).rejects.toMatchObject({ status: 400 });
});
test.each([
  ["image/jpeg", limits.IMAGE_LIMIT],
  ["video/mp4", limits.VIDEO_LIMIT],
])("enforces actual %s size", async (mime, maximum) => {
  detect.mockResolvedValue({ mime });
  const oversized = {
    ...file(),
    mimetype: mime,
    buffer: Buffer.alloc(maximum + 1),
  };
  await expect(validateUpload(oversized, fields)).rejects.toMatchObject({
    status: 413,
  });
});
test("camera trap metadata is controlled, capture date is validated, URLs cannot be injected", async () => {
  await expect(
    validateUpload(file(), { ...fields, source: "CAMERA_TRAP" }),
  ).rejects.toMatchObject({ status: 400 });
  const result = await validateUpload(file(), {
    ...fields,
    source: "CAMERA_TRAP",
    cameraTrapId: "trap-1",
    capturedAt: "2026-01-01T10:00:00+05:30",
    notes: "Boundary capture",
  });
  expect(result.metadata.cameraTrapId).toBe("trap-1");
  await expect(
    validateUpload(file(), {
      ...fields,
      fileUrl: "https://unverified.example/file",
    }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    validateUpload(file(), { ...fields, capturedAt: "2999-01-01T10:00:00Z" }),
  ).rejects.toMatchObject({ status: 400 });
});
