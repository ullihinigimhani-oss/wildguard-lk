const { randomUUID } = require("node:crypto");
const { evidenceError } = require("../validators/incidentEvidence.validator");
// Bounded, ephemeral receipts only. No binaries, credentials or provider URLs are stored here.
const jobs = new Map();
function prune() {
  const now = Date.now();
  for (const [key, job] of jobs)
    if (job.finishedAt && now - job.finishedAt > 600000) jobs.delete(key);
}
exports.create = (incidentId, ownerId, requestId) => {
  prune();
  if (jobs.size >= 100)
    throw evidenceError(
      429,
      "UPLOAD_BUSY",
      "Upload receipts are busy. Retry shortly.",
    );
  const job = {
    id: randomUUID(),
    incidentId,
    ownerId,
    requestId,
    stage: "media_validated",
    status: "PROCESSING",
  };
  jobs.set(job.id, job);
  return job;
};
exports.find = (jobId, incidentId, ownerId) => {
  prune();
  const job = jobs.get(jobId);
  if (!job || job.incidentId !== incidentId || job.ownerId !== ownerId)
    throw evidenceError(
      404,
      "UPLOAD_RECEIPT_UNAVAILABLE",
      "Upload receipt expired or is unavailable. Retry the same evidence key.",
    );
  return job;
};
exports.complete = (job, evidence) => {
  job.status = "COMPLETE";
  job.evidence = evidence;
  job.finishedAt = Date.now();
};
exports.fail = (job, error) => {
  job.status = "FAILED";
  job.finishedAt = Date.now();
  const known = error.evidenceError || error.incidentError || error.authError;
  job.error = {
    status: known ? error.status : 503,
    code: known ? error.code : "EVIDENCE_SAVE_FAILED",
    message:
      "Evidence was not confirmed. Retry the same item; the incident remains saved.",
  };
};
