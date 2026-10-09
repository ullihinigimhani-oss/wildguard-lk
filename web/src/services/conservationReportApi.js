// Conservation Report API service.
// Wraps the /api/reports/* backend endpoints introduced in Phase 6B.
// All endpoints require an approved PARK_MANAGER token; the global axios
// instance in api.js carries the Authorization header automatically.

import { api } from "./api";

// ── Report type metadata ──────────────────────────────────────────────────

export const reportTypeLabels = {
  INCIDENT:       "Incident Report",
  PATROL:         "Patrol Operations Report",
  CONFLICT_TREND: "Human-Wildlife Conflict Trend Report",
};

export const reportTypeDescriptions = {
  INCIDENT:
    "Field incidents broken down by type, status and trend over the selected period.",
  PATROL:
    "Patrol activity including completed vs scheduled counts, type and priority mix.",
  CONFLICT_TREND:
    "Community-reported human-wildlife conflict trends by location and species.",
};

export const exportFormatLabels = {
  PDF: "Download as PDF",
  CSV: "Download as CSV",
};

// ── Fetch report types available for generation ───────────────────────────

export async function getReportTypes(signal) {
  const { data } = await api.get("/reports/types", { signal });
  if (!data?.success || !Array.isArray(data.data))
    throw new Error("Report types unavailable.");
  return data.data;
}

// ── Generate a report preview (returns structured JSON) ───────────────────

export async function generateReport(params, signal) {
  const allowed = ["reportType", "from", "to", "period", "area", "type", "status", "priority"];
  const query = Object.fromEntries(
    allowed
      .filter((k) => params[k] !== undefined && params[k] !== "")
      .map((k) => [k, params[k]])
  );
  const { data } = await api.get("/reports/generate", { params: query, signal });
  if (!data?.success || !data.data?.reportType)
    throw new Error("Report data unavailable.");
  return data.data;
}

// ── Build a download URL for export (CSV or PDF/HTML) ────────────────────
// Returns a URL string. The caller opens it (window.open / <a href>) so the
// browser handles the file download — no blob juggling needed in React.
export function buildExportUrl(params, format) {
  const base = api.defaults.baseURL;
  const token = sessionStorage.getItem("wildguard.session");

  const allowed = ["reportType", "from", "to", "period", "area", "type", "status", "priority"];
  const query = Object.fromEntries(
    allowed
      .filter((k) => params[k] !== undefined && params[k] !== "")
      .map((k) => [k, params[k]])
  );
  query.format = format;

  const qs = new URLSearchParams(query).toString();
  return { url: `${base}/reports/export?${qs}`, token };
}

// ── Download helper — fetches with auth header, forces browser save ───────
// Using fetch() here so we can attach the Authorization header (window.open
// would drop it and get a 401).
export async function downloadReport(params, format) {
  const { url, token } = buildExportUrl(params, format);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Export failed: ${response.status}`);

  const blob = await response.blob();
  const ext = format === "CSV" ? "csv" : "html";
  const contentDisposition = response.headers.get("content-disposition") || "";
  const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
  const filename = match?.[1] || `conservation_report_${Date.now()}.${ext}`;

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

// ── Error mapper ──────────────────────────────────────────────────────────

export function reportApiError(error) {
  const status = error?.response?.status;
  const msg = error?.response?.data?.message;
  if (typeof msg === "string" && msg.trim()) return msg;
  return status === 401
    ? "Your session expired. Sign in again."
    : status === 403
      ? "Conservation reports are only available to approved Park Managers."
      : status === 400
        ? "Check the selected filters and date range."
        : "Unable to generate report. Please retry.";
}

// ── Date helpers ──────────────────────────────────────────────────────────
// Converts local calendar dates to Sri Lanka timezone instants (UTC+05:30),
// matching the convention used throughout the analytics services.
export function toSriLankaFrom(dateStr) {
  return dateStr ? `${dateStr}T00:00:00+05:30` : undefined;
}
export function toSriLankaTo(dateStr) {
  return dateStr ? `${dateStr}T23:59:59.999+05:30` : undefined;
}
