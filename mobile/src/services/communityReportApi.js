import { api } from "./api";

export function resolveEvidenceUrl(fileUrl) {
  if (typeof fileUrl !== "string" || !fileUrl.trim()) {
    throw new Error("This evidence item has no image URL.");
  }

  let url;
  try {
    url = new URL(fileUrl.trim());
  } catch {
    const baseURL = api.defaults.baseURL;
    if (!baseURL) throw new Error("The public API URL is not configured.");
    try {
      url = new URL(fileUrl.trim(), `${new URL(baseURL).origin}/`);
    } catch {
      throw new Error("The evidence image URL is invalid.");
    }
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The evidence image URL must use HTTP or HTTPS.");
  }
  return url.href;
}

export async function submitReport(reportData, signal) {
  const { data } = await api.post("/community-reports", reportData, { signal });
  if (!data.success) throw new Error(data.message || "Could not submit report.");
  return data;
}

export async function uploadEvidence(evidencePayload, signal) {
  try {
    const { data } = await api.post(
      "/community-reports/evidence/upload",
      evidencePayload,
      { signal },
    );
    if (!data.success) {
      throw new Error(data.message || "Could not upload evidence.");
    }
    return data;
  } catch (error) {
    const response = error.response?.data;
    const validationMessages = response?.errors
      ? Object.values(response.errors).filter(
          (message) => typeof message === "string" && message.trim(),
        )
      : [];
    const message =
      validationMessages.join(" ") ||
      response?.message ||
      error.message ||
      "Could not upload evidence.";
    const code =
      typeof response?.code === "string" ? `${response.code}: ` : "";
    throw new Error(`${code}${message}`, { cause: error });
  }
}

export async function listMyReports(params = {}, signal) {
  const { data } = await api.get("/community-reports/mine", { params, signal });
  if (!data.success) throw new Error(data.message || "Could not load your reports.");
  return data;
}

export async function getReportById(id, signal) {
  const { data } = await api.get(`/community-reports/${id}`, { signal });
  if (!data.success) throw new Error(data.message || "Report could not be found.");
  return data.report;
}

export async function listAllReports(params = {}, signal) {
  const { data } = await api.get("/community-reports", { params, signal });
  if (!data.success) throw new Error(data.message || "Could not load reports.");
  return data;
}

export async function updateReportStatus(id, status, signal) {
  const { data } = await api.patch(
    `/community-reports/${id}/status`,
    { status },
    { signal }
  );
  if (!data.success) throw new Error(data.message || "Could not update report status.");
  return data;
}

export async function escalateReport(id, payload = {}, signal) {
  const { data } = await api.post(`/community-reports/${id}/escalate`, payload, { signal });
  if (!data.success) throw new Error(data.message || "Could not escalate report.");
  return data;
}

export async function forwardToIncident(id, payload = {}, signal) {
  const { data } = await api.post(`/community-reports/${id}/forward-incident`, payload, { signal });
  if (!data.success) throw new Error(data.message || "Could not forward report to incident response.");
  return data;
}
