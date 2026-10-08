import { api } from "./api";
const pathId = (id) => encodeURIComponent(id);

export const reportTypes = {
  WILDLIFE_SIGHTING: "Wildlife Sighting",
  HUMAN_WILDLIFE_CONFLICT: "Human-Wildlife Conflict",
  SUSPICIOUS_ACTIVITY: "Suspicious Activity",
};

export const reportStatuses = {
  PENDING: "Pending",
  UNDER_REVIEW: "Under review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

export const reportStatusClass = {
  PENDING: "badge-pending",
  UNDER_REVIEW: "badge-under-review",
  VERIFIED: "badge-verified",
  REJECTED: "badge-rejected",
};

// Mirrors the backend CommunityReport transition matrix so Park Manager review
// only proposes statuses the server will accept.
export const validTransitions = {
  PENDING: ["UNDER_REVIEW", "VERIFIED", "REJECTED"],
  UNDER_REVIEW: ["VERIFIED", "REJECTED"],
  VERIFIED: ["UNDER_REVIEW"],
  REJECTED: ["UNDER_REVIEW"],
};

export async function listCommunityReports(filters, signal) {
  const allowed = [
    "page",
    "pageSize",
    "status",
    "reportType",
    "from",
    "to",
    "search",
  ];
  const params = Object.fromEntries(
    allowed
      .filter((key) => filters[key] !== "" && filters[key] !== undefined)
      .map((key) => [key, filters[key]]),
  );
  const { data } = await api.get("/community-reports", { params, signal });
  if (
    !data?.success ||
    !Array.isArray(data.reports) ||
    !Number.isInteger(data.total) ||
    data.total < 0 ||
    !Number.isInteger(data.pageSize) ||
    data.pageSize < 1
  )
    throw new Error("Community report list unavailable.");
  return data;
}

export async function getCommunityReport(id, signal) {
  const { data } = await api.get(`/community-reports/${pathId(id)}`, { signal });
  if (!data?.success || !data.report?.id)
    throw new Error("Community report unavailable.");
  return data.report;
}

// Park Manager review. The server owns the status lifecycle and rejects any
// value outside the four CommunityReport statuses.
export async function updateCommunityReportStatus(id, status) {
  const { data } = await api.patch(
    `/community-reports/${pathId(id)}/status`,
    { status },
  );
  if (!data?.success || !data.report?.id)
    throw new Error("Community report status unavailable.");
  return data.report;
}

export function communityReportListError(error) {
  const status = error?.response?.status;
  return status === 401
    ? "Your session expired. Sign in again."
    : status === 403
      ? "You do not have permission to view these reports."
      : status === 404
        ? "These community reports are no longer available."
        : status === 400
          ? "Check the selected filters and date range."
          : "Unable to load community reports. Please retry.";
}

export function communityReportStatusError(error) {
  const field = error?.response?.data?.errors?.status;
  if (field) return field;
  const message = error?.response?.data?.message;
  if (typeof message === "string" && message.trim()) return message;
  const status = error?.response?.status;
  return status === 401
    ? "Your session expired. Sign in again."
    : status === 403
      ? "You do not have permission to change report status."
      : status === 404
        ? "This report is no longer available."
        : "Status could not be saved. Please retry.";
}

export function communityReportError(error) {
  const status = error?.response?.status;
  return status === 401
    ? "Your session expired. Sign in again."
    : status === 403
      ? "You do not have permission to view this report."
      : status === 404
        ? "This report is no longer available."
        : "Unable to load the community report. Please retry.";
}

// Community evidence fileUrl is an absolute path served by the backend next to
// the API origin. Compose real URLs only for display; the path is never
// trusted as an external location.
export function mediaUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  const origin = api.defaults.baseURL.replace(/\/api\/?$/, "");
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}