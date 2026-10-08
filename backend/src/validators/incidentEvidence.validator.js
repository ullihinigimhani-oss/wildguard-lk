const path = require("node:path");
const { createHash } = require("node:crypto");
const { onlyKeys, validateMetadata } = require("./incident.validator");
const IMAGE_LIMIT = 10 * 1024 * 1024,
  VIDEO_LIMIT = 50 * 1024 * 1024,
  MAX_ITEMS = 5;
const formats = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};
const evidenceError = (status, code, message) =>
  Object.assign(new Error(message), { status, code, evidenceError: true });
exports.evidenceError = evidenceError;
exports.limits = { IMAGE_LIMIT, VIDEO_LIMIT, MAX_ITEMS };
exports.validateUpload = async (file, fields) => {
  onlyKeys(fields, [
    "source",
    "capturedAt",
    "cameraTrapId",
    "notes",
    "caption",
    "uploadKey",
  ]);
  if (!file?.buffer?.length)
    throw evidenceError(400, "MEDIA_REQUIRED", "Select a photo or video.");
  let detected;
  try {
    detected = await require("file-type").fileTypeFromBuffer(file.buffer);
  } catch {
    /* fail closed */
  }
  if (!detected || !formats[detected.mime])
    throw evidenceError(
      400,
      "MEDIA_UNSUPPORTED",
      "Use a JPEG, PNG, WebP, HEIC photo or MP4, MOV, WebM video.",
    );
  if (![detected.mime, "application/octet-stream"].includes(file.mimetype))
    throw evidenceError(
      400,
      "MEDIA_MISMATCH",
      "The media content does not match its MIME type.",
    );
  const resourceType = detected.mime.startsWith("image/") ? "image" : "video";
  if (
    file.buffer.length > (resourceType === "image" ? IMAGE_LIMIT : VIDEO_LIMIT)
  )
    throw evidenceError(
      413,
      "MEDIA_TOO_LARGE",
      "Photos must be at most 10 MB and videos at most 50 MB.",
    );
  if (
    typeof fields.uploadKey !== "string" ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(fields.uploadKey)
  )
    throw evidenceError(
      400,
      "UPLOAD_KEY_REQUIRED",
      "A valid upload retry key is required.",
    );
  if (fields.caption !== undefined && typeof fields.caption !== "string")
    throw evidenceError(400, "CAPTION_INVALID", "Enter a text caption.");
  const caption = fields.caption === undefined ? null : fields.caption.trim();
  if (caption?.length > 500)
    throw evidenceError(
      400,
      "CAPTION_INVALID",
      "Use up to 500 characters for the caption.",
    );
  const metadata = validateMetadata({
    source: fields.source,
    originalFileName: path.basename(file.originalname).slice(0, 255),
    mimeType: detected.mime,
    fileSize: file.buffer.length,
    ...Object.fromEntries(
      ["capturedAt", "cameraTrapId", "notes"]
        .filter((key) => fields[key] !== undefined)
        .map((key) => [key, fields[key]]),
    ),
  }).metadata;
  if (metadata.source === "CAMERA_TRAP" && !metadata.cameraTrapId)
    throw evidenceError(
      400,
      "CAMERA_TRAP_REQUIRED",
      "Enter the camera trap ID.",
    );
  const sha256 = createHash("sha256").update(file.buffer).digest("hex");
  const requestHash = createHash("sha256")
    .update(JSON.stringify({ sha256, metadata, caption }))
    .digest("hex");
  return {
    buffer: file.buffer,
    resourceType,
    format: formats[detected.mime],
    fileType: resourceType === "image" ? "PHOTO" : "VIDEO",
    metadata,
    caption,
    uploadKey: fields.uploadKey,
    sha256,
    requestHash,
  };
};
