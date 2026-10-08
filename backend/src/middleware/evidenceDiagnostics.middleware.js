const { randomUUID } = require("node:crypto");
// Only this whitelist is logged. Never serialize request bodies, provider errors or URLs.
const codes = new Set([
  "MEDIA_REQUIRED",
  "MEDIA_UNSUPPORTED",
  "MEDIA_MISMATCH",
  "MEDIA_TOO_LARGE",
  "MEDIA_INVALID",
  "UPLOAD_LIMIT",
  "MULTIPART_INVALID",
  "UPLOAD_BUSY",
  "UPLOAD_INTERRUPTED",
  "EVIDENCE_STORAGE_UNAVAILABLE",
  "CLOUDINARY_AUTH_FAILED",
  "CLOUDINARY_TIMEOUT",
  "MEDIA_UPLOAD_FAILED",
  "MEDIA_CLEANUP_FAILED",
  "EVIDENCE_SAVE_FAILED",
  "PATROL_NOT_ACTIVE",
  "PATROL_UNAVAILABLE",
  "INCIDENT_UNAVAILABLE",
  "INCIDENT_REVIEW_LOCKED",
  "INCIDENT_CHANGED",
  "EVIDENCE_LIMIT",
  "UPLOAD_KEY_CONFLICT",
  "UPLOAD_KEY_REQUIRED",
  "CAPTION_INVALID",
  "CAMERA_TRAP_REQUIRED",
  "EVIDENCE_FORBIDDEN",
]);
codes.add("CLOUDINARY_CONFIG_REJECTED");
exports.safeCode = (error, status) =>
  codes.has(error?.code)
    ? error.code
    : status === 401
      ? "AUTHENTICATION_FAILED"
      : status === 403
        ? "AUTHORIZATION_FAILED"
        : status === 400
          ? "VALIDATION_FAILED"
          : "UPLOAD_REQUEST_FAILED";
exports.start = (req, res, next) => {
  const supplied = req.get("X-Evidence-Request-ID");
  const requestId =
    typeof supplied === "string" && /^[A-Za-z0-9-]{16,80}$/.test(supplied)
      ? supplied
      : randomUUID();
  const incidentId = /^[A-Za-z0-9_-]{1,100}$/.test(req.params.incidentId || "")
    ? req.params.incidentId
    : "invalid";
  const started = Date.now();
  let stage = "request_received",
    code, durationMs;
  const log = (httpStatus) => {
    console.info(
      JSON.stringify({
        requestId,
        incidentId,
        stage,
        ...(httpStatus && { httpStatus }),
        ...(code && { code }),
        ...(req.file && {
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
        }),
        elapsedMs: Date.now() - started,
        ...(Number.isFinite(durationMs) && { durationMs }),
      }),
    );
  };
  req.evidenceTrace = {
    requestId,
    stage: (value, duration) => {
      stage = value;
      durationMs = duration;
      log();
    },
    fail: (error, status) => {
      code = code || exports.safeCode(error, status);
    },
    current: () => stage,
  };
  res.set("X-Evidence-Request-ID", requestId);
  const json = res.json.bind(res);
  res.json = (body) => {
    if (body?.success === false) {
      code = code || exports.safeCode(body, res.statusCode);
      body = { ...body, diagnostic: { requestId, stage, code } };
    }
    return json(body);
  };
  res.once("finish", () => log(res.statusCode));
  res.once("close", () => {
    if (!res.writableFinished) {
      code = "UPLOAD_INTERRUPTED";
      log(499);
    }
  });
  log();
  next();
};
