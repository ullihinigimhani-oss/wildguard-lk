const repository = require("../repositories/alert.repository");

const notFound = (message = "Alert not found.") =>
  Object.assign(new Error(message), { status: 404, authError: true });

const badRequest = (message = "Invalid alert parameters.") =>
  Object.assign(new Error(message), { status: 400, authError: true });

// Standardized safety guidance based on risk levels for Sri Lankan wildlife
function getSafetyInstructions(riskLevel, species) {
  const common = [
    "Keep children and elderly individuals indoors or in safe elevated structures.",
    "Do not approach, tease, shine flashlights directly at, or provoke the animal.",
    "Ensure cattle and domestic animals are sheltered in secure enclosures.",
  ];

  if (species && species.toLowerCase().includes("elephant")) {
    if (riskLevel === "CRITICAL" || riskLevel === "HIGH") {
      return [
        "CRITICAL: Wild elephant detected within or adjacent to human habitation.",
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

  return {
    ...alert,
    title,
    shortMessage,
    affectedArea,
    isAcknowledged: Boolean(isAcknowledged),
    acknowledgementCount: alert.acknowledgements ? alert.acknowledgements.length : 0,
    safetyInstructions: getSafetyInstructions(alert.riskLevel, alert.animal?.species),
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
  const alert = await repository.findAlertById(id);
  if (!alert) throw notFound();

  return formatAlert(alert, user);
};

exports.acknowledgeAlert = async (alertId, user) => {
  if (!user || !user.id) throw badRequest("User authentication required.");

  const alert = await repository.findAlertById(alertId);
  if (!alert) throw notFound();

  const acknowledgement = await repository.acknowledgeAlert(alertId, user.id);
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
