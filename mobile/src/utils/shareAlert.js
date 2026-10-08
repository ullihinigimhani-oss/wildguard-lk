import { Share, Alert as NativeAlert, Platform } from "react-native";

/**
 * Formats a timestamp into human-readable date and time for public sharing.
 */
function formatShareTimestamp(dateSource) {
  if (!dateSource) return null;
  const parsed = new Date(dateSource);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Extracts a safe, public-friendly affected area name.
 * Strictly prevents leaking raw coordinates or internal zone IDs if marked restricted.
 */
function formatPublicArea(alert) {
  if (alert.affectedArea && typeof alert.affectedArea === "string" && alert.affectedArea.trim()) {
    return alert.affectedArea.trim();
  }

  const zone = alert.riskZone?.name || alert.location?.areaName;
  const park = alert.riskZone?.park?.name || alert.location?.parkName;

  if (zone && park) {
    return `${zone} (${park})`;
  }
  if (zone) return zone;
  if (park) return park;

  return "Surrounding Community Perimeter";
}

/**
 * Constructs sanitized, safe public text for sharing an alert.
 *
 * Guaranteed safe:
 * - Omits internal IDs (alert.id, zoneId, animalId, userId, patrolId)
 * - Omits private Ranger data and officer notes
 * - Omits internal sensor or camera trap data
 * - Omits private community reporter details
 * - Omits sensitive GPS coordinates when restricted
 */
export function buildShareableAlertText(alert) {
  if (!alert || typeof alert !== "object") return "";

  const severity = alert.riskLevel || alert.severity || "SAFETY";
  const title = (alert.title && alert.title.trim())
    ? alert.title.trim()
    : `${severity} Wildlife Alert`;

  const message = (alert.message && alert.message.trim())
    ? alert.message.trim()
    : (alert.shortMessage && alert.shortMessage.trim())
    ? alert.shortMessage.trim()
    : "Wildlife activity reported in perimeter.";

  const area = formatPublicArea(alert);
  const timestamp = formatShareTimestamp(alert.generatedAt || alert.createdAt);

  const rawInstructions = Array.isArray(alert.safetyInstructions)
    ? alert.safetyInstructions
    : [];

  const instructionsText = rawInstructions.length > 0
    ? rawInstructions
        .map((inst) => `• ${typeof inst === "string" ? inst.trim() : String(inst)}`)
        .join("\n")
    : "• Stay vigilant and maintain a safe distance from wildlife.\n• Keep children and vulnerable individuals indoors.\n• Do not approach, tease, or flash lights at animals.";

  const lines = [
    `🚨 WILDGUARD LK SAFETY ALERT: ${title}`,
    `Severity: ${severity}`,
    `Affected Area: ${area}`,
    ...(timestamp ? [`Issued: ${timestamp}`] : []),
    "",
    "⚠️ Warning Message:",
    message,
    "",
    "🛡️ Safety Instructions:",
    instructionsText,
    "",
    "— Shared via WildGuard LK Community Safety Network",
  ];

  return lines.join("\n");
}

/**
 * Triggers native platform share sheet for a Safety Alert.
 *
 * Handles:
 * - share cancelled
 * - share unavailable
 * - malformed / missing alert data
 */
export async function shareSafetyAlert(alert) {
  if (!alert || typeof alert !== "object") {
    NativeAlert.alert(
      "Unable to Share",
      "Alert information is missing or incomplete."
    );
    return { success: false, reason: "MALFORMED_DATA" };
  }

  const message = buildShareableAlertText(alert);
  if (!message || !message.trim()) {
    NativeAlert.alert(
      "Unable to Share",
      "Alert content is empty or unavailable."
    );
    return { success: false, reason: "EMPTY_CONTENT" };
  }

  const title = alert.title || `${alert.riskLevel || "Safety"} Wildlife Alert`;

  try {
    const sharePayload = {
      message,
      title,
      subject: title,
    };

    const result = await Share.share(sharePayload, {
      dialogTitle: `Share Safety Alert: ${title}`,
    });

    if (result && result.action === Share.sharedAction) {
      return {
        success: true,
        activityType: result.activityType || null,
      };
    } else if (result && result.action === Share.dismissedAction) {
      // User dismissed/cancelled share sheet — normal behavior
      return {
        success: false,
        cancelled: true,
      };
    }

    return { success: true };
  } catch (error) {
    // Platform sharing unavailable or unexpected failure
    const isUnavailable =
      error?.message?.includes("not available") ||
      error?.message?.includes("unsupported") ||
      error?.code === "E_UNAVAILABLE";

    NativeAlert.alert(
      "Sharing Unavailable",
      isUnavailable
        ? "Sharing is not supported on this device or platform."
        : "Unable to share safety alert at this time. Please try again."
    );

    return {
      success: false,
      error: error?.message || "Share failed",
    };
  }
}
