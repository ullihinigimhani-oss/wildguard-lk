const TYPES = {
  POACHING_SNARE: "Poaching / Snare",
  ILLEGAL_CAMPSITE: "Illegal Campsite",
  WILDLIFE_CONFLICT: "Wildlife Conflict",
  ANIMAL_CARCASS: "Animal Carcass"
};
const STATUSES = ["PENDING", "UNDER_REVIEW", "RESPONDING", "RESOLVED"];
const incidentError = (status, code, message) => Object.assign(new Error(message), {
  status,
  code,
  incidentError: true
});
const invalid = fields => Object.assign(new Error("Please check your incident details."), {
  status: 400,
  validationError: true,
  fields
});
const object = value => value && typeof value === "object" && !Array.isArray(value);
function onlyKeys(input, allowed) {
  if (!object(input)) throw invalid({
    body: "Expected a JSON object."
  });
  const unknown = Object.keys(input).filter(key => !allowed.includes(key));
  if (unknown.length) throw invalid({
    body: "Unsupported fields: " + unknown.join(", ")
  });
}
function text(value, key, min, max) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw invalid({
    [key]: "Enter " + min + " to " + max + " characters."
  });
  return value.trim();
}
function dateTime(value, key, allowFuture = false) {
  // Require an absolute ISO timestamp; never infer device/server timezones.
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw invalid({
    [key]: "Enter an ISO date/time with a timezone."
  });
  const calendar = value.slice(0, 10),
    day = new Date(calendar + "T00:00:00Z");
  const date = new Date(value);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== calendar || !Number.isFinite(date.getTime()) || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59 || !allowFuture && date > new Date()) throw invalid({
    [key]: "Enter a valid date/time that is not in the future."
  });
  return date;
}
function id(value, key = "id") {
  return text(value, key, 1, 128);
}
function validateMetadata(value) {
  const keys = ["source", "originalFileName", "mimeType", "fileSize", "capturedAt", "cameraTrapId", "notes"];
  onlyKeys(value, keys);
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > 4096) throw invalid({
    metadata: "Use up to 4 KB of metadata; binary data is not allowed."
  });
  if (!["PHONE_CAMERA", "GALLERY_UPLOAD", "CAMERA_TRAP"].includes(value.source)) throw invalid({
    source: "Select a supported evidence source."
  });
  const result = {
    source: value.source,
    originalFileName: text(value.originalFileName, "originalFileName", 1, 255),
    mimeType: text(value.mimeType, "mimeType", 1, 100)
  };
  const media = {
    "image/jpeg": "PHOTO",
    "image/png": "PHOTO",
    "image/webp": "PHOTO",
    "image/heic": "PHOTO",
    "video/mp4": "VIDEO",
    "video/quicktime": "VIDEO",
    "video/webm": "VIDEO"
  };
  if (!Object.hasOwn(media, result.mimeType)) throw invalid({
    mimeType: "Unsupported photo/video MIME type."
  });
  if (!Number.isSafeInteger(value.fileSize) || value.fileSize < 1 || value.fileSize > 500 * 1024 * 1024) throw invalid({
    fileSize: "Enter a file size from 1 byte to 500 MB."
  });
  result.fileSize = value.fileSize;
  if (value.capturedAt !== undefined) result.capturedAt = dateTime(value.capturedAt, "capturedAt").toISOString();
  if (value.cameraTrapId !== undefined) result.cameraTrapId = id(value.cameraTrapId, "cameraTrapId");
  if (value.notes !== undefined) result.notes = text(value.notes, "notes", 0, 1000);
  return {
    metadata: result,
    fileType: media[result.mimeType]
  };
}
function validateEvidence(evidence) {
  if (!Array.isArray(evidence) || evidence.length > 20) throw invalid({
    evidence: "Use an array of up to 20 evidence items."
  });
  return evidence.map(item => {
    onlyKeys(item, ["uploadId", "fileType", "caption", "metadata"]);
    const validated = validateMetadata(item.metadata);
    if (item.fileType !== validated.fileType) throw invalid({
      fileType: "Evidence type must match the photo/video MIME type."
    });
    return {
      uploadId: id(item.uploadId, "uploadId"),
      fileType: item.fileType,
      caption: item.caption === undefined ? null : text(item.caption, "caption", 0, 500),
      metadata: validated.metadata
    };
  });
}
const fields = ["title", "incidentType", "description", "occurredAt", "latitude", "longitude", "manualLocation", "status"];
function validateIncident(body, patch = false) {
  onlyKeys(body, patch ? fields : [...fields, "evidence"]);
  if (patch && !Object.keys(body).length) throw invalid({
    body: "Provide at least one editable field."
  });
  const result = {};
  for (const [key, min, max] of [["title", 3, 150], ["description", 3, 5000]]) if (!patch || body[key] !== undefined) result[key] = text(body[key], key, min, max);
  if (!patch || body.incidentType !== undefined) {
    if (typeof body.incidentType !== "string" || !Object.hasOwn(TYPES, body.incidentType)) throw invalid({
      incidentType: "Select a supported incident type."
    });
    result.incidentType = body.incidentType;
  }
  if (patch && body.status !== undefined) {
    if (!STATUSES.includes(body.status)) throw invalid({
      status: "Select a supported incident status."
    });
    result.status = body.status;
  }
  if (!patch || body.occurredAt !== undefined) result.occurredAt = dateTime(body.occurredAt, "occurredAt");
  // GPS values must be supplied together; no coercion, nulls or invented values.
  if (!patch || body.latitude !== undefined || body.longitude !== undefined) {
    for (const [key, max] of [["latitude", 90], ["longitude", 180]]) {
      if (typeof body[key] !== "number" || !Number.isFinite(body[key]) || Math.abs(body[key]) > max) throw invalid({
        [key]: "Enter a finite coordinate between -" + max + " and " + max + "."
      });
      result[key] = body[key];
    }
  }
  if (body.manualLocation !== undefined) result.manualLocation = body.manualLocation === null ? null : text(body.manualLocation, "manualLocation", 0, 200);
  if (!patch) result.evidence = body.evidence === undefined ? [] : validateEvidence(body.evidence);
  return result;
}
function validateFilters(query, manager = false) {
  onlyKeys(query, manager ? ["page", "patrolId", "rangerId", "parkId", "incidentType", "status", "from", "to", "includeWithdrawn"] : ["page", "includeWithdrawn"]);
  const page = query.page === undefined ? "1" : query.page;
  if (typeof page !== "string" || !/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 100000) throw invalid({
    page: "Enter a page from 1 to 100000."
  });
  if (query.includeWithdrawn !== undefined && !["true", "false"].includes(query.includeWithdrawn)) throw invalid({
    includeWithdrawn: "Use true or false."
  });
  const where = query.includeWithdrawn === "true" ? {} : {
    withdrawnAt: null
  };
  for (const key of ["patrolId", "parkId"]) if (query[key] !== undefined) where[key] = id(query[key], key);
  if (query.rangerId !== undefined) where.reporterId = id(query.rangerId, "rangerId");
  if (query.incidentType !== undefined) {
    if (typeof query.incidentType !== "string" || !Object.hasOwn(TYPES, query.incidentType)) throw invalid({
      incidentType: "Select a supported incident type."
    });
    where.incidentType = query.incidentType;
  }
  if (query.status !== undefined) {
    if (!STATUSES.includes(query.status)) throw invalid({
      status: "Select a supported incident status."
    });
    where.status = query.status;
  }
  if (query.from !== undefined || query.to !== undefined) {
    const from = query.from === undefined ? null : dateTime(query.from, "from", true),
      to = query.to === undefined ? null : dateTime(query.to, "to", true);
    if (from && to && from > to) throw invalid({
      to: "End date must not precede the start date."
    });
    where.occurredAt = {
      ...(from && {
        gte: from
      }),
      ...(to && {
        lte: to
      })
    };
  }
  return {
    where,
    page: Number(page)
  };
}
module.exports = {
  TYPES,
  STATUSES,
  incidentError,
  validateIncident,
  validateFilters,
  validateMetadata,
  validateEvidence,
  id,
  onlyKeys
};
