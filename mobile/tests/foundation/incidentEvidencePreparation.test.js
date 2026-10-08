import {
  prepareEvidenceItem,
  validateEvidenceDraft,
  discardEvidenceFile,
} from "../../src/utils/incidentEvidence";
import { uploadIncidentEvidence } from "../../src/services/incidentEvidenceApi";
import { api } from "../../src/services/api";
import { Platform } from "react-native";
const mockFiles = new Map();
let mockGate, mockFinish;
const mockCopy = jest.fn();
let mockDimensions = { width: 4032, height: 3024 }, mockEncodingFails = false;
const mockResize = jest.fn(), mockSave = jest.fn();
jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  ImageManipulator: { manipulate: jest.fn(() => ({
    resize: mockResize, release: jest.fn(),
    renderAsync: async () => ({ ...mockDimensions, release: jest.fn(), saveAsync: async (options) => {
      mockSave(options);
      if (mockEncodingFails) throw new Error("private decoder details");
      mockFiles.set("file:///encoded/photo.jpg", 500000);
      return { uri: "file:///encoded/photo.jpg" };
    } }),
  })) },
}));
jest.mock("../../src/services/api", () => ({
  api: { post: jest.fn(), get: jest.fn() },
}));
jest.mock("expo-file-system", () => ({
  Paths: { document: "file:///owned/" },
  File: class {
    constructor(parent, name) {
      this.uri = name ? parent + name : parent;
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    get size() {
      if (!this.exists) throw new Error("private native exception");
      return mockFiles.get(this.uri);
    }
    async copy(destination) {
      mockCopy(this.uri, destination.uri);
      if (mockGate)
        await new Promise((resolve) => {
          mockFinish = resolve;
        });
      else await Promise.resolve();
      if (!this.exists) throw new Error("private native exception");
      mockFiles.set(destination.uri, this.size);
    }
    delete() {
      mockFiles.delete(this.uri);
    }
  },
}));
const asset = {
  uri: "file:///picker/photo.jpg",
  fileName: "photo.jpg",
  mimeType: "image/jpeg",
  fileSize: 7700000,
};
let log;
beforeEach(() => {
  mockFiles.clear();
  mockFiles.set(asset.uri, 7700000);
  mockGate = false;
  mockFinish = null;
  mockDimensions = { width: 4032, height: 3024 };
  mockEncodingFails = false;
  jest.clearAllMocks();
  log = jest.spyOn(console, "warn").mockImplementation(() => {});
  api.post.mockResolvedValue({
    data: { success: true, evidence: { id: "e" } },
  });
});
afterEach(() => log.mockRestore());
test.each(["PHONE_CAMERA", "GALLERY_UPLOAD"])(
  "iOS %s waits for asynchronous copy before exposing a stable preview/upload URI",
  async (source) => {
    mockGate = true;
    let settled = false;
    const pending = prepareEvidenceItem(asset, source).then((item) => {
      settled = true;
      return item;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    const target = mockCopy.mock.calls[0][1];
    expect(mockFiles.has(target)).toBe(false); // Old code checked here without awaiting copy.
    mockFinish();
    const item = await pending;
    expect(item).toMatchObject({
      uri: target,
      ownedUri: target,
      name: "photo.jpg",
      mimeType: "image/jpeg",
      size: 7700000,
      prepared: true,
    });
    expect(item.uri).not.toBe(asset.uri);
  },
);
test("picker URI expiry after selection does not invalidate the owned file or retry identity", async () => {
  const item = await prepareEvidenceItem(asset, "GALLERY_UPLOAD");
  mockFiles.delete(asset.uri);
  await expect(validateEvidenceDraft([item])).resolves.toBeUndefined();
  expect(mockFiles.has(item.uri)).toBe(true);
  expect(mockCopy).toHaveBeenCalledTimes(1);
});
test("actual file stat is authoritative when picker size metadata differs", async () => {
  const item = await prepareEvidenceItem(
    { ...asset, fileSize: 7600000 },
    "GALLERY_UPLOAD",
  );
  expect(item.size).toBe(7700000);
});
test("expired source prompts reselection and only precise safe diagnostics are emitted", async () => {
  mockFiles.delete(asset.uri);
  await expect(
    prepareEvidenceItem(asset, "PHONE_CAMERA"),
  ).rejects.toMatchObject({
    code: "LOCAL_MEDIA_UNAVAILABLE",
    reselectRequired: true,
    evidenceDiagnostic: { step: "source_stat" },
  });
  expect(JSON.stringify(log.mock.calls)).not.toMatch(
    /picker|photo\.jpg|private native exception/,
  );
  expect(mockCopy).not.toHaveBeenCalled();
});
test("failed upload keeps the stable file; retry uses the same incident/key and deletes only on confirmed success", async () => {
  const item = await prepareEvidenceItem(asset, "GALLERY_UPLOAD");
  const uri = item.uri,
    key = item.uploadKey;
  api.post.mockRejectedValueOnce({ response: { status: 503 } });
  await expect(
    uploadIncidentEvidence("saved-incident", item),
  ).rejects.toBeDefined();
  expect(mockFiles.has(uri)).toBe(true);
  await expect(uploadIncidentEvidence("saved-incident", item)).resolves.toEqual(
    { id: "e" },
  );
  expect(item.uploadKey).toBe(key);
  expect(item.uri).toBe(uri);
  expect(api.post.mock.calls.map((call) => call[0])).toEqual([
    "/incidents/saved-incident/evidence",
    "/incidents/saved-incident/evidence",
  ]);
  expect(mockCopy).toHaveBeenCalledTimes(1);
  expect(mockFiles.has(uri)).toBe(false);
  expect(mockFiles.has(asset.uri)).toBe(true);
});
test("explicit discard removes only the owned copy", async () => {
  const item = await prepareEvidenceItem(asset, "PHONE_CAMERA");
  discardEvidenceFile(item);
  expect(mockFiles.has(item.uri)).toBe(false);
  expect(mockFiles.has(asset.uri)).toBe(true);
});

test.each(["image/jpeg", "image/heic"])("large %s optimized selection uses one stable copy, JPEG 0.8 and preserves original", async (mimeType) => {
  const item = await prepareEvidenceItem({ ...asset, mimeType }, "GALLERY_UPLOAD", "image", undefined, "optimized");
  expect(mockResize).toHaveBeenCalledWith({ width: 1600 });
  expect(mockSave).toHaveBeenCalledWith({ compress: 0.8, format: "jpeg" });
  expect(item).toMatchObject({ photoMode: "optimized", mimeType: "image/jpeg", size: 500000, originalSize: 7700000 });
  expect(mockCopy).toHaveBeenCalledTimes(1);
  expect(mockFiles.has(asset.uri)).toBe(true);
  expect(mockFiles.has("file:///encoded/photo.jpg")).toBe(false);
  mockFiles.delete(asset.uri);
  api.post.mockRejectedValueOnce({ response: { status: 503 } });
  await expect(uploadIncidentEvidence("same-incident", item)).rejects.toBeDefined();
  expect(mockFiles.has(item.uri)).toBe(true);
  await uploadIncidentEvidence("same-incident", item);
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(api.post.mock.calls.map(([path]) => path)).toEqual(["/incidents/same-incident/evidence", "/incidents/same-incident/evidence"]);
});

test("small PNG is never upscaled; original mode and videos do not encode", async () => {
  mockDimensions = { width: 640, height: 480 };
  await prepareEvidenceItem({ ...asset, mimeType: "image/png", fileName: "small.png" }, "GALLERY_UPLOAD", "image", undefined, "optimized");
  expect(mockResize).not.toHaveBeenCalled();
  mockSave.mockClear();
  await prepareEvidenceItem(asset, "PHONE_CAMERA");
  await prepareEvidenceItem({ ...asset, mimeType: "video/mp4", fileName: "video.mp4" }, "GALLERY_UPLOAD", "video", undefined, "optimized");
  expect(mockSave).not.toHaveBeenCalled();
});

test("unsupported HEIC decoding has actionable original-quality fallback without deleting original", async () => {
  mockEncodingFails = true;
  await expect(prepareEvidenceItem({ ...asset, mimeType: "image/heic" }, "GALLERY_UPLOAD", "image", undefined, "optimized")).rejects.toThrow("Original quality");
  expect(mockFiles.has(asset.uri)).toBe(true);
  expect(mockCopy).not.toHaveBeenCalled();
});

test("web optimization retains a Blob for multipart upload and releases only its own preview URL", async () => {
  const platform = Platform.OS, fetchBefore = global.fetch, revokeBefore = URL.revokeObjectURL;
  Platform.OS = "web";
  URL.revokeObjectURL = jest.fn();
  global.fetch = jest.fn(async () => ({ blob: async () => ({ size: 500000, type: "image/jpeg" }) }));
  try {
    const item = await prepareEvidenceItem({ ...asset, file: { size: 7700000 } }, "GALLERY_UPLOAD", "image", undefined, "optimized");
    expect(item).toMatchObject({ size: 500000, mimeType: "image/jpeg", file: { size: 500000 } });
    expect(mockCopy).not.toHaveBeenCalled();
    discardEvidenceFile({ ...item, uri: "blob:owned", ownedBlobUri: "blob:owned" });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:owned");
  } finally { Platform.OS = platform; global.fetch = fetchBefore; URL.revokeObjectURL = revokeBefore; }
});
