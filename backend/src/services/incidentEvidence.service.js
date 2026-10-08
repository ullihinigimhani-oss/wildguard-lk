const { randomUUID } = require("node:crypto");
const jwt = require("jsonwebtoken");
const repository = require("../repositories/incident.repository");
const accounts = require("../repositories/auth.repository");
const storage = require("./cloudinaryEvidence.storage");
const {
  evidenceError,
  limits,
} = require("../validators/incidentEvidence.validator");
const { incidentError } = require("../validators/incident.validator");
const safeEvidence = (item) => ({
  id: item.id,
  fileType: item.fileType,
  caption: item.caption,
  createdAt: item.createdAt,
  fileUrl: null,
  metadata: Object.fromEntries(
    [
      "source",
      "originalFileName",
      "mimeType",
      "fileSize",
      "capturedAt",
      "cameraTrapId",
      "notes",
    ]
      .filter((key) => item.metadata?.[key] !== undefined)
      .map((key) => [key, item.metadata[key]]),
  ),
  mediaAvailable: item.metadata?.storage?.provider === "cloudinary",
});
exports.safeEvidence = safeEvidence;
async function writable(id, user, action) {
  const existing = await repository.findIncident(id, user);
  if (!existing?.patrolId)
    throw incidentError(
      404,
      "INCIDENT_UNAVAILABLE",
      "This incident is not available for evidence uploads.",
    );
  return repository.withActivePatrol(existing.patrolId, user.id, async (tx) => {
    const incident = await repository.lockIncident(
      tx,
      id,
      existing.patrolId,
      user.id,
    );
    if (incident.withdrawnAt || incident.status !== "PENDING")
      throw incidentError(
        409,
        "INCIDENT_REVIEW_LOCKED",
        "This incident is withdrawn or locked for review.",
      );
    return action(tx);
  });
}
exports.preflight = (id, user) => {
  storage.assertConfigured();
  return writable(id, user, () => true);
};
function replay(items, media) {
  const previous = items.find(
    (item) => item.metadata?.storage?.uploadKey === media.uploadKey,
  );
  if (previous && previous.metadata.storage.requestHash !== media.requestHash)
    throw evidenceError(
      409,
      "UPLOAD_KEY_CONFLICT",
      "Use a new retry key for different evidence.",
    );
  return previous;
}
exports.upload = async (
  id,
  media,
  user,
  reauthenticate = async () => user,
  trace = () => {},
) => {
  trace("upload_authorization");
  const previous = await writable(id, user, async (tx) => {
    const items = await tx.incidentEvidence.findMany({
      where: { incidentId: id },
    });
    const existing = replay(items, media);
    if (!existing && items.length >= limits.MAX_ITEMS)
      throw evidenceError(
        409,
        "EVIDENCE_LIMIT",
        "This incident already has five evidence items.",
      );
    return existing;
  });
  if (previous) {
    trace("idempotent_replay");
    return safeEvidence(previous);
  }
  storage.assertConfigured();
  const publicId = `wildguard-incidents/${id}/${randomUUID()}`;
  let asset;
  try {
    trace("cloudinary_upload");
    const cloudStarted = Date.now();
    asset = await storage.upload(media, publicId);
    trace("cloudinary_response_validation", null, Date.now() - cloudStarted);
    // Cloudinary must have decoded the actual content into the expected private media resource.
    if (
      !asset?.asset_id ||
      !Number.isInteger(asset.version) ||
      asset.public_id !== publicId ||
      asset.type !== "authenticated" ||
      asset.resource_type !== media.resourceType ||
      asset.format !== media.format ||
      !Number.isFinite(asset.bytes) ||
      asset.bytes <= 0 ||
      asset.bytes >
        (media.resourceType === "image"
          ? limits.IMAGE_LIMIT
          : limits.VIDEO_LIMIT) ||
      (media.resourceType === "image"
        ? !(asset.width > 0 && asset.height > 0)
        : !(asset.duration > 0 && asset.width > 0 && asset.height > 0))
    )
      throw evidenceError(
        400,
        "MEDIA_INVALID",
        "The storage provider could not validate this media file.",
      );
    trace("session_recheck");
    const current = await reauthenticate();
    if (current.id !== user.id || current.role !== "RANGER")
      throw evidenceError(
        403,
        "EVIDENCE_FORBIDDEN",
        "You cannot upload evidence to this incident.",
      );
    trace("database_finalization");
    const databaseStarted = Date.now();
    const result = await writable(id, current, async (tx) => {
      const items = await tx.incidentEvidence.findMany({
        where: { incidentId: id },
      });
      const existing = replay(items, media);
      if (existing) return { record: existing, duplicate: true };
      if (items.length >= limits.MAX_ITEMS)
        throw evidenceError(
          409,
          "EVIDENCE_LIMIT",
          "This incident already has five evidence items.",
        );
      return {
        record: await tx.incidentEvidence.create({
          data: {
            incidentId: id,
            fileType: media.fileType,
            caption: media.caption,
            fileUrl: `cloudinary:authenticated:${media.resourceType}:${publicId}`,
            metadata: {
              ...media.metadata,
              storage: {
                provider: "cloudinary",
                publicId,
                assetId: asset.asset_id,
                resourceType: media.resourceType,
                type: "authenticated",
                format: asset.format,
                version: asset.version,
                sha256: media.sha256,
                requestHash: media.requestHash,
                uploadKey: media.uploadKey,
              },
            },
          },
        }),
      };
    });
    if (result.duplicate) await storage.remove(publicId, media.resourceType);
    trace("database_finalized", null, Date.now() - databaseStarted);
    return safeEvidence(result.record);
  } catch (error) {
    // Leave the failing stage intact; cleanup must not hide where the upload failed.
    const failure =
      error.evidenceError || error.incidentError || error.authError
        ? error
        : evidenceError(
            503,
            "EVIDENCE_SAVE_FAILED",
            "Evidence could not be saved. The incident is retained; retry this evidence item.",
          );
    trace(null, failure);
    await storage.remove(publicId, media.resourceType);
    throw failure;
  }
};
async function readable(incidentId, evidenceId, user) {
  const incident = await repository.findIncident(incidentId, user);
  const evidence = incident?.evidence?.find((item) => item.id === evidenceId);
  if (!evidence)
    throw incidentError(
      404,
      "EVIDENCE_UNAVAILABLE",
      "This evidence is not available.",
    );
  const asset = evidence.metadata?.storage;
  if (
    asset?.provider !== "cloudinary" ||
    asset.type !== "authenticated" ||
    !["image", "video"].includes(asset.resourceType) ||
    typeof asset.publicId !== "string" ||
    !asset.publicId.startsWith(`wildguard-incidents/${incidentId}/`) ||
    !/^[a-z0-9]+$/.test(asset.format)
  )
    throw evidenceError(
      404,
      "MEDIA_UNAVAILABLE",
      "This evidence has no verified private storage asset.",
    );
  return { evidence, asset };
}
function ticketSecret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw evidenceError(
      503,
      "MEDIA_ACCESS_UNAVAILABLE",
      "Media access is unavailable.",
    );
  return process.env.JWT_SECRET;
}
exports.access = async (incidentId, evidenceId, user, sessionExpiresAt) => {
  await readable(incidentId, evidenceId, user);
  const expires = Math.min(
    Math.floor(Date.now() / 1000) + 300,
    sessionExpiresAt,
  );
  if (!Number.isFinite(expires) || expires <= Math.floor(Date.now() / 1000))
    throw evidenceError(401, "MEDIA_ACCESS_EXPIRED", "Please sign in again.");
  const ticket = jwt.sign(
    { incidentId, evidenceId, exp: expires },
    ticketSecret(),
    {
      subject: user.id,
      algorithm: "HS256",
      issuer: "wildguard-lk",
      audience: "wildguard-evidence",
    },
  );
  return {
    path: `/incidents/${encodeURIComponent(incidentId)}/evidence/${encodeURIComponent(evidenceId)}/media?ticket=${encodeURIComponent(ticket)}`,
    expiresAt: new Date(expires * 1000).toISOString(),
  };
};
exports.media = async (incidentId, evidenceId, ticket) => {
  let claims;
  const secret = ticketSecret();
  try {
    claims = jwt.verify(ticket, secret, {
      algorithms: ["HS256"],
      issuer: "wildguard-lk",
      audience: "wildguard-evidence",
    });
  } catch (error) {
    throw evidenceError(
      401,
      error.name === "TokenExpiredError" ? "MEDIA_ACCESS_EXPIRED" : "MEDIA_ACCESS_INVALID",
      "Media access is invalid or expired. Open the evidence again.",
    );
  }
  if (
    claims.incidentId !== incidentId ||
    claims.evidenceId !== evidenceId ||
    typeof claims.sub !== "string"
  )
    throw evidenceError(
      403,
      "EVIDENCE_FORBIDDEN",
      "This media ticket cannot access that evidence.",
    );
  const user = await accounts.findSessionUser(claims.sub);
  if (
    !user?.isActive ||
    user.approvalStatus !== "APPROVED" ||
    !["RANGER", "PARK_MANAGER"].includes(user.role)
  )
    throw evidenceError(
      403,
      "EVIDENCE_FORBIDDEN",
      "Media access is no longer authorized.",
    );
  return readable(incidentId, evidenceId, user);
};
exports.downloadUrl = storage.downloadUrl;
