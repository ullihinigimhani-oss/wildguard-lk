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
