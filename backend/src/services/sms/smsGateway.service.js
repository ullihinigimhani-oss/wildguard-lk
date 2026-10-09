/**
 * SMS Gateway & Integration Service
 * Ingests incoming SMS payloads, performs deduplication, sender validation,
 * parses message content, and creates community reports via communityReport.service.
 */

const { parseSmsReport, REPORT_TYPE_MAP } = require("./smsParser");
const communityReportService = require("../communityReport.service");
const db = () => require("../../config/database");

// In-memory cache for processed provider message IDs (deduplication)
// In production or multi-instance environments this can be backed by Redis
const processedMessageCache = new Map();

// Helper to keep cache size bounded to 5,000 recent message IDs
function recordProcessedMessage(messageId, data) {
  if (!messageId) return;
  if (processedMessageCache.size > 5000) {
    const oldestKey = processedMessageCache.keys().next().value;
    processedMessageCache.delete(oldestKey);
  }
  processedMessageCache.set(String(messageId).trim(), {
    ...data,
    processedAt: new Date(),
  });
}

function normalizePhone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== "string") return "";
  return rawPhone.trim().replace(/[^\d+]/g, "");
}

/**
 * Ingests an incoming SMS payload from a provider webhook or simulator.
 *
 * Supported payload shapes:
 * 1. Twilio: { From, Body, MessageSid }
 * 2. Generic JSON: { senderPhone, message, providerMessageId }
 *
 * @param {object} payload
 * @param {object} options
 * @returns {Promise<object>}
 */
async function processIncomingSms(payload = {}, options = {}) {
  // 1. Extract fields from payload (handling Twilio vs Generic gateways)
  const senderPhone = (
    payload.senderPhone ||
    payload.sender_phone ||
    payload.From ||
    payload.from ||
    payload.phone ||
    ""
  ).trim();

  const messageText = (
    payload.message ||
    payload.text ||
    payload.Body ||
    payload.body ||
    ""
  ).trim();

  const providerMessageId = (
    payload.providerMessageId ||
    payload.messageId ||
    payload.MessageSid ||
    payload.smsId ||
    payload.id ||
    ""
  ).trim();

  // 2. Validate sender phone
  if (!senderPhone) {
    const err = new Error("Sender phone number is required.");
    err.status = 400;
    err.validationError = true;
    throw err;
  }

  const phoneRegex = /^[+0-9\s\-()]{7,25}$/;
  if (!phoneRegex.test(senderPhone)) {
    const err = new Error("Invalid sender phone number format.");
    err.status = 400;
    err.validationError = true;
    throw err;
  }

  // 3. Validate message body
  if (!messageText) {
    const err = new Error("SMS message body is required.");
    err.status = 400;
    err.validationError = true;
    throw err;
  }

  // 4. Duplicate processing prevention
  if (providerMessageId && processedMessageCache.has(providerMessageId)) {
    const cached = processedMessageCache.get(providerMessageId);
    return {
      success: true,
      duplicate: true,
      message: "Duplicate SMS message already processed.",
      providerMessageId,
      reportId: cached.reportId,
      replyText: cached.replyText || "WildGuard LK: Report already received and logged.",
    };
  }

  // 5. Parse SMS content
  const parsed = parseSmsReport(messageText);

  // 6. Look up registered user by phone (if available)
  let matchedUser = null;
  if (!parsed.isAnonymous) {
    const cleanPhone = normalizePhone(senderPhone);
    const last9Digits = cleanPhone.slice(-9);

    try {
      matchedUser = await db().user.findFirst({
        where: {
          OR: [
            { phone: senderPhone },
            { phone: cleanPhone },
            ...(last9Digits.length === 9 ? [{ phone: { endsWith: last9Digits } }] : []),
          ],
        },
      });
    } catch (_) {
      // Database lookup failure should not block SMS ingestion
      matchedUser = null;
    }
  }

  // 7. Create CommunityReport through the SAME service logic as mobile-app reports
  const reportPayload = {
    reportType: parsed.reportType,
    species: parsed.species,
    description: parsed.description,
    manualLocation: parsed.manualLocation,
    isAnonymous: parsed.isAnonymous,
    reporterName: parsed.isAnonymous ? null : (matchedUser?.name || null),
    reporterPhone: parsed.isAnonymous ? null : senderPhone,
  };

  const report = await communityReportService.submitReport(
    reportPayload,
    parsed.isAnonymous ? null : matchedUser
  );

  // 8. Generate automated SMS confirmation reply
  const shortId = report.id ? report.id.slice(-6).toUpperCase() : "OK";
  const typeLabel = parsed.reportType.replace(/_/g, " ");
  const replyText = `WildGuard LK: Safety report #${shortId} received. Type: ${typeLabel}. Location: ${parsed.manualLocation}. Thank you for helping protect wildlife.`;

  // 9. Cache provider message ID for deduplication
  if (providerMessageId) {
    recordProcessedMessage(providerMessageId, {
      reportId: report.id,
      replyText,
    });
  }

  return {
    success: true,
    message: "Community report successfully created via SMS.",
    report,
    replyText,
    providerMessageId: providerMessageId || null,
    parsed,
    matchedUser: matchedUser
      ? { id: matchedUser.id, name: matchedUser.name, role: matchedUser.role }
      : null,
  };
}

/**
 * Returns instructions on SMS format and help.
 */
function getSmsFormatInstructions() {
  return {
    success: true,
    service: "WildGuard LK SMS Reporting Gateway",
    smsNumber: process.env.SMS_GATEWAY_NUMBER || "1919",
    formatTemplate: "REPORT <TYPE> # <LOCATION> # <DESCRIPTION>",
    alternativeDelimiters: ["#", ";", "|", " - "],
    supportedTypes: [
      {
        keyword: "SIGHTING",
        canonical: "WILDLIFE_SIGHTING",
        description: "Wildlife sighting near boundary or human settlement",
      },
      {
        keyword: "CONFLICT",
        canonical: "HUMAN_WILDLIFE_CONFLICT",
        description: "Crop raiding, property damage, or wildlife aggression",
      },
      {
        keyword: "SUSPICIOUS",
        canonical: "SUSPICIOUS_ACTIVITY",
        description: "Snares, illegal entry, gunshots, or poaching activity",
      },
    ],
    anonymousReporting: "Prefix message with ANON, e.g., 'REPORT ANON SIGHTING # Location # Description'",
    examples: [
      "REPORT SIGHTING # Yala Block 1 near tank # 3 wild elephants near paddy boundary",
      "REPORT CONFLICT # Wilpattu boundary village # Wild elephant broke boundary fence and storehouse",
      "REPORT SUSPICIOUS # Sector 4 canal track # Wire snare traps discovered along forest path",
      "REPORT ANON SIGHTING # Kataragama road # Leopard spotted crossing near culvert 14",
    ],
  };
}

/**
 * Clears deduplication cache (useful for test isolation).
 */
function clearDeduplicationCache() {
  processedMessageCache.clear();
}

module.exports = {
  processIncomingSms,
  getSmsFormatInstructions,
  clearDeduplicationCache,
};
