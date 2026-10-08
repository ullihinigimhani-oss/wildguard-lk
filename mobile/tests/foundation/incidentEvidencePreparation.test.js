import {
  prepareEvidenceItem,
  validateEvidenceDraft,
  discardEvidenceFile,
} from "../../src/utils/incidentEvidence";
import { uploadIncidentEvidence } from "../../src/services/incidentEvidenceApi";
import { api } from "../../src/services/api";
const mockFiles = new Map();
let mockGate, mockFinish;
const mockCopy = jest.fn();
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
