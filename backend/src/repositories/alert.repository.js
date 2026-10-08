// Lazy connection keeps isolated tests independent of database setup.
const db = () => require("../config/database");

const alertSelect = {
  id: true,
  riskLevel: true,
  message: true,
  status: true,
  generatedAt: true,
  resolvedAt: true,
  animal: {
    select: {
      id: true,
      animalCode: true,
      species: true,
      name: true,
    },
  },
  riskZone: {
    select: {
      id: true,
      name: true,
      description: true,
      riskLevel: true,
      centerLatitude: true,
      centerLongitude: true,
      radiusMeters: true,
      park: {
        select: {
          id: true,
          name: true,
          location: true,
        },
      },
    },
  },
  acknowledgements: {
    select: {
      userId: true,
      readAt: true,
      acknowledgedAt: true,
    },
  },
  responseNote: true,
  respondedAt: true,
  respondedById: true,
  responder: {
    select: {
      id: true,
      name: true,
      role: true,
    },
  },
  forwardedTo: true,
  forwardedAt: true,
  escalations: {
    select: {
      id: true,
      reason: true,
      status: true,
      priority: true,
      targetDepartment: true,
      incidentId: true,
      escalatedAt: true,
      resolvedAt: true,
      escalatedById: true,
      escalator: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: { escalatedAt: "desc" },
  },
  createdAt: true,
  updatedAt: true,
};

exports.listAlerts = async ({ riskLevel, parkId, status = "ACTIVE", page = 1, pageSize = 20 } = {}) => {
  const normalizedStatus = status === "HISTORY" ? "RESOLVED" : status;
  const where = {
    ...(normalizedStatus && normalizedStatus !== "ALL" && { status: normalizedStatus }),
    ...(riskLevel && { riskLevel }),
    ...(parkId && {
      riskZone: {
        parkId,
      },
    }),
  };

  const skip = (Number(page) - 1) * Number(pageSize);
  const take = Number(pageSize);

  const [alerts, total] = await Promise.all([
    db().alert.findMany({
      where,
      select: alertSelect,
      orderBy: [{ generatedAt: "desc" }, { id: "desc" }],
      skip,
      take,
    }),
    db().alert.count({ where }),
  ]);

  return { alerts, total, page: Number(page), pageSize: Number(pageSize) };
};

exports.findAlertById = async (id) => {
  return db().alert.findUnique({
    where: { id },
    select: alertSelect,
  });
};

exports.acknowledgeAlert = async (alertId, userId) => {
  const now = new Date();
  return db().alertAcknowledgement.upsert({
    where: {
      alertId_userId: {
        alertId,
        userId,
      },
    },
    create: {
      alertId,
      userId,
      readAt: now,
      acknowledgedAt: now,
    },
    update: {
      acknowledgedAt: now,
    },
    select: {
      id: true,
      alertId: true,
      userId: true,
      readAt: true,
      acknowledgedAt: true,
    },
  });
};

exports.markAsRead = async (alertId, userId) => {
  const now = new Date();
  return db().alertAcknowledgement.upsert({
    where: {
      alertId_userId: {
        alertId,
        userId,
      },
    },
    create: {
      alertId,
      userId,
      readAt: now,
      acknowledgedAt: null,
    },
    update: {
      readAt: now,
    },
    select: {
      id: true,
      alertId: true,
      userId: true,
      readAt: true,
      acknowledgedAt: true,
    },
  });
};

exports.countUnreadAlerts = async (userId = null) => {
  const where = {
    status: "ACTIVE",
    ...(userId && {
      acknowledgements: {
        none: {
          userId,
        },
      },
    }),
  };
  return db().alert.count({ where });
};

exports.markAllAsRead = async (userId) => {
  const activeAlerts = await db().alert.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  const now = new Date();
  await Promise.all(
    activeAlerts.map((a) =>
      db().alertAcknowledgement.upsert({
        where: {
          alertId_userId: {
            alertId: a.id,
            userId,
          },
        },
        create: {
          alertId: a.id,
          userId,
          readAt: now,
          acknowledgedAt: null,
        },
        update: {
          readAt: now,
        },
      })
    )
  );

  return { markedCount: activeAlerts.length };
};

exports.updateAlertStatus = async (id, status, resolvedAt = null) => {
  return db().alert.update({
    where: { id },
    data: {
      status,
      ...(resolvedAt && { resolvedAt }),
    },
    select: alertSelect,
  });
};

exports.listAlertsRequiringAttention = async ({ parkId, page = 1, pageSize = 20 } = {}) => {
  const where = {
    status: { in: ["ACTIVE", "ACKNOWLEDGED"] },
    ...(parkId && {
      riskZone: { parkId },
    }),
  };

  const skip = (Number(page) - 1) * Number(pageSize);
  const take = Number(pageSize);

  const [alerts, total] = await Promise.all([
    db().alert.findMany({
      where,
      select: alertSelect,
      orderBy: [{ riskLevel: "desc" }, { generatedAt: "desc" }],
      skip,
      take,
    }),
    db().alert.count({ where }),
  ]);

  return { alerts, total, page: Number(page), pageSize: Number(pageSize) };
};

exports.respondToAlert = async (id, { status, responseNote, respondedById, forwardedTo, resolvedAt = null }) => {
  const now = new Date();
  return db().alert.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(responseNote !== undefined && { responseNote }),
      ...(respondedById && {
        respondedById,
        respondedAt: now,
      }),
      ...(forwardedTo && {
        forwardedTo,
        forwardedAt: now,
      }),
      ...(resolvedAt && { resolvedAt }),
    },
    select: alertSelect,
  });
};

exports.createAlertEscalation = async ({
  alertId,
  escalatedById,
  reason,
  status = "PENDING",
  priority,
  targetDepartment = "INCIDENT_RESPONSE",
  incidentId = null,
}) => {
  return db().alertEscalation.create({
    data: {
      alertId,
      escalatedById,
      reason,
      status,
      priority,
      targetDepartment,
      incidentId,
    },
    include: {
      escalator: {
        select: { id: true, name: true, role: true },
      },
      alert: {
        select: {
          id: true,
          riskLevel: true,
          message: true,
          status: true,
        },
      },
    },
  });
};

exports.findActiveEscalationByAlertId = async (alertId) => {
  return db().alertEscalation.findFirst({
    where: {
      alertId,
      status: { in: ["PENDING", "ACKNOWLEDGED"] },
    },
    include: {
      escalator: {
        select: { id: true, name: true, role: true },
      },
    },
    orderBy: { escalatedAt: "desc" },
  });
};

exports.listEscalations = async ({ alertId, status, page = 1, pageSize = 20 } = {}) => {
  const where = {
    ...(alertId && { alertId }),
    ...(status && { status }),
  };
  const skip = (Number(page) - 1) * Number(pageSize);
  const take = Number(pageSize);

  const [escalations, total] = await Promise.all([
    db().alertEscalation.findMany({
      where,
      include: {
        escalator: { select: { id: true, name: true, role: true } },
        alert: {
          select: {
            id: true,
            riskLevel: true,
            message: true,
            status: true,
            riskZone: { select: { name: true, park: { select: { name: true } } } },
          },
        },
      },
      orderBy: { escalatedAt: "desc" },
      skip,
      take,
    }),
    db().alertEscalation.count({ where }),
  ]);

  return { escalations, total, page: Number(page), pageSize: Number(pageSize) };
};

exports.createAlert = async (data) => {
  return db().alert.create({
    data,
    select: alertSelect,
  });
};

exports.findActiveAlertByAnimalAndZone = async (animalId, riskZoneId, maxAgeMs = 4 * 60 * 60 * 1000) => {
  const cutoff = new Date(Date.now() - maxAgeMs);
  return db().alert.findFirst({
    where: {
      animalId,
      riskZoneId,
      status: "ACTIVE",
      generatedAt: { gte: cutoff },
    },
    select: alertSelect,
    orderBy: { generatedAt: "desc" },
  });
};

exports.updateAlert = async (id, data) => {
  return db().alert.update({
    where: { id },
    data,
    select: alertSelect,
  });
};

