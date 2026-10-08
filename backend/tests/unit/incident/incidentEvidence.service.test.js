const jwt = require("jsonwebtoken");
jest.mock("../../../src/repositories/incident.repository", () => ({
  findIncident: jest.fn(),
  withActivePatrol: jest.fn(),
  lockIncident: jest.fn(),
}));
jest.mock("../../../src/repositories/auth.repository", () => ({
  findSessionUser: jest.fn(),
}));
jest.mock("../../../src/services/cloudinaryEvidence.storage", () => ({
  assertConfigured: jest.fn(),
  upload: jest.fn(),
  remove: jest.fn(),
  downloadUrl: jest.fn(),
}));
const repository = require("../../../src/repositories/incident.repository");
const accounts = require("../../../src/repositories/auth.repository");
const storage = require("../../../src/services/cloudinaryEvidence.storage");
const service = require("../../../src/services/incidentEvidence.service");
const user = {
  id: "r",
  role: "RANGER",
  approvalStatus: "APPROVED",
  isActive: true,
};
const media = {
  resourceType: "image",
  format: "jpg",
  fileType: "PHOTO",
  metadata: {
    source: "GALLERY_UPLOAD",
    originalFileName: "photo.jpg",
    mimeType: "image/jpeg",
    fileSize: 5,
  },
  caption: "Snare photo",
  uploadKey: "retry-evidence-key-123",
  sha256: "hash",
  requestHash: "request-hash",
  buffer: Buffer.from("media"),
};
let items, locked, tx, tail;
beforeEach(() => {
  process.env.JWT_SECRET = "evidence-test-only-secret-at-least-32-characters";
  items = [];
  locked = { status: "PENDING", withdrawnAt: null };
  tail = Promise.resolve();
  tx = {
    incidentEvidence: {
      findMany: jest.fn(async () => items),
      create: jest.fn(async ({ data }) => {
        const value = { ...data, id: "e-" + (items.length + 1) };
        items.push(value);
        return value;
      }),
    },
  };
  repository.findIncident.mockImplementation(async (id, reader) =>
    reader.id === "r" || reader.role === "PARK_MANAGER"
      ? { id, patrolId: "p", evidence: items }
      : null,
  );
  repository.lockIncident.mockImplementation(async () => locked);
  repository.withActivePatrol.mockImplementation((p, r, action) => {
    const result = tail.then(() => action(tx));
    tail = result.catch(() => {});
    return result;
  });
  storage.assertConfigured.mockImplementation(() => {});
  storage.remove.mockResolvedValue();
  storage.upload.mockImplementation(async (m, id) => ({
    asset_id: "asset",
    public_id: id,
    resource_type: m.resourceType,
    type: "authenticated",
    format: m.format,
    version: 1,
    bytes: 5,
    width: 1,
    height: 1,
    duration: 1,
  }));
  accounts.findSessionUser.mockResolvedValue(user);
});
test("private asset metadata saved without media binaries/public URLs and safe serialized result", async () => {
  const result = await service.upload("i", media, user);
  expect(items[0].fileUrl).toMatch(/^cloudinary:authenticated:image:/);
  expect(items[0].metadata.storage).toMatchObject({
    provider: "cloudinary",
    type: "authenticated",
    assetId: "asset",
    uploadKey: media.uploadKey,
  });
  expect(items[0]).not.toHaveProperty("buffer");
  expect(result.fileUrl).toBeNull();
  expect(result.metadata).not.toHaveProperty("storage");
});
test("retry key prevents duplicate asset and evidence records, mismatched reuse fails", async () => {
  const first = await service.upload("i", media, user);
  const second = await service.upload("i", media, user);
  expect(second.id).toBe(first.id);
  expect(items).toHaveLength(1);
  expect(storage.upload).toHaveBeenCalledTimes(1);
  await expect(
    service.upload("i", { ...media, requestHash: "different" }, user),
  ).rejects.toMatchObject({ status: 409 });
});
test("maximum five enforced before remote upload and again after competing finalizations", async () => {
  items = Array.from({ length: 4 }, (_, n) => ({
    id: "old-" + n,
    metadata: {},
  }));
  await Promise.allSettled([
    service.upload("i", media, user),
    service.upload("i", { ...media, uploadKey: "other-retry-key-123" }, user),
  ]);
  expect(items).toHaveLength(5);
  expect(storage.remove).toHaveBeenCalledTimes(1);
  await expect(
    service.upload("i", { ...media, uploadKey: "third-retry-key-123" }, user),
  ).rejects.toMatchObject({ status: 409 });
});
test.each([{ status: "UNDER_REVIEW" }, { withdrawnAt: new Date() }])(
  "locked incident blocks remote upload %j",
  async (change) => {
    locked = { ...locked, ...change };
    await expect(service.upload("i", media, user)).rejects.toMatchObject({
      status: 409,
    });
    expect(storage.upload).not.toHaveBeenCalled();
  },
);
test("other Ranger cannot access incident or upload", async () => {
  await expect(
    service.upload("i", media, { ...user, id: "other" }),
  ).rejects.toMatchObject({ status: 404 });
  expect(storage.upload).not.toHaveBeenCalled();
});
test("completion while upload runs rechecks lock and removes newly uploaded asset", async () => {
  const error = Object.assign(new Error("Completed"), {
    status: 409,
    incidentError: true,
  });
  storage.upload.mockImplementation(async (m, id) => {
    repository.withActivePatrol.mockRejectedValue(error);
    return {
      asset_id: "asset",
      public_id: id,
      resource_type: "image",
      type: "authenticated",
      format: "jpg",
      version: 1,
      bytes: 5,
      width: 1,
      height: 1,
    };
  });
  await expect(service.upload("i", media, user)).rejects.toMatchObject({
    status: 409,
  });
  expect(storage.remove).toHaveBeenCalledWith(
    expect.stringMatching(/^wildguard-incidents\/i\//),
    "image",
  );
  expect(items).toHaveLength(0);
});
test("account/session recheck failure and DB failure both clean up without deleting incident", async () => {
  await expect(
    service.upload("i", media, user, async () => {
      throw Object.assign(new Error("expired"), {
        authError: true,
        status: 401,
      });
    }),
  ).rejects.toMatchObject({ status: 401 });
  expect(storage.remove).toHaveBeenCalled();
  expect(items).toHaveLength(0);
  tx.incidentEvidence.create.mockRejectedValue(new Error("private DB error"));
  await expect(service.upload("i", media, user)).rejects.toMatchObject({
    status: 503,
    evidenceError: true,
  });
  expect(items).toHaveLength(0);
});
test("public or invalid provider result is rejected and deleted", async () => {
  storage.upload.mockResolvedValue({
    type: "upload",
    secure_url: "https://public.example/file",
  });
  await expect(service.upload("i", media, user)).rejects.toMatchObject({
    status: 400,
  });
  expect(storage.remove).toHaveBeenCalled();
  expect(items).toHaveLength(0);
});
test("cleanup failure remains explicit, never fabricated as success", async () => {
  storage.upload.mockRejectedValue(new Error("SDK private details"));
  storage.remove.mockRejectedValue(
    Object.assign(new Error("cleanup unconfirmed"), {
      evidenceError: true,
      status: 503,
      code: "MEDIA_CLEANUP_FAILED",
    }),
  );
  await expect(service.upload("i", media, user)).rejects.toMatchObject({
    code: "MEDIA_CLEANUP_FAILED",
  });
  expect(items).toHaveLength(0);
});
test("time-limited tickets keep cloud credentials private, recheck account and owner, work for manager after completion", async () => {
  await service.upload("i", media, user);
  const access = await service.access(
    "i",
    "e-1",
    user,
    Math.floor(Date.now() / 1000) + 3600,
  );
  expect(access.path).toMatch(/^\/incidents\/i\/evidence\/e-1\/media\?ticket=/);
  expect(access.path).not.toMatch(/api_key|cloudinary/);
  const ticket = decodeURIComponent(access.path.split("ticket=")[1]);
  expect(
    jwt.decode(ticket).exp - Math.floor(Date.now() / 1000),
  ).toBeLessThanOrEqual(300);
  expect((await service.media("i", "e-1", ticket)).asset.type).toBe(
    "authenticated",
  );
  await expect(service.media("i", "different", ticket)).rejects.toMatchObject({
    status: 403,
  });
  accounts.findSessionUser.mockResolvedValue({ ...user, isActive: false });
  await expect(service.media("i", "e-1", ticket)).rejects.toMatchObject({
    status: 403,
  });
  accounts.findSessionUser.mockResolvedValue({
    ...user,
    id: "manager",
    role: "PARK_MANAGER",
  });
  const managerAccess = await service.access(
    "i",
    "e-1",
    { ...user, id: "manager", role: "PARK_MANAGER" },
    Math.floor(Date.now() / 1000) + 30,
  );
  expect(
    (
      await service.media(
        "i",
        "e-1",
        decodeURIComponent(managerAccess.path.split("ticket=")[1]),
      )
    ).evidence.id,
  ).toBe("e-1");
  await expect(service.media("i", "e-1", "invalid")).rejects.toMatchObject({
    status: 401,
  });
});

test("private media rechecks incident assignment after an access ticket was issued", async () => {
  await service.upload("i", media, user);
  const access = await service.access(
    "i",
    "e-1",
    user,
    Math.floor(Date.now() / 1000) + 3600,
  );
  repository.findIncident.mockResolvedValue(null);
  await expect(
    service.media(
      "i",
      "e-1",
      decodeURIComponent(access.path.split("ticket=")[1]),
    ),
  ).rejects.toMatchObject({ status: 404 });
});

test("invalid media ticket is distinct from expiry", async () => {
  await expect(service.media("i", "e-1", "invalid")).rejects.toMatchObject({ status: 401, code: "MEDIA_ACCESS_INVALID" });
});

test("missing signing configuration is not mislabeled as expired access", async () => {
  const secret = process.env.JWT_SECRET;
  try {
    delete process.env.JWT_SECRET;
    await expect(service.media("i", "e-1", "invalid")).rejects.toMatchObject({ status: 503, code: "MEDIA_ACCESS_UNAVAILABLE" });
  } finally { process.env.JWT_SECRET = secret; }
});

test("audio-only media disguised as video fails provider content validation and is cleaned up", async () => {
  const video = {
    ...media,
    resourceType: "video",
    fileType: "VIDEO",
    format: "mp4",
  };
  storage.upload.mockImplementation(async (m, id) => ({
    asset_id: "asset",
    public_id: id,
    resource_type: "video",
    type: "authenticated",
    format: "mp4",
    version: 1,
    bytes: 5,
    duration: 1,
  }));
  await expect(service.upload("i", video, user)).rejects.toMatchObject({
    status: 400,
  });
  expect(storage.remove).toHaveBeenCalled();
  expect(items).toHaveLength(0);
});
