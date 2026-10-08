const repository = require("../repositories/incident.repository");
const {
  incidentError,
  validateMetadata,
} = require("../validators/incident.validator");
function safeEvidence(evidence) {
  let metadata = null;
  try {
    const { storage, ...details } = evidence.metadata || {};
    metadata = validateMetadata(details).metadata;
  } catch {
    /* Legacy/unsupported metadata is not exposed. */
  }
  return {
    ...evidence,
    fileUrl: null,
    metadata,
    mediaAvailable:
      evidence.metadata?.storage?.provider === "cloudinary" &&
      evidence.metadata?.storage?.type === "authenticated",
  };
}
function present(incident, summary = false) {
  const { _count, evidence, ...record } = incident;
  return {
    ...record,
    withdrawn: Boolean(record.withdrawnAt),
    evidenceCount: _count?.evidence ?? evidence?.length ?? 0,
    ...(summary && {
      description: record.description.slice(0, 500),
    }),
    ...(evidence && {
      evidence: evidence.map(safeEvidence),
    }),
  };
}
exports.getIncident = async (id, user) => {
  const incident = await repository.findIncident(id, user);
  if (!incident)
    throw incidentError(
      404,
      "INCIDENT_UNAVAILABLE",
      "This incident is not available.",
    );
  return present(incident);
};
exports.listForPatrol = async (patrolId, filters, user) => {
  if (!(await repository.findPatrol(patrolId, user)))
    throw incidentError(
      404,
      "PATROL_UNAVAILABLE",
      "This patrol is not available.",
    );
  return exports.list({
    ...filters,
    where: {
      ...filters.where,
      patrolId,
      ...(user.role === "RANGER" && repository.rangerScope(user.id)),
    },
  });
};
exports.list = async (filters) => {
  const result = await repository.listIncidents(filters.where, filters.page);
  return {
    ...result,
    incidents: result.incidents.map((incident) => present(incident, true)),
  };
};
exports.create = async (patrolId, input, user, clientKey) => {
  let stableId;
  if (clientKey !== undefined) {
    if (typeof clientKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientKey))
      throw incidentError(409,'INVALID_IDEMPOTENCY_KEY','Use a valid client incident UUID.');
    stableId = 'offline_' + require('node:crypto').createHash('sha256').update(user.id + '|' + patrolId + '|' + clientKey.toLowerCase()).digest('hex');
    const previous = await repository.findIncident(stableId, user);
    if (previous) return replay(previous,input);
  }
  function replay(previous,body) {
    const match=previous.patrolId===patrolId && previous.reporterId===user.id && ['title','incidentType','description','latitude','longitude'].every(k=>previous[k]===body[k]) && new Date(previous.occurredAt).getTime()===new Date(body.occurredAt).getTime() && (previous.manualLocation ?? null)===(body.manualLocation ?? null) && !body.evidence?.length;
    if(!match)throw incidentError(409,'IDEMPOTENCY_CONFLICT','This client incident already exists with different content. Open the saved report.');
    return present(previous);
  }
  try {
    return await repository.withActivePatrol(patrolId, user.id, async (tx, patrol) => {
    if (stableId) {
      const previous = await tx.incident.findUnique({where:{id:stableId},include:{evidence:true}});
      if(previous)return replay(previous,input);
    }
    const { evidence, ...details } = input;
    if (evidence.length)
      throw incidentError(
        409,
        "EVIDENCE_UPLOAD_REQUIRED",
        "Save the incident without inline evidence, then upload files using its secure evidence endpoint.",
      );
    return present(
      await repository.create(tx, {
        ...(stableId && {id:stableId}),
        ...details,
        reporterId: user.id,
        patrolId: patrol.id,
        parkId: patrol.parkId,
        status: "PENDING",
        syncStatus: "SYNCED",
      }),
    );
  });
  } catch (error) {
    // Completion can win the lock after the first replay read. Recover only an
    // already-persisted, owned matching report; never create after completion.
    if (stableId && (error.code === "PATROL_NOT_ACTIVE" || error.code === "P2002")) {
      const previous = await repository.findIncident(stableId, user);
      if (previous) return replay(previous, input);
    }
    throw error;
  }
};
async function mutate(id, data, user) {
  const existing = await repository.findIncident(id, user);
  if (!existing)
    throw incidentError(
      404,
      "INCIDENT_UNAVAILABLE",
      "This incident is not available.",
    );
  if (!existing.patrolId)
    throw incidentError(
      409,
      "PATROL_REQUIRED",
      "This historical incident is not linked to a patrol.",
    );
  return repository.withActivePatrol(existing.patrolId, user.id, async (tx) => {
    const incident = await repository.lockIncident(
      tx,
      id,
      existing.patrolId,
      user.id,
    );
    if (incident.withdrawnAt)
      throw incidentError(
        409,
        "INCIDENT_WITHDRAWN",
        "This incident has already been withdrawn.",
      );
    if (incident.status !== "PENDING")
      throw incidentError(
        409,
        "INCIDENT_REVIEW_LOCKED",
        "This incident is under review and cannot be changed.",
      );
    return present(
      await repository.update(
        tx,
        id,
        existing.patrolId,
        user.id,
        data === null
          ? {
              withdrawnAt: new Date(),
            }
          : data,
      ),
    );
  });
}
exports.edit = (id, data, user) => mutate(id, data, user);

exports.updateStatus = async (id, status, user) => {
  // Simple status update without complex checks
  await repository.updateStatus(id, status);
  return { message: 'Incident status updated successfully' };
};

// Repeat withdrawal returns 409 consistently; the original timestamp is retained.
exports.withdraw = (id, user) => mutate(id, null, user);
// Park Manager review. Read scope, status vocabulary and persistence are all
// server-side; the client only proposes a status value.
exports.updateStatus = async (id, status, user) => {
  const existing = await repository.findIncident(id, user);
  if (!existing)
    throw incidentError(
      404,
      "INCIDENT_UNAVAILABLE",
      "This incident is not available.",
    );
  if (existing.withdrawnAt)
    throw incidentError(
      409,
      "INCIDENT_WITHDRAWN",
      "This report has been withdrawn and cannot be updated.",
    );
  return present(await repository.setStatus(id, status));
};
