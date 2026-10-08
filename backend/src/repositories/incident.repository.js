const db = () => require("../config/database");
const {
  incidentError
} = require("../validators/incident.validator");
const identity = {
  id: true,
  name: true
};
const summarySelect = {
  id: true,
  title: true,
  incidentType: true,
  description: true,
  occurredAt: true,
  reportedAt: true,
  latitude: true,
  longitude: true,
  manualLocation: true,
  status: true,
  syncStatus: true,
  withdrawnAt: true,
  reporterId: true,
  parkId: true,
  patrolId: true,
  createdAt: true,
  updatedAt: true,
  reporter: {
    select: identity
  },
  park: {
    select: identity
  },
  patrol: {
    select: {
      id: true,
      routeName: true,
      status: true,
      ranger: {
        select: identity
      }
    }
  },
  _count: {
    select: {
      evidence: true
    }
  }
};
const detailSelect = {
  ...summarySelect,
  evidence: {
    orderBy: [{
      createdAt: "asc"
    }, {
      id: "asc"
    }],
    select: {
      id: true,
      fileUrl: true,
      fileType: true,
      caption: true,
      metadata: true,
      createdAt: true
    }
  }
};
// Reporter ownership and current assignment both apply. Historical unlinked
// reports remain readable by their reporter but cannot be mutated as patrol reports.
const rangerScope = rangerId => ({
  reporterId: rangerId,
  OR: [{
    patrolId: null
  }, {
    patrol: {
      is: {
        rangerId
      }
    }
  }]
});
exports.rangerScope = rangerScope;
exports.findPatrol = (id, user) => db().patrol.findFirst({
  where: {
    id,
    ...(user.role === "RANGER" && {
      rangerId: user.id
    })
  },
  select: {
    id: true,
    rangerId: true,
    parkId: true,
    status: true
  }
});
exports.findIncident = (id, user) => db().incident.findFirst({
  where: {
    id,
    ...(user.role === "RANGER" && rangerScope(user.id))
  },
  select: detailSelect
});
exports.listIncidents = (where, page) => db().$transaction(async tx => {
  // An interactive transaction owns one pg client: issue queries sequentially.
  const incidents = await tx.incident.findMany({
    where,
    select: summarySelect,
    take: 25,
    skip: (page - 1) * 25,
    orderBy: [{
      occurredAt: {
        sort: "desc",
        nulls: "last"
      }
    }, {
      createdAt: "desc"
    }, {
      id: "desc"
    }]
  });
  const total = await tx.incident.count({
    where
  });
  return {
    incidents,
    total,
    page,
    pageSize: 25
  };
}, {
  isolationLevel: "RepeatableRead"
});
exports.withActivePatrol = (patrolId, rangerId, action) => db().$transaction(async tx => {
  // A parameterized row lock serializes with the existing completion UPDATE.
  // Always acquire Patrol before Incident; no GPS/navigation writes are needed.
  const [patrol] = await tx.$queryRaw`
    SELECT "id", "status"::text AS "status", "rangerId", "parkId" FROM "Patrol"
    WHERE "id" = ${patrolId} AND "rangerId" = ${rangerId} FOR UPDATE`;
  if (!patrol) throw incidentError(404, "PATROL_UNAVAILABLE", "This patrol is not available.");
  if (patrol.status !== "IN_PROGRESS") throw incidentError(409, "PATROL_NOT_ACTIVE", "Incidents can be changed only while the patrol is in progress.");
  return action(tx, patrol);
}, {
  isolationLevel: "ReadCommitted",
  maxWait: 5000,
  timeout: 10000
});
exports.lockIncident = async (tx, id, patrolId, reporterId) => {
  const [incident] = await tx.$queryRaw`
    SELECT "id", "patrolId", "reporterId", "status"::text AS "status", "withdrawnAt" FROM "Incident"
    WHERE "id" = ${id} AND "patrolId" = ${patrolId} AND "reporterId" = ${reporterId} FOR UPDATE`;
  if (!incident) throw incidentError(404, "INCIDENT_UNAVAILABLE", "This incident is not available.");
  return incident;
};
exports.create = (tx, data) => tx.incident.create({
  data,
  select: detailSelect
});
exports.update = async (tx, id, patrolId, reporterId, data) => {
  const result = await tx.incident.updateMany({
    where: {
      id,
      patrolId,
      reporterId,
      status: "PENDING",
      withdrawnAt: null
    },
    data
  });
  if (!result.count) throw incidentError(409, "INCIDENT_CHANGED", "This incident changed. Refresh and try again.");
  return tx.incident.findFirst({
    where: {
      id,
      patrolId,
      reporterId
    },
    select: detailSelect
  });
};
// Manager review does not touch Patrol, Reporter ownership or the active-patrol
// lock: a review can happen after the patrol has finished. The guard repeats the
// withdrawn check so a report withdrawn mid-request is never re-stated.
exports.setStatus = async (id, status) => db().$transaction(async tx => {
  const result = await tx.incident.updateMany({
    where: {
      id,
      withdrawnAt: null
    },
    data: {
      status
    }
  });
  if (!result.count) throw incidentError(409, "INCIDENT_CHANGED", "This incident changed. Refresh and try again.");
  return tx.incident.findFirst({
    where: {
      id
    },
    select: detailSelect
  });
}, {
  isolationLevel: "ReadCommitted",
  maxWait: 5000,
  timeout: 10000
});
