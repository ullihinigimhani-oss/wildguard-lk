const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const UPLOAD_DIR = path.resolve(__dirname, "../../uploads/evidence");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

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
exports.storeEvidence = async ({ data, mimeType, originalName = "" }) => {
  const normalizedMime = (mimeType || "").trim().toLowerCase();
  const config = ALLOWED_MIME_TYPES[normalizedMime];

  if (!config) {
    const error = new Error("Unsupported file type. Supported formats: JPEG, PNG, WEBP, HEIC, MP4, MOV, WEBM.");
    error.status = 400;
    error.validationError = true;
    error.fields = { fileType: "Unsupported MIME type." };
    throw error;
  }

  let buffer;
  if (Buffer.isBuffer(data)) {
    buffer = data;
  } else if (typeof data === "string") {
    // Strip data URI prefix if present (e.g. data:image/jpeg;base64,...)
    const base64Clean = data.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "");
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

  // Generate safe sanitized filename with crypto UUID
  const safeId = crypto.randomUUID();
  const safeFileName = `evidence-${Date.now()}-${safeId}${config.ext}`;
  const targetPath = path.resolve(UPLOAD_DIR, safeFileName);

  // Prevent directory traversal
  if (!targetPath.startsWith(UPLOAD_DIR)) {
    const error = new Error("Unsafe file path detected.");
    error.status = 400;
    throw error;
  }

  await fs.promises.writeFile(targetPath, buffer);

  const fileUrl = `/uploads/evidence/${safeFileName}`;

  return {
    fileUrl,
    fileType: normalizedMime,
    fileSize: buffer.length,
    fileName: safeFileName,
  };
};

exports.ALLOWED_MIME_TYPES = ALLOWED_MIME_TYPES;
exports.UPLOAD_DIR = UPLOAD_DIR;
