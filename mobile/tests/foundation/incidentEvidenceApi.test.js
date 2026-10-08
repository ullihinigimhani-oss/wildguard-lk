import { Platform } from "react-native";
import { api } from "../../src/services/api";
import {
  getEvidenceAccess,
  uploadIncidentEvidence,
  evidenceError,
} from "../../src/services/incidentEvidenceApi";
import { selectionItem } from "../../src/utils/incidentEvidence";
jest.mock("expo-file-system", () => ({
  Paths: { document: "file:///owned/" },
  File: class {
    constructor(parent, name) {
      this.uri = name ? parent + name : parent;
      this.exists = true;
      this.size = 100;
    }
    async copy(destination) {
      destination.size = this.size;
    }
    delete() {
      this.exists = false;
    }
  },
}));
jest.mock("../../src/services/api", () => ({
  api: {
    defaults: { baseURL: "https://example.test/api" },
    post: jest.fn(),
    get: jest.fn(),
  },
}));
test("multipart upload reuses existing API auth, supports progress and requires confirmed evidence ID", async () => {
  const original = global.FormData;
  global.FormData = class {
    constructor() {
      this.parts = [];
    }
    append(...values) {
      this.parts.push(values);
    }
  };
  try {
    api.post.mockResolvedValue({
      data: { success: true, evidence: { id: "e" } },
    });
    const progress = jest.fn();
    const item = {
      uri: "file:///photo.jpg",
      name: "photo.jpg",
      mimeType: "image/jpeg",
      source: "GALLERY_UPLOAD",
      uploadKey: "retry-key-123456789",
    };
    expect(await uploadIncidentEvidence("i/a", item, progress)).toEqual({
      id: "e",
    });
    expect(api.post).toHaveBeenCalledWith(
      "/incidents/i%2Fa/evidence",
      expect.anything(),
      expect.objectContaining({
        timeout: 300000,
        onUploadProgress: expect.any(Function),
      }),
    );
    const [path, body, options] = api.post.mock.calls[0];
    expect(options.headers).not.toHaveProperty("Content-Type");
    expect(options.headers["X-Evidence-Request-ID"]).toMatch(
      /^[A-Za-z0-9-]{16,80}$/,
    );
    expect(body.parts).toContainEqual([
      "file",
      {
        uri: expect.stringMatching(/^file:\/\/\/owned\/wg-evidence-/),
        name: item.name,
        type: item.mimeType,
      },
    ]);
    expect(body.parts).toContainEqual(["uploadKey", item.uploadKey]);
    options.onUploadProgress({ loaded: 50, total: 100 });
    expect(progress).toHaveBeenCalledWith(50);
    options.onUploadProgress({ loaded: 100, total: 100 });
    expect(progress).toHaveBeenLastCalledWith(99);
    api.post.mockResolvedValue({ data: { success: true } });
    await expect(uploadIncidentEvidence("i", item)).rejects.toThrow(
      "did not confirm",
    );
  } finally {
    global.FormData = original;
  }
});

test.each([
  ["EVIDENCE_STORAGE_UNAVAILABLE", "configuration is missing"],
  ["CLOUDINARY_AUTH_FAILED", "rejected"],
  ["MEDIA_UPLOAD_FAILED", "storage upload failed"],
  ["EVIDENCE_SAVE_FAILED", "database record"],
  ["PATROL_NOT_ACTIVE", "no longer in progress"],
  ["MEDIA_MISMATCH", "not valid"],
])(
  "safe error distinguishes %s and correlates backend stage without exposing raw messages",
  (code, message) => {
    const result = evidenceError({
      response: {
        status:
          code === "PATROL_NOT_ACTIVE"
            ? 409
            : code === "MEDIA_MISMATCH"
              ? 400
              : 503,
        data: {
          code,
          message: "SECRET_TOKEN_AND_URL",
          diagnostic: {
            requestId: "safe-request-id-123456",
            stage: "cloudinary_upload",
          },
        },
      },
    });
    expect(result).toContain(message);
    expect(result).toContain("safe-request-id-123456");
    expect(result).not.toContain("SECRET_TOKEN_AND_URL");
  },
);
test("network and request timeout report the client correlation ID with no HTTP response", async () => {
  const failure = Object.assign(new Error("secret request config"), {
    code: "ECONNABORTED",
  });
  api.post.mockRejectedValueOnce(failure);
  await expect(
    uploadIncidentEvidence("i", {
      uri: "file:///photo.jpg",
      name: "photo.jpg",
      mimeType: "image/jpeg",
    }),
  ).rejects.toBe(failure);
  expect(evidenceError(failure)).toMatch(
    /timed out.*Reference:.*client_transport.*no HTTP response/,
  );
  expect(evidenceError(failure)).not.toContain("secret request config");
  expect(evidenceError({ code: "ERR_NETWORK" })).toContain(
    "could not reach the backend",
  );
});
test("private access is limited to backend ticket URLs and rejects injected public destinations", async () => {
  api.get.mockResolvedValue({
    data: {
      success: true,
      access: {
        path: "/incidents/i/evidence/e/media?ticket=short-lived",
        expiresAt: "2026-12-01T10:00:00Z",
      },
    },
  });
  expect((await getEvidenceAccess("i", "e")).uri).toBe(
    "https://example.test/api/incidents/i/evidence/e/media?ticket=short-lived",
  );
  api.get.mockResolvedValue({
    data: {
      success: true,
      access: {
        path: "https://public.example/file",
        expiresAt: "2026-12-01T10:00:00Z",
      },
    },
  });
  await expect(getEvidenceAccess("i", "e")).rejects.toThrow(
    "could not be confirmed",
  );
});
test("an async receipt is not success; short status polling waits for the same incident's confirmed evidence", async () => {
  jest.useFakeTimers();
  try {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        upload: { id: "receipt-1", status: "PROCESSING" },
      },
    });
    api.get
      .mockResolvedValueOnce({
        data: {
          success: true,
          upload: { id: "receipt-1", status: "PROCESSING" },
        },
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          upload: { id: "receipt-1", status: "COMPLETE" },
          evidence: { id: "e" },
        },
      });
    const pending = uploadIncidentEvidence("same-incident", {
      uri: "file:///photo.jpg",
      name: "photo.jpg",
      mimeType: "image/jpeg",
      uploadKey: "same-stable-upload-key",
    });
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toEqual({ id: "e" });
    expect(api.get).toHaveBeenLastCalledWith(
      "/incidents/same-incident/evidence/uploads/receipt-1",
      { timeout: 15000 },
    );
  } finally {
    jest.useRealTimers();
  }
});
test("client limits actual reported selection size and maintains independent stable retry keys", () => {
  const asset = {
    uri: "file:///photo.jpg",
    fileSize: 100,
    mimeType: "image/jpeg",
  };
  const first = selectionItem(asset, "GALLERY_UPLOAD");
  const second = selectionItem(asset, "GALLERY_UPLOAD");
  expect(first.uploadKey).not.toBe(second.uploadKey);
  expect(() =>
    selectionItem({ ...asset, fileSize: 11 * 1024 * 1024 }, "GALLERY_UPLOAD"),
  ).toThrow("10 MB");
  expect(() =>
    selectionItem(
      { ...asset, fileSize: 51 * 1024 * 1024, mimeType: "video/mp4" },
      "GALLERY_UPLOAD",
      "video",
    ),
  ).toThrow("50 MB");
});
test.each([400, 401, 403, 404, 409, 413, 429, 503, undefined])(
  "safe upload/read error %s has no provider internals",
  (status) => {
    expect(
      evidenceError({
        response: { status, data: { message: "private provider details" } },
      }),
    ).not.toContain("private provider details");
  },
);
