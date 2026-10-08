const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const jwt = require("jsonwebtoken");
const auth = require("../services/auth.service");
const service = require("../services/incidentEvidence.service");
const jobs = require("../services/evidenceUploadJobs");
const { id, onlyKeys } = require("../validators/incident.validator");
const {
  validateUpload,
  evidenceError,
} = require("../validators/incidentEvidence.validator");
const bearer = (req) => (req.get("Authorization") || "").slice(7);
const privateHeaders = (res) =>
  res.set({
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
exports.upload = async (req, res, next) => {
  try {
    req.evidenceTrace?.stage("media_validation");
    const media = await validateUpload(req.file, req.body);
    req.evidenceTrace?.stage("media_validated");
    if (req.get("Prefer") === "respond-async") {
      const incidentId = id(req.params.incidentId);
      const job = jobs.create(
        incidentId,
        req.user.id,
        req.evidenceTrace?.requestId,
      );
      const token = bearer(req);
      req.evidenceBackground = true;
      // The multipart body has been received and validated. Closing this receipt
      // connection must not cancel a private upload; status is polled separately.
      privateHeaders(res)
        .status(202)
        .json({ success: true, upload: { id: job.id, status: job.status } });
      void (async () => {
        try {
          const evidence = await service.upload(
            incidentId,
            media,
            req.user,
            () => auth.authenticate(token),
            (stage, error) => {
              if (error) req.evidenceTrace?.fail(error, error.status || 500);
              else {
                job.stage = stage;
                req.evidenceTrace?.stage(stage);
              }
            },
          );
          jobs.complete(job, evidence);
          req.evidenceTrace?.stage("upload_complete");
        } catch (error) {
          jobs.fail(job, error);
          req.evidenceTrace?.fail(error, error.status || 503);
          req.evidenceTrace?.stage(job.stage);
        } finally {
          media.buffer = null;
          if (req.file) req.file.buffer = null;
          req.evidenceRelease?.();
        }
      })();
      return;
    }
    const evidence = await service.upload(
      id(req.params.incidentId),
      media,
      req.user,
      () => {
        if (req.aborted || res.destroyed)
          throw evidenceError(
            503,
            "UPLOAD_INTERRUPTED",
            "The evidence upload was interrupted.",
          );
        return auth.authenticate(bearer(req));
      },
      (stage, error) =>
        error
          ? req.evidenceTrace?.fail(error, error.status || 500)
          : req.evidenceTrace?.stage(stage),
    );
    req.evidenceTrace?.stage("upload_complete");
    privateHeaders(res).status(201).json({ success: true, evidence });
  } catch (error) {
    next(error);
  } finally {
    if (!req.evidenceBackground) {
      if (req.file) req.file.buffer = null;
      req.evidenceRelease?.();
    }
  }
};
exports.uploadStatus = async (req, res, next) => {
  try {
    const incidentId = id(req.params.incidentId);
    // Reload current ownership/assignment as well as the route's current account auth.
    await require("../services/incident.service").getIncident(
      incidentId,
      req.user,
    );
    const job = jobs.find(id(req.params.uploadId), incidentId, req.user.id);
    if (job.status === "FAILED")
      return privateHeaders(res)
        .status(job.error.status)
        .json({
          success: false,
          code: job.error.code,
          message: job.error.message,
          diagnostic: {
            requestId: job.requestId,
            stage: job.stage,
            code: job.error.code,
          },
        });
    return privateHeaders(res).json({
      success: true,
      upload: { id: job.id, status: job.status },
      ...(job.evidence && { evidence: job.evidence }),
    });
  } catch (error) {
    next(error);
  }
};
exports.access = async (req, res, next) => {
  try {
    onlyKeys(req.query, []);
    const access = await service.access(
      id(req.params.incidentId),
      id(req.params.evidenceId),
      req.user,
      jwt.decode(bearer(req))?.exp,
    );
    privateHeaders(res).json({ success: true, access });
  } catch (error) {
    next(error);
  }
};
exports.media = async (req, res, next) => {
  try {
    onlyKeys(req.query, ["ticket"]);
    if (typeof req.query.ticket !== "string" || req.query.ticket.length > 2048)
      throw evidenceError(
        401,
        "MEDIA_ACCESS_EXPIRED",
        "Open the evidence to request media access.",
      );
    const { evidence, asset } = await service.media(
      id(req.params.incidentId),
      id(req.params.evidenceId),
      req.query.ticket,
    );
    const range = req.get("Range");
    if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range))
      throw evidenceError(400, "RANGE_INVALID", "Invalid media range.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    res.once("close", () => controller.abort());
    try {
      const response = await fetch(service.downloadUrl(asset), {
        signal: controller.signal,
        redirect: "error",
        headers: range ? { Range: range } : {},
      });
      if (![200, 206].includes(response.status) || !response.body)
        throw evidenceError(
          503,
          "MEDIA_READ_FAILED",
          "Unable to load private evidence. Refresh media access and retry.",
        );
      privateHeaders(res)
        .status(response.status)
        .type(evidence.metadata.mimeType);
      for (const header of [
        "content-length",
        "content-range",
        "accept-ranges",
      ]) {
        const value = response.headers.get(header);
        if (value) res.set(header, value);
      }
      await pipeline(Readable.fromWeb(response.body), res);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    next(
      error.evidenceError || error.incidentError
        ? error
        : evidenceError(
            503,
            "MEDIA_READ_FAILED",
            "Unable to load private evidence. Open it again to retry.",
          ),
    );
  }
};
