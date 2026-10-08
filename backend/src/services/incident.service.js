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
exports.create = (patrolId, input, user) =>
  repository.withActivePatrol(patrolId, user.id, async (tx, patrol) => {
    const { evidence, ...details } = input;
    if (evidence.length)
      throw incidentError(
        409,
        "EVIDENCE_UPLOAD_REQUIRED",
        "Save the incident without inline evidence, then upload files using its secure evidence endpoint.",
      );
    return present(
      await repository.create(tx, {
        ...details,
        reporterId: user.id,
        patrolId: patrol.id,
        parkId: patrol.parkId,
        status: "PENDING",
        syncStatus: "SYNCED",
      }),
    );
  });
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
// Repeat withdrawal returns 409 consistently; the original timestamp is retained.
exports.withdraw = (id, user) => mutate(id, null, user);
