const repository = require("../repositories/alert.repository");

const notFound = (message = "Alert not found.") =>
  Object.assign(new Error(message), { status: 404, authError: true });

const badRequest = (message = "Invalid alert parameters.") =>
  Object.assign(new Error(message), { status: 400, authError: true });

// Standardized safety guidance based on risk levels for Sri Lankan wildlife
// Standardized safety guidance based on risk levels for Sri Lankan wildlife
function getSafetyInstructions(riskLevel, species, zoneName) {
  const areaNotice = zoneName
    ? `Avoid travel along roads, footpaths, and border perimeters in ${zoneName}.`
    : "Avoid travel along boundary tracks and buffer perimeter roads.";

  const common = [
    "Stay away from the affected perimeter area until park authorities confirm it is safe.",
    "Do not approach, tease, shine flashlights directly at, or provoke the animal.",
    "Keep children and elderly individuals indoors or in safe elevated structures.",
    areaNotice,
    "Shelter livestock, cattle, and domestic animals in secure enclosures.",
  ];

  if (species && species.toLowerCase().includes("elephant")) {
    if (riskLevel === "CRITICAL" || riskLevel === "HIGH") {
      return [
        "CRITICAL: Wild elephant detected within or adjacent to human habitation.",
        "Immediately notify village coordination committee and stay inside secure shelters.",
        "Avoid using torch lights or shouting aggressively, as it may disorient or anger the animal.",
        "Clear all pathways and avoid travel along jungle border tracks until all-clear is given.",
        ...common,
      ];
    }
    return [
      "Wild elephant activity detected in buffer zone.",
      "Stay vigilant when travelling along park boundary perimeters.",
      ...common,
    ];
  }

  if (riskLevel === "CRITICAL") {
    return [
      "CRITICAL DANGER: Dangerous wildlife breach in active populated perimeter.",
      "Immediately alert village coordination committee and stay inside secure shelters.",
      ...common,
    ];
  }

  if (riskLevel === "HIGH") {
    return [
      "HIGH ALERT: Wildlife movement confirmed near settlement boundary.",
      "Avoid solo travel at dawn, dusk, or night.",
      ...common,
    ];
  }

  return [
    "MODERATE ADVISORY: Wildlife activity monitored within designated zone.",
    "Maintain standard caution around forest buffers.",
    ...common,
  ];
}

function formatAlert(alert, user = null) {
  const isAcknowledged = user
    ? alert.acknowledgements?.some((ack) => ack.userId === user.id)
    : false;

  const species = alert.animal?.name || alert.animal?.species;
  const zoneName = alert.riskZone?.name;
  const parkName = alert.riskZone?.park?.name;

  const affectedArea = zoneName
    ? `${zoneName}${parkName ? ` (${parkName})` : ""}`
    : (parkName || "Surrounding Community Perimeter");

  const title = `${alert.riskLevel} Wildlife Alert${zoneName ? ` - ${zoneName}` : species ? ` - ${species}` : ""}`;
  const shortMessage = alert.message && alert.message.length > 80
    ? `${alert.message.slice(0, 77)}...`
    : alert.message;

  const alertType = alert.animal?.species ? "WILDLIFE_PROXIMITY" : "ZONE_ADVISORY";

  const hasMapCoordinates = Boolean(
    alert.riskZone &&
    alert.riskZone.centerLatitude != null &&
    alert.riskZone.centerLongitude != null
  );

  const location = {
    areaName: zoneName || "Perimeter Zone",
    parkName: parkName || null,
    latitude: alert.riskZone?.centerLatitude ?? null,
    longitude: alert.riskZone?.centerLongitude ?? null,
    radiusMeters: alert.riskZone?.radiusMeters ?? null,
    hasCoordinates: hasMapCoordinates,
  };

  const isResolved = alert.status === "RESOLVED" || Boolean(alert.resolvedAt);
  const ageMs = Date.now() - new Date(alert.generatedAt || alert.createdAt || Date.now()).getTime();
  const isExpired = isResolved || ageMs > 72 * 60 * 60 * 1000;

  // Sanitization: omit raw acknowledgements array to prevent leaking user IDs publicly
  const { acknowledgements, ...cleanAlert } = alert;

  return {
    ...cleanAlert,
    title,
    alertType,
    severity: alert.riskLevel,
    shortMessage,
    affectedArea,
    location,
    isResolved,
    isExpired,
    isAcknowledged: Boolean(isAcknowledged),
    acknowledgementCount: acknowledgements ? acknowledgements.length : 0,
    safetyInstructions: getSafetyInstructions(alert.riskLevel, alert.animal?.species, zoneName),
  };
}

exports.listAlerts = async (query = {}, user = null) => {
  const { riskLevel, parkId, status = "ACTIVE", page = 1, pageSize = 20 } = query;

  const validRiskLevels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const validStatuses = ["ACTIVE", "ACKNOWLEDGED", "RESOLVED", "ALL", "HISTORY"];

  if (riskLevel && !validRiskLevels.includes(riskLevel.toUpperCase())) {
    throw badRequest("Invalid riskLevel filter.");
  }
  if (status && !validStatuses.includes(status.toUpperCase())) {
    throw badRequest("Invalid alert status filter.");
  }

  const result = await repository.listAlerts({
    riskLevel: riskLevel ? riskLevel.toUpperCase() : undefined,
    parkId: typeof parkId === "string" ? parkId.trim() : undefined,
    status: status ? status.toUpperCase() : "ACTIVE",
    page: Math.max(1, parseInt(page, 10) || 1),
    pageSize: Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20)),
  });

  const alerts = result.alerts.map((a) => formatAlert(a, user));

  return {
    alerts,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  };
};

exports.getAlertDetails = async (id, user = null) => {
  if (!id || typeof id !== "string" || !id.trim() || id.trim().length > 100) {
    throw badRequest("Invalid alert ID format.");
  }

  const alert = await repository.findAlertById(id.trim());
  if (!alert) throw notFound();

  return formatAlert(alert, user);
};

exports.acknowledgeAlert = async (alertId, user) => {
  if (!user || !user.id) throw badRequest("User authentication required.");
  if (!alertId || typeof alertId !== "string" || !alertId.trim()) {
    throw badRequest("Invalid alert ID format.");
  }

  const alert = await repository.findAlertById(alertId.trim());
  if (!alert) throw notFound();

  const acknowledgement = await repository.acknowledgeAlert(alertId.trim(), user.id);
  return {
    success: true,
    message: "Alert acknowledged successfully.",
    acknowledgement,
  };
};

exports.updateAlertStatus = async (alertId, status) => {
  const validStatuses = ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"];
  if (!status || !validStatuses.includes(status.toUpperCase())) {
    throw badRequest("Invalid alert status.");
  }

  const alert = await repository.findAlertById(alertId);
  if (!alert) throw notFound();

  const resolvedAt = status.toUpperCase() === "RESOLVED" ? new Date() : null;
  return repository.updateAlertStatus(alertId, status.toUpperCase(), resolvedAt);
};
