import { Platform } from "react-native";
import {
  ensureEvidencePrepared,
  discardEvidenceFile,
} from "../utils/incidentEvidence";
import { api } from "./api";

export async function uploadIncidentEvidence(incidentId, item, onProgress, options = {}) {
  const started = Date.now();
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  const body = new FormData();
  const name = item.name || "evidence";
  if (Platform.OS === "web") {
    const file = item.file || (await (await fetch(item.uri)).blob());
    body.append("file", file, name);
  } else {
    await ensureEvidencePrepared(item);
    body.append("file", {
      uri: item.uri,
      name,
      type: item.mimeType || "application/octet-stream",
    });
  }
  for (const key of [
    "source",
    "uploadKey",
    "caption",
    "cameraTrapId",
    "capturedAt",
    "notes",
  ])
    if (item[key]) body.append(key, item[key]);
  let response;
  const transferStarted = Date.now();
  try {
    response = await api.post(
      `/incidents/${encodeURIComponent(incidentId)}/evidence`,
      body,
      {
        timeout: 300000,
        signal: options.signal,
        ...(Platform.OS !== "web" && { adapter: "xhr" }),
        // The RN/browser adapter owns Content-Type and its boundary.
        headers: {
          "X-Evidence-Request-ID": requestId,
          Prefer: "respond-async",
        },
        onUploadProgress: (event) =>
          onProgress?.(
            event.total
              ? Math.min(99, Math.round((event.loaded / event.total) * 100))
              : null,
          ),
      },
    );
  } catch (error) {
    // Do not log Axios errors: they contain auth headers, file URIs and request data.
    error.evidenceDiagnostic = { requestId, stage: "client_transport" };
    throw error;
  }
  let { data } = response;
  console.info(JSON.stringify({ requestId, incidentId, stage: "multipart_transfer", elapsedMs: Date.now() - transferStarted, fileSize: item.size, httpStatus: response.status }));
  if (data?.success && data.upload?.status === "PROCESSING") {
    const jobId = data.upload.id;
    if (typeof jobId !== "string" || !/^[A-Za-z0-9-]{1,100}$/.test(jobId))
      throw new Error("The server did not confirm the upload receipt.");
    const deadline = Date.now() + 240000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        const status = await api.get(
          `/incidents/${encodeURIComponent(incidentId)}/evidence/uploads/${encodeURIComponent(jobId)}`,
          { timeout: 15000, signal: options.signal },
        );
        data = status.data;
      } catch (error) {
        error.evidenceDiagnostic = { requestId, stage: "client_transport" };
        throw error;
      }
      if (data?.evidence?.id) break;
      if (!data?.success || data.upload?.status !== "PROCESSING")
        throw new Error("The server did not confirm the evidence.");
    }
    if (!data?.evidence?.id)
      throw Object.assign(new Error("Evidence processing timed out."), {
        code: "ETIMEDOUT",
        evidenceDiagnostic: { requestId, stage: "client_transport" },
      });
  }
  if (!data?.success || !data.evidence?.id)
    throw new Error("The server did not confirm the evidence.");
  if (!options.retainLocal) discardEvidenceFile(item);
  console.info(JSON.stringify({ requestId, incidentId, stage: "client_upload_complete", elapsedMs: Date.now() - started, fileSize: item.size }));
  return data.evidence;
}
export async function getEvidenceAccess(incidentId, evidenceId) {
  const { data } = await api.get(
    `/incidents/${encodeURIComponent(incidentId)}/evidence/${encodeURIComponent(evidenceId)}/access`,
  );
  const expected = `/incidents/${encodeURIComponent(incidentId)}/evidence/${encodeURIComponent(evidenceId)}/media?ticket=`;
  if (
    !data?.success ||
    !data.access?.path?.startsWith(expected) ||
    !Number.isFinite(Date.parse(data.access.expiresAt))
  )
    throw new Error("Private media access could not be confirmed.");
  return {
    uri: api.defaults.baseURL.replace(/\/$/, "") + data.access.path,
    expiresAt: data.access.expiresAt,
  };
}
function errorMessage(error) {
  if (error?.code === "LOCAL_MEDIA_UNAVAILABLE")
    return "The selected file is unavailable or changed. Remove it and select it again. Your incident is saved.";
  const status = error?.response?.status;
  const code = error?.response?.data?.code;
  if (code === "UPLOAD_RECEIPT_UNAVAILABLE")
    return "The upload receipt expired or the backend restarted. Retry the same evidence item; its upload key prevents duplicate records.";
  if (code === "MEDIA_CLEANUP_FAILED")
    return "Private asset cleanup could not be confirmed. Contact an administrator before retrying.";
  if (code === "EVIDENCE_STORAGE_UNAVAILABLE")
    return "Cloudinary configuration is missing on the backend. Your incident is saved; ask an administrator to check storage configuration.";
  if (["CLOUDINARY_AUTH_FAILED", "CLOUDINARY_CONFIG_REJECTED"].includes(code))
    return "Cloudinary rejected the backend storage configuration or credentials. Your incident is saved; contact an administrator.";
  if (code === "CLOUDINARY_TIMEOUT")
    return "Private storage timed out. Your incident is saved; retry this evidence item.";
  if (code === "MEDIA_UPLOAD_FAILED")
    return "Private storage upload failed. Your incident is saved; retry this evidence item.";
  if (code === "EVIDENCE_SAVE_FAILED")
    return "The evidence database record could not be finalized. Your incident is saved; retry this evidence item.";
  if (code === "PATROL_NOT_ACTIVE")
    return "Your patrol is no longer in progress. The saved incident remains available, but evidence uploads are locked.";
  if (code === "MULTIPART_INVALID" || code === "MEDIA_REQUIRED")
    return "The server did not receive a valid file. Select the photo/video again and retry.";
  if (!error?.response && ["ECONNABORTED", "ETIMEDOUT"].includes(error?.code))
    return "The upload request timed out. Your incident is saved; retry the same evidence item.";
  if (!error?.response)
    return "The evidence request could not reach the backend or its response was lost. Check your connection and retry the same item; your incident is saved.";
  if (status === 400)
    return "This file or its details are not valid. Use a supported photo/video and check camera trap details.";
  if (status === 413)
    return "Photos must be at most 10 MB and videos at most 50 MB.";
  if (status === 409)
    return "The incident is locked, the evidence limit is reached, or this retry differs from the original upload. Refresh incident details.";
  if ([401, 403, 404].includes(status))
    return "This evidence is no longer accessible. Refresh details or sign in again.";
  if (status === 429) return "Another upload is running. Wait, then retry.";
  if (error?.response?.data?.code === "MEDIA_CLEANUP_FAILED")
    return "Private asset cleanup could not be confirmed. Contact an administrator before retrying.";
  if (status === 503)
    return "Secure evidence storage is unavailable or the upload could not be saved. Your incident is retained.";
  return "Evidence could not be uploaded or loaded. Check your connection and retry. Your incident is retained.";
}
export function evidenceError(error) {
  const diagnostic =
    error?.response?.data?.diagnostic || error?.evidenceDiagnostic;
  const requestId = diagnostic?.requestId;
  const stage = diagnostic?.stage;
  const stages = [
    "request_received",
    "authenticated",
    "authorization_preflight",
    "multipart_receiving",
    "file_received",
    "media_validation",
    "media_validated",
    "upload_authorization",
    "cloudinary_upload",
    "cloudinary_response_validation",
    "session_recheck",
    "database_finalization",
    "client_transport",
    "client_file_prepare",
    "upload_complete",
    "idempotent_replay",
  ];
  const reference =
    typeof requestId === "string" && /^[A-Za-z0-9-]{16,80}$/.test(requestId)
      ? ` Reference: ${requestId}${stages.includes(stage) ? ` · ${stage}` : ""}${Number.isInteger(error?.response?.status) ? ` · HTTP ${error.response.status}` : " · no HTTP response"}.`
      : "";
  const steps = [
    "uri_normalization",
    "source_stat",
    "stable_copy",
    "stable_stat",
  ];
  return (
    errorMessage(error) +
    reference +
    (steps.includes(diagnostic?.step)
      ? ` File preparation: ${diagnostic.step}.`
      : "")
  );
}
