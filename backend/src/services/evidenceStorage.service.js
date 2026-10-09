const crypto = require("crypto");
const cloudinaryStorage = require("./cloudinaryEvidence.storage");

const ALLOWED_MIME_TYPES = {
  "image/jpeg": { ext: ".jpg", maxBytes: 10 * 1024 * 1024, type: "image" },
  "image/jpg": { ext: ".jpg", maxBytes: 10 * 1024 * 1024, type: "image" },
  "image/png": { ext: ".png", maxBytes: 10 * 1024 * 1024, type: "image" },
  "image/webp": { ext: ".webp", maxBytes: 10 * 1024 * 1024, type: "image" },
  "image/heic": { ext: ".heic", maxBytes: 10 * 1024 * 1024, type: "image" },
  "video/mp4": { ext: ".mp4", maxBytes: 25 * 1024 * 1024, type: "video" },
  "video/quicktime": { ext: ".mov", maxBytes: 25 * 1024 * 1024, type: "video" },
  "video/webm": { ext: ".webm", maxBytes: 25 * 1024 * 1024, type: "video" },
};

function detectMimeType(buffer, declaredMime) {
  if (!buffer || buffer.length < 4) return null;
  const hex = buffer.slice(0, 12).toString("hex").toLowerCase();

  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (hex.startsWith("89504e47")) return "image/png";
  if (buffer.slice(0, 4).toString() === "RIFF" && buffer.slice(8, 12).toString() === "WEBP") return "image/webp";
  if (hex.includes("66747970") || hex.includes("68656963")) {
    if (declaredMime === "video/quicktime" || declaredMime === "video/mp4") return declaredMime;
    return "image/heic";
  }
  if (buffer.length >= 8 && buffer.slice(4, 8).toString() === "ftyp") {
    return declaredMime === "video/quicktime" ? "video/quicktime" : "video/mp4";
  }
  if (hex.startsWith("1a45dfa3")) return "video/webm";

  return null;
}

/**
 * Validates buffer magic bytes against declared MIME type to prevent spoofing.
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {boolean}
 */
function verifyMagicBytes(buffer, mimeType) {
  if (!buffer || buffer.length < 4) return false;

  const hex = buffer.slice(0, 12).toString("hex").toLowerCase();

  switch (mimeType) {
    case "image/jpeg":
    case "image/jpg":
      return hex.startsWith("ffd8ff");
    case "image/png":
      return hex.startsWith("89504e47");
    case "image/webp":
      return buffer.slice(0, 4).toString() === "RIFF" && buffer.slice(8, 12).toString() === "WEBP";
    case "image/heic":
      return hex.includes("66747970") || hex.includes("68656963");
    case "video/mp4":
    case "video/quicktime":
      // ISO Base Media File Format: bytes 4-8 are 'ftyp'
      return buffer.length >= 8 && buffer.slice(4, 8).toString() === "ftyp";
    case "video/webm":
      // WebM starts with EBML ID: 1A 45 DF A3
      return hex.startsWith("1a45dfa3");
    default:
      return false;
  }
}

/**
 * Save an evidence file from buffer or base64 string safely.
 *
 * @param {object} params
 * @param {string|Buffer} params.data - Base64 string or binary Buffer
 * @param {string} params.mimeType - Declared client MIME type
 * @param {string} [params.originalName] - Original filename from client
 * @returns {{ fileUrl: string, fileType: string, fileSize: number, fileName: string }}
 */
exports.storeEvidence = async (payload = {}) => {
  const { data, mimeType, originalName = "" } = payload || {};
  let normalizedMime = (mimeType || "").trim().toLowerCase();
  if (normalizedMime === "image/jpg") normalizedMime = "image/jpeg";

  let buffer;
  if (Buffer.isBuffer(data)) {
    buffer = data;
  } else if (typeof data === "string") {
    // Strip data URI prefix if present (e.g. data:image/jpeg;base64,...)
    const base64Clean = data.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "").trim();
    buffer = Buffer.from(base64Clean, "base64");
  } else {
    const error = new Error("Invalid file data received.");
    error.status = 400;
    error.validationError = true;
    error.fields = { data: "Invalid file data received." };
    throw error;
  }

  // Check file size
  if (buffer.length === 0) {
    const error = new Error("The uploaded file is empty or corrupted.");
    error.status = 400;
    error.validationError = true;
    error.fields = { data: "The uploaded file is empty or corrupted." };
    throw error;
  }

  // Auto-detect MIME type from magic bytes to avoid client recompression mismatches
  const detectedMime = detectMimeType(buffer, normalizedMime);
  if (detectedMime && ALLOWED_MIME_TYPES[detectedMime]) {
    normalizedMime = detectedMime;
  }

  let config = ALLOWED_MIME_TYPES[normalizedMime];
  if (!config) {
    const error = new Error("Unsupported file type. Supported formats: JPEG, PNG, WEBP, HEIC, MP4, MOV, WEBM.");
    error.status = 400;
    error.validationError = true;
    error.fields = { fileType: "Unsupported MIME type." };
    throw error;
  }

  if (buffer.length > config.maxBytes) {
    const mbLimit = Math.round(config.maxBytes / (1024 * 1024));
    const error = new Error(`File exceeds maximum size limit of ${mbLimit}MB for ${config.type}s.`);
    error.status = 400;
    error.validationError = true;
    error.fields = { fileSize: `Max allowed size is ${mbLimit}MB.` };
    throw error;
  }

  // Validate magic bytes to prevent MIME spoofing
  if (!verifyMagicBytes(buffer, normalizedMime)) {
    const error = new Error("File content does not match the declared MIME type or is corrupted.");
    error.status = 400;
    error.validationError = true;
    error.fields = { fileType: "File content signature verification failed." };
    throw error;
  }

  const publicId = `wildguard-community/evidence/${crypto.randomUUID()}`;
  const resourceType = config.type;
  const format = config.ext.slice(1);
  const asset = await cloudinaryStorage.uploadPublic(
    { buffer, resourceType, format },
    publicId,
  );
  let fileUrl;
  try {
    fileUrl = new URL(asset?.secure_url);
  } catch {
    fileUrl = null;
  }
  if (
    asset.public_id !== publicId ||
    asset.resource_type !== resourceType ||
    !Number.isFinite(asset.bytes) ||
    asset.bytes <= 0 ||
    asset.bytes > config.maxBytes ||
    fileUrl?.protocol !== "https:"
  ) {
    if (asset?.public_id === publicId) {
      await cloudinaryStorage.remove(publicId, resourceType, "upload");
    }
    const { evidenceError } = require("../validators/incidentEvidence.validator");
    throw evidenceError(
      503,
      "MEDIA_UPLOAD_FAILED",
      "Cloudinary could not verify the uploaded evidence. Please retry.",
    );
  }

  return {
    fileUrl: fileUrl.href,
    fileType: normalizedMime,
    fileSize: asset.bytes,
    fileName: `${publicId.split("/").pop()}.${format}`,
  };
};

exports.ALLOWED_MIME_TYPES = ALLOWED_MIME_TYPES;
