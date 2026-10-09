/**
 * SMS Community Report Parser
 * Parses incoming SMS text messages into structured community report payloads.
 *
 * Supported formats:
 *  1. Delimited by '#' or ';' or '|':
 *     REPORT <TYPE> # <LOCATION> # <DESCRIPTION>
 *     e.g., REPORT SIGHTING # Yala Sector 3 # Herd of 4 elephants near boundary fence
 *
 *  2. Delimited by '-':
 *     REPORT <TYPE> - <LOCATION> - <DESCRIPTION>
 *
 *  3. Labeled fields:
 *     REPORT <TYPE>
 *     LOC: <LOCATION>
 *     DESC: <DESCRIPTION>
 *
 *  4. Space separated:
 *     REPORT <TYPE> <LOCATION> <DESCRIPTION>
 */

const REPORT_TYPE_MAP = {
  // Sighting keywords
  SIGHTING: "WILDLIFE_SIGHTING",
  SIGHT: "WILDLIFE_SIGHTING",
  WILDLIFE: "WILDLIFE_SIGHTING",
  WILDLIFE_SIGHTING: "WILDLIFE_SIGHTING",
  ANIMAL: "WILDLIFE_SIGHTING",

  // Conflict keywords
  CONFLICT: "HUMAN_WILDLIFE_CONFLICT",
  ATTACK: "HUMAN_WILDLIFE_CONFLICT",
  DAMAGE: "HUMAN_WILDLIFE_CONFLICT",
  CROP: "HUMAN_WILDLIFE_CONFLICT",
  CROP_DAMAGE: "HUMAN_WILDLIFE_CONFLICT",
  HWC: "HUMAN_WILDLIFE_CONFLICT",
  RAID: "HUMAN_WILDLIFE_CONFLICT",
  HUMAN_WILDLIFE_CONFLICT: "HUMAN_WILDLIFE_CONFLICT",

  // Suspicious keywords
  SUSPICIOUS: "SUSPICIOUS_ACTIVITY",
  SUSPICIOUS_ACTIVITY: "SUSPICIOUS_ACTIVITY",
  POACHING: "SUSPICIOUS_ACTIVITY",
  POACHER: "SUSPICIOUS_ACTIVITY",
  TRAP: "SUSPICIOUS_ACTIVITY",
  SNARE: "SUSPICIOUS_ACTIVITY",
  ILLEGAL: "SUSPICIOUS_ACTIVITY",
  LOGGING: "SUSPICIOUS_ACTIVITY",
};

const COMMON_SPECIES = [
  "ELEPHANT",
  "LEOPARD",
  "SLOTH BEAR",
  "BEAR",
  "WILD BOAR",
  "BOAR",
  "CROCODILE",
  "DEER",
  "SAMBAR",
];

function formatError(message, details = {}) {
  const err = new Error(message);
  err.status = 400;
  err.validationError = true;
  err.isSmsParseError = true;
  err.fields = details;
  err.details = details;
  return err;
}

/**
 * Parses raw SMS text message.
 * @param {string} rawText
 * @returns {object} { reportType, species, manualLocation, description, isAnonymous, rawMessage }
 */
function parseSmsReport(rawText) {
  if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
    throw formatError("SMS message body is empty. Expected: REPORT <TYPE> # <LOCATION> # <DESCRIPTION>");
  }

  const cleaned = rawText.trim();
  let workingText = cleaned;

  // Check anonymous flag: "REPORT ANON ..." or "ANON ..."
  let isAnonymous = false;
  if (/^(REPORT\s+)?(ANON|ANONYMOUS)\b/i.test(workingText)) {
    isAnonymous = true;
    workingText = workingText.replace(/^(REPORT\s+)?(ANON|ANONYMOUS)\s*/i, "REPORT ");
  }

  // Strip leading "REPORT" prefix if present
  if (/^REPORT\b/i.test(workingText)) {
    workingText = workingText.replace(/^REPORT\s*[:\-\s]*/i, "").trim();
  }

  let rawType = "";
  let locationText = "";
  let descriptionText = "";
  let detectedSpecies = null;

  // Check if labeled format (e.g. LOC:... DESC:...)
  const locMatch = workingText.match(/(?:LOC|LOCATION)\s*[:=]\s*([^;\n\r#]+)/i);
  const descMatch = workingText.match(/(?:DESC|DESCRIPTION|DETAILS|MSG)\s*[:=]\s*([\s\S]+)/i);

  if (locMatch && descMatch) {
    // Type is whatever comes before LOC or at the very beginning
    const beforeLoc = workingText.substring(0, locMatch.index).trim();
    rawType = beforeLoc.split(/[\s,]+/)[0];
    locationText = locMatch[1].trim();
    descriptionText = descMatch[1].trim();
  } else {
    // Delimiter based parsing: check for # or ; or | or -
    let delimiter = null;
    if (workingText.includes("#")) delimiter = "#";
    else if (workingText.includes(";")) delimiter = ";";
    else if (workingText.includes("|")) delimiter = "|";
    else if (workingText.includes(" - ")) delimiter = " - ";

    if (delimiter) {
      const parts = workingText.split(delimiter).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 3) {
        rawType = parts[0];
        locationText = parts[1];
        descriptionText = parts.slice(2).join(" ");
      } else if (parts.length === 2) {
        // e.g. "SIGHTING Yala North # 3 elephants near road"
        const firstParts = parts[0].split(/\s+/);
        rawType = firstParts[0];
        locationText = firstParts.slice(1).join(" ");
        descriptionText = parts[1];
      }
    } else {
      // Space separated fallback:
      // First token is TYPE, second or quoted token is LOCATION, rest is DESCRIPTION
      const tokens = workingText.split(/\s+/);
      if (tokens.length >= 3) {
        rawType = tokens[0];
        locationText = tokens[1];
        descriptionText = tokens.slice(2).join(" ");
      } else if (tokens.length >= 1) {
        rawType = tokens[0];
      }
    }
  }

  if (!rawType) {
    throw formatError("Unable to determine report type. Expected: SIGHTING, CONFLICT, or SUSPICIOUS.", {
      example: "REPORT SIGHTING # Yala Sector 3 # 3 wild elephants near boundary",
    });
  }

  // Check if type token contains species: e.g. "SIGHTING ELEPHANT"
  const typeTokens = rawType.split(/\s+/);
  const primaryTypeToken = typeTokens[0].toUpperCase().replace(/[^A-Z_]/g, "");

  if (typeTokens.length > 1) {
    const candidateSpecies = typeTokens.slice(1).join(" ").toUpperCase();
    for (const sp of COMMON_SPECIES) {
      if (candidateSpecies.includes(sp)) {
        detectedSpecies = sp.charAt(0) + sp.slice(1).toLowerCase();
        break;
      }
    }
  }

  const mappedType = REPORT_TYPE_MAP[primaryTypeToken];
  if (!mappedType) {
    throw formatError(
      `Unsupported report type: '${primaryTypeToken}'. Permitted types are SIGHTING, CONFLICT, or SUSPICIOUS.`,
      {
        receivedType: primaryTypeToken,
        supportedTypes: ["SIGHTING", "CONFLICT", "SUSPICIOUS"],
        example: "REPORT SIGHTING # Yala Sector 3 # 3 wild elephants near boundary",
      }
    );
  }

  // Validate location
  const trimmedLocation = (locationText || "").trim();
  if (!trimmedLocation || trimmedLocation.length < 2) {
    throw formatError("Location is missing or too short. Please specify where the event occurred.", {
      receivedLocation: locationText,
      example: "REPORT SIGHTING # Yala Sector 3 # 3 wild elephants near boundary",
    });
  }
  if (trimmedLocation.length > 250) {
    throw formatError("Location text exceeds maximum allowed length of 250 characters.");
  }

  // Validate description
  const trimmedDescription = (descriptionText || "").trim();
  if (!trimmedDescription || trimmedDescription.length < 5) {
    throw formatError("Description must be at least 5 characters.", {
      receivedDescription: descriptionText,
      example: "REPORT SIGHTING # Yala Sector 3 # 3 wild elephants near boundary",
    });
  }
  if (trimmedDescription.length > 2000) {
    throw formatError("Description exceeds maximum allowed length of 2000 characters.");
  }

  // Detect species in description if not already set
  if (!detectedSpecies) {
    const descUpper = trimmedDescription.toUpperCase();
    for (const sp of COMMON_SPECIES) {
      if (descUpper.includes(sp)) {
        detectedSpecies = sp.charAt(0) + sp.slice(1).toLowerCase();
        break;
      }
    }
  }

  return {
    reportType: mappedType,
    species: detectedSpecies || null,
    manualLocation: trimmedLocation,
    description: trimmedDescription,
    isAnonymous,
    rawMessage: cleaned,
  };
}

module.exports = {
  parseSmsReport,
  REPORT_TYPE_MAP,
  COMMON_SPECIES,
};
