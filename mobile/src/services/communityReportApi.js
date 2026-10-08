import { api } from "./api";

export async function submitReport(reportData, signal) {
  const { data } = await api.post("/community-reports", reportData, { signal });
  if (!data.success) throw new Error(data.message || "Could not submit report.");
  return data;
}

export async function uploadEvidence(evidencePayload, signal) {
  const { data } = await api.post("/community-reports/evidence/upload", evidencePayload, { signal });
  if (!data.success) throw new Error(data.message || "Could not upload evidence.");
  return data;
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
