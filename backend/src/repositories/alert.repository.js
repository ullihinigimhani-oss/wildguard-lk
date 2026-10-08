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
    },
    update: {
      acknowledgedAt: new Date(),
    },
    select: {
      id: true,
      alertId: true,
      userId: true,
      acknowledgedAt: true,
    },
  });
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
