import { api } from "./api";

/**
 * Retrieves public SMS format guidelines from the gateway.
 */
export async function getSmsFormat(signal) {
  const { data } = await api.get("/sms/format", { signal });
  if (!data.success) throw new Error(data.message || "Could not retrieve SMS format guidelines.");
  return data;
}

/**
 * Sends a simulated SMS report for testing / demonstration without telecom hardware.
 */
export async function simulateSmsReport(payload, signal) {
  const { data } = await api.post("/sms/simulate", payload, { signal });
  if (!data.success) throw new Error(data.message || "Could not simulate SMS report.");
  return data;
}

/**
 * Builds formatted SMS message text matching the gateway specification:
 * REPORT <TYPE> # <LOCATION> # <DESCRIPTION>
 */
export function buildSmsReportText({
  reportType = "WILDLIFE_SIGHTING",
  location = "",
  description = "",
  isAnonymous = false,
} = {}) {
  const typeKeyword =
    reportType === "HUMAN_WILDLIFE_CONFLICT"
      ? "CONFLICT"
      : reportType === "SUSPICIOUS_ACTIVITY"
      ? "SUSPICIOUS"
      : "SIGHTING";

  const prefix = isAnonymous ? "REPORT ANON" : "REPORT";
  const cleanLoc = (location || "").trim() || "Location not specified";
  const cleanDesc = (description || "").trim() || "Observed wildlife event";

  return `${prefix} ${typeKeyword} # ${cleanLoc} # ${cleanDesc}`;
}
