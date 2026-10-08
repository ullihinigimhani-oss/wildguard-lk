const repository = require("../repositories/alert.repository");

const notFound = (message = "Alert not found.") =>
  Object.assign(new Error(message), { status: 404, authError: true });

const badRequest = (message = "Invalid alert parameters.") =>
  Object.assign(new Error(message), { status: 400, authError: true });

const forbidden = (message = "You do not have permission to perform this action.") =>
  Object.assign(new Error(message), { status: 403, authError: true });

const AUTHORIZED_ROLES = ["COMMUNITY_LIAISON", "PARK_MANAGER"];

function assertAuthorizedRole(user) {
  if (!user || !user.role || !AUTHORIZED_ROLES.includes(user.role)) {
    throw forbidden("Only authorized community liaisons or park managers can perform this operation.");
  }
}

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
  const userAck = user
    ? alert.acknowledgements?.find((ack) => ack.userId === user.id)
    : null;
  const isAcknowledged = Boolean(userAck?.acknowledgedAt);
  const acknowledgedAt = userAck?.acknowledgedAt || null;
  const isRead = Boolean(userAck?.readAt || userAck?.acknowledgedAt);
  const readAt = userAck?.readAt || userAck?.acknowledgedAt || null;

  // Expected lifecycle for user interaction:
  // RECEIVED -> READ -> ACKNOWLEDGED
  let userState = "RECEIVED";
  if (isAcknowledged) {
    userState = "ACKNOWLEDGED";
  } else if (isRead) {
    userState = "READ";
  }

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
    isAcknowledged,
    acknowledgedAt,
    isRead,
    readAt,
    userState,
    acknowledgementCount: acknowledgements
      ? acknowledgements.filter((ack) => Boolean(ack.acknowledgedAt)).length
      : 0,
    safetyInstructions: getSafetyInstructions(alert.riskLevel, alert.animal?.species, zoneName),
    responseNote: alert.responseNote || null,
    respondedAt: alert.respondedAt || null,
    respondedById: alert.respondedById || null,
    responder: alert.responder
      ? {
          id: alert.responder.id,
          name: alert.responder.name,
          role: alert.responder.role,
        }
      : null,
    forwardedTo: alert.forwardedTo || null,
    forwardedAt: alert.forwardedAt || null,
    isResponded: Boolean(alert.respondedAt || alert.responseNote),
    isForwarded: Boolean(alert.forwardedTo),
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

  const unreadCount = alerts.filter(
    (a) => !a.isRead && a.status === "ACTIVE"
  ).length;

  return {
    alerts,
    total: result.total,
    unreadCount,
    page: result.page,
    pageSize: result.pageSize,
  };
};

exports.getUnreadCount = async (user = null) => {
  const count = await repository.countUnreadAlerts(user?.id || null);
  return {
    success: true,
    unreadCount: count,
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

exports.markAsRead = async (alertId, user) => {
  if (!user || !user.id) throw badRequest("User authentication required.");
  if (!alertId || typeof alertId !== "string" || !alertId.trim()) {
    throw badRequest("Invalid alert ID format.");
  }

  const alert = await repository.findAlertById(alertId.trim());
  if (!alert) throw notFound();

  const receipt = await repository.markAsRead(alertId.trim(), user.id);
  const isAcknowledged = Boolean(receipt.acknowledgedAt);
  return {
    success: true,
    message: "Alert marked as read.",
    alertId: alertId.trim(),
    userId: user.id,
    isRead: true,
    readAt: receipt.readAt || receipt.acknowledgedAt || new Date(),
    isAcknowledged,
    acknowledgedAt: receipt.acknowledgedAt || null,
    userState: isAcknowledged ? "ACKNOWLEDGED" : "READ",
  };
};

exports.markAllAsRead = async (user) => {
  if (!user || !user.id) throw badRequest("User authentication required.");
  const result = await repository.markAllAsRead(user.id);
  return {
    success: true,
    message: "All active alerts marked as read.",
    ...result,
  };
};

exports.acknowledgeAlert = async (alertId, user) => {
  if (!user || !user.id) throw badRequest("User authentication required.");
  if (!alertId || typeof alertId !== "string" || !alertId.trim()) {
    throw badRequest("Invalid alert ID format.");
  }

  const alert = await repository.findAlertById(alertId.trim());
  if (!alert) throw notFound();

  const status = alert.status || "ACTIVE";
  if (status === "RESOLVED" || alert.resolvedAt) {
    throw badRequest("Acknowledgement is not applicable for resolved alerts.");
  }

  if (status !== "ACTIVE") {
    throw badRequest("Acknowledgement is not applicable for inactive alerts.");
  }

  const ageMs = Date.now() - new Date(alert.generatedAt || alert.createdAt || Date.now()).getTime();
  if (ageMs > 72 * 60 * 60 * 1000) {
    throw badRequest("Acknowledgement is not applicable for expired alerts.");
  }

  // Prevent duplicate acknowledgement
  const existingAck = alert.acknowledgements?.find((ack) => ack.userId === user.id);
  if (existingAck?.acknowledgedAt) {
    return {
      success: true,
      message: "Alert has already been acknowledged.",
      alertId: alert.id,
      userId: user.id,
      isAcknowledged: true,
      acknowledgedAt: existingAck.acknowledgedAt,
      isRead: true,
      readAt: existingAck.readAt || existingAck.acknowledgedAt,
      userState: "ACKNOWLEDGED",
      alreadyAcknowledged: true,
      acknowledgement: existingAck,
    };
  }

  const acknowledgement = await repository.acknowledgeAlert(alertId.trim(), user.id);
  return {
    success: true,
    message: "Alert acknowledged successfully.",
    alertId: alert.id,
    userId: user.id,
    isAcknowledged: true,
    acknowledgedAt: acknowledgement.acknowledgedAt,
    isRead: true,
    readAt: acknowledgement.readAt || acknowledgement.acknowledgedAt,
    userState: "ACKNOWLEDGED",
    alreadyAcknowledged: false,
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

exports.getAlertsRequiringAttention = async (query = {}, user = null) => {
  assertAuthorizedRole(user);
  const { parkId, page = 1, pageSize = 20 } = query;

  const result = await repository.listAlertsRequiringAttention({
    parkId: typeof parkId === "string" ? parkId.trim() : undefined,
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

exports.respondToAlert = async (alertId, body = {}, user = null) => {
  assertAuthorizedRole(user);

  if (!alertId || typeof alertId !== "string" || !alertId.trim()) {
    throw badRequest("Invalid alert ID format.");
  }

  const alert = await repository.findAlertById(alertId.trim());
  if (!alert) throw notFound();

  if (alert.status === "RESOLVED" || alert.resolvedAt) {
    throw badRequest("Cannot respond to a resolved alert.");
  }

  const ageMs = Date.now() - new Date(alert.generatedAt || alert.createdAt || Date.now()).getTime();
  if (ageMs > 72 * 60 * 60 * 1000) {
    throw badRequest("Cannot respond to an expired alert.");
  }

  const { status, responseNote } = body || {};

  let targetStatus = alert.status === "ACTIVE" ? "ACKNOWLEDGED" : alert.status;
  if (status) {
    const normalizedStatus = String(status).trim().toUpperCase();
    if (alert.status === "ACKNOWLEDGED" && normalizedStatus === "ACTIVE") {
      throw badRequest("Cannot revert an acknowledged alert to active.");
    }
    if (!["ACKNOWLEDGED", "RESOLVED"].includes(normalizedStatus)) {
      throw badRequest("Invalid status transition. Allowed response states are ACKNOWLEDGED or RESOLVED.");
    }
    targetStatus = normalizedStatus;
  }

  let trimmedNote;
  if (responseNote !== undefined && responseNote !== null) {
    if (typeof responseNote !== "string") {
      throw badRequest("Response note must be a string.");
    }
    trimmedNote = responseNote.trim();
    if (trimmedNote.length < 5 || trimmedNote.length > 1000) {
      throw badRequest("Response note must be between 5 and 1000 characters.");
    }
  }

  if (trimmedNote === undefined && !status) {
    throw badRequest("A response note or status update is required.");
  }

  // Duplicate response prevention
  if (
    alert.status === targetStatus &&
    (trimmedNote === undefined || alert.responseNote === trimmedNote) &&
    alert.respondedById === user.id
  ) {
    return {
      success: true,
      message: "Response already recorded.",
      alreadyResponded: true,
      alert: formatAlert(alert, user),
    };
  }

  const resolvedAt = targetStatus === "RESOLVED" ? new Date() : null;
  const updatedAlert = await repository.respondToAlert(alert.id, {
    status: targetStatus,
    responseNote: trimmedNote !== undefined ? trimmedNote : alert.responseNote,
    respondedById: user.id,
    resolvedAt,
  });

  return {
    success: true,
    message: "Operational response recorded successfully.",
    alert: formatAlert(updatedAlert, user),
  };
};

exports.forwardAlert = async (alertId, body = {}, user = null) => {
  assertAuthorizedRole(user);

  if (!alertId || typeof alertId !== "string" || !alertId.trim()) {
    throw badRequest("Invalid alert ID format.");
  }

  const alert = await repository.findAlertById(alertId.trim());
  if (!alert) throw notFound();

  if (alert.status === "RESOLVED" || alert.resolvedAt) {
    throw badRequest("Cannot forward a resolved alert.");
  }

  const ageMs = Date.now() - new Date(alert.generatedAt || alert.createdAt || Date.now()).getTime();
  if (ageMs > 72 * 60 * 60 * 1000) {
    throw badRequest("Cannot forward an expired alert.");
  }

  const { forwardTo, note } = body || {};
  if (!forwardTo || typeof forwardTo !== "string") {
    throw badRequest("Invalid forward target. Permitted targets: RANGER, PARK_MANAGER.");
  }

  const target = forwardTo.trim().toUpperCase();
  if (!["RANGER", "PARK_MANAGER"].includes(target)) {
    throw badRequest("Invalid forward target. Permitted targets: RANGER, PARK_MANAGER.");
  }

  let trimmedNote;
  if (note !== undefined && note !== null) {
    if (typeof note !== "string") {
      throw badRequest("Forwarding note must be a string.");
    }
    trimmedNote = note.trim();
    if (trimmedNote.length < 5 || trimmedNote.length > 1000) {
      throw badRequest("Forwarding note must be between 5 and 1000 characters.");
    }
  }

  // Duplicate forward prevention
  if (
    alert.forwardedTo === target &&
    (trimmedNote === undefined || alert.responseNote === trimmedNote)
  ) {
    return {
      success: true,
      message: `Alert has already been forwarded to ${target}.`,
      alreadyForwarded: true,
      alert: formatAlert(alert, user),
    };
  }

  const targetStatus = alert.status === "ACTIVE" ? "ACKNOWLEDGED" : alert.status;
  const updatedAlert = await repository.respondToAlert(alert.id, {
    status: targetStatus,
    responseNote: trimmedNote !== undefined ? trimmedNote : alert.responseNote,
    respondedById: user.id,
    forwardedTo: target,
  });

  const formatted = formatAlert(updatedAlert, user);
  const handoff = {
    alertId: updatedAlert.id,
    status: updatedAlert.status,
    handoffTarget: target,
    forwardedAt: updatedAlert.forwardedAt || new Date(),
    forwardedBy: {
      id: user.id,
      name: user.name || "Community Liaison",
      role: user.role,
    },
    urgency:
      updatedAlert.riskLevel === "CRITICAL"
        ? "IMMEDIATE"
        : updatedAlert.riskLevel === "HIGH"
        ? "HIGH"
        : "STANDARD",
    riskLevel: updatedAlert.riskLevel,
    affectedArea: formatted.affectedArea,
    animal: updatedAlert.animal
      ? {
          id: updatedAlert.animal.id,
          species: updatedAlert.animal.species,
          animalCode: updatedAlert.animal.animalCode,
          name: updatedAlert.animal.name,
        }
      : null,
    responseNote: updatedAlert.responseNote,
    recommendedAction:
      target === "RANGER"
        ? "Mobilize ground patrol to secure community perimeter and verify animal bearing."
        : "Review community safety perimeter advisory and assess managerial escalation.",
  };

  return {
    success: true,
    message: `Alert forwarded to ${target} successfully.`,
    alert: formatted,
    handoff,
  };
};
