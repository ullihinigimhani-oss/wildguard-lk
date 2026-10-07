const { createHash } = require("node:crypto");
const ors = require("./ors.service");
const riskZones = require("./riskZone.service");
const { pointInGeometry } = require("../../../shared/riskGeometry");
const {
  NAVIGATION,
  DESTINATION_TYPES,
  validCoordinate,
  shouldRecordSample,
} = require("../../../shared/patrolNavigation");
const db = () => require("../config/database");
const fail = (status, code, message) =>
  Object.assign(new Error(message), { status, code, navigationError: true });
const validId = (id) =>
  typeof id === "string" && id.length > 0 && id.length <= 128;
async function ownedPatrol(patrolId, rangerId, client = db()) {
  const patrol = await client.patrol.findFirst({
    where: { id: patrolId, rangerId },
    select: { id: true, status: true, actualStartTime: true, parkId: true },
  });
  if (!patrol)
    throw fail(404, "PATROL_UNAVAILABLE", "This patrol is not available.");
  return patrol;
}
exports.route = async (input, rangerId) => {
  if (
    input &&
    ["avoid_polygons", "options", "riskZones", "avoidanceGeometry"].some(
      (key) => Object.hasOwn(input, key),
    )
  )
    throw fail(
      400,
      "CUSTOM_AVOIDANCE_NOT_ALLOWED",
      "Risk avoidance is determined from saved park data.",
    );
  if (
    !validId(input?.patrolId) ||
    !validId(input?.destinationWaypointId) ||
    !validCoordinate(input?.currentLocation)
  )
    throw fail(
      400,
      "INVALID_NAVIGATION",
      "Select a patrol point and provide a valid current location.",
    );
  const patrol = await ownedPatrol(input.patrolId, rangerId);
  if (patrol.status !== "IN_PROGRESS")
    throw fail(
      409,
      "PATROL_NOT_ACTIVE",
      "Live navigation is available only while this patrol is in progress.",
    );
  const destination = await db().patrolWaypoint.findFirst({
    where: { id: input.destinationWaypointId, patrolId: patrol.id },
    select: {
      id: true,
      type: true,
      label: true,
      latitude: true,
      longitude: true,
    },
  });
  if (
    !destination ||
    !DESTINATION_TYPES.includes(destination.type) ||
    !validCoordinate(destination)
  )
    throw fail(
      400,
      "INVALID_DESTINATION",
      "Choose a valid patrol destination. High Risk Areas are warning locations.",
    );
  const zones = await riskZones.forPark(patrol.parkId);
  if (zones.some((zone) => pointInGeometry(destination, zone.geometry)))
    throw Object.assign(
      fail(
        422,
        "DESTINATION_IN_RISK_ZONE",
        "Next patrol point is inside a known high-risk area. Review the planned route and contact the Park Manager.",
      ),
      { riskZones: zones },
    );
  if (
    zones.some((zone) => pointInGeometry(input.currentLocation, zone.geometry))
  )
    throw Object.assign(
      fail(
        422,
        "RANGER_IN_RISK_ZONE",
        "You are currently inside a known high-risk area. No verified outward route is available. Review your position and contact the Park Manager.",
      ),
      { riskZones: zones },
    );
  try {
    return await ors.walkingRoute({
      patrolId: patrol.id,
      rangerId,
      destination,
      currentLocation: {
        latitude: input.currentLocation.latitude,
        longitude: input.currentLocation.longitude,
      },
      riskZones: zones,
    });
  } catch (error) {
    if (error.navigationError) error.riskZones = zones;
    throw error;
  }
};
exports.riskContext = async (patrolId, rangerId) => {
  if (!validId(patrolId))
    throw fail(400, "INVALID_PATROL", "Select a valid patrol.");
  const patrol = await ownedPatrol(patrolId, rangerId);
  if (patrol.status !== "IN_PROGRESS")
    throw fail(
      409,
      "PATROL_NOT_ACTIVE",
      "Live navigation requires an active patrol.",
    );
  return riskZones.forPark(patrol.parkId);
};
exports.fullPatrolRoute = async (patrolId, rangerId) => {
  if (!validId(patrolId))
    throw fail(400, "INVALID_PATROL", "Select a valid patrol.");
  const patrol = await ownedPatrol(patrolId, rangerId);
  if (patrol.status !== "IN_PROGRESS")
    throw fail(
      409,
      "PATROL_NOT_ACTIVE",
      "Live navigation requires an active patrol.",
    );
  const saved = await db().patrolWaypoint.findMany({
    where: { patrolId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      type: true,
      order: true,
      label: true,
      latitude: true,
      longitude: true,
    },
  });
  if (
    saved.length < 2 ||
    saved.length > 100 ||
    saved.some(
      (p, i) =>
        p.order !== i ||
        !validCoordinate(p) ||
        ![...DESTINATION_TYPES, "HIGH_RISK"].includes(p.type),
    ) ||
    saved[0].type !== "START" ||
    saved.at(-1).type !== "END" ||
    saved.filter((p) => p.type === "START").length !== 1 ||
    saved.filter((p) => p.type === "END").length !== 1
  )
    throw fail(
      422,
      "INVALID_PATROL_ROUTE",
      "A complete valid saved patrol route is required. Contact the Park Manager.",
    );
  const waypoints = saved.filter((p) => DESTINATION_TYPES.includes(p.type));
  const zones = await riskZones.forPark(patrol.parkId);
  const blocked = waypoints.find((p) =>
    zones.some((z) => pointInGeometry(p, z.geometry)),
  );
  if (blocked)
    throw Object.assign(
      fail(
        422,
        "DESTINATION_IN_RISK_ZONE",
        "A required patrol point is inside a known high-risk area. Review the planned route and contact the Park Manager.",
      ),
      { riskZones: zones, waypointId: blocked.id },
    );
  try {
    return await ors.walkingRoute({
      rangerId,
      patrolId,
      currentLocation: waypoints[0],
      destination: waypoints.at(-1),
      waypoints,
      riskZones: zones,
    });
  } catch (error) {
    if (error.navigationError) error.riskZones = zones;
    throw error;
  }
};
exports.locations = async (patrolId, rangerId) => {
  if (!validId(patrolId))
    throw fail(400, "INVALID_PATROL", "Select a valid patrol.");
  await ownedPatrol(patrolId, rangerId);
  const locations = await db().patrolLocation.findMany({
    where: { patrolId },
    orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
    take: 1000,
    select: { latitude: true, longitude: true, recordedAt: true },
  });
  return locations.reverse();
};
exports.recordLocation = async (patrolId, input, rangerId) => {
  const recordedAt =
    typeof input?.recordedAt === "string"
      ? new Date(input.recordedAt)
      : new Date(NaN);
  const time = recordedAt.getTime(),
    now = Date.now();
  if (
    !validId(patrolId) ||
    !validCoordinate(input) ||
    !Number.isFinite(time) ||
    now - time > NAVIGATION.sampleMaxAgeMs ||
    time - now > NAVIGATION.futureToleranceMs ||
    (input.accuracy != null &&
      (!Number.isFinite(input.accuracy) ||
        input.accuracy < 0 ||
        input.accuracy > NAVIGATION.maximumAccuracyMeters))
  )
    throw fail(
      400,
      "INVALID_GPS_SAMPLE",
      "Provide a recent valid GPS sample with usable accuracy.",
    );
  const sample = {
    latitude: input.latitude,
    longitude: input.longitude,
    recordedAt,
  };
  return db().$transaction(
    async (tx) => {
      // Serialize sampling with start/complete's row updates. No post-completion race.
      await tx.$queryRaw`SELECT "id" FROM "Patrol" WHERE "id" = ${patrolId} AND "rangerId" = ${rangerId} FOR UPDATE`;
      const patrol = await ownedPatrol(patrolId, rangerId, tx);
      if (patrol.status !== "IN_PROGRESS")
        throw fail(
          409,
          "PATROL_NOT_ACTIVE",
          "GPS samples can be recorded only while this patrol is in progress.",
        );
      const id =
        "gps_" +
        createHash("sha256")
          .update(patrolId + "|" + recordedAt.toISOString())
          .digest("hex");
      if (
        await tx.patrolLocation.findUnique({
          where: { id },
          select: { id: true },
        })
      )
        return { accepted: false, reason: "DUPLICATE" };
      const last = await tx.patrolLocation.findFirst({
        where: { patrolId },
        orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
        select: { latitude: true, longitude: true, recordedAt: true },
      });
      if (
        patrol.actualStartTime &&
        time < new Date(patrol.actualStartTime).getTime()
      )
        return { accepted: false, reason: "BEFORE_START" };
      if (
        last &&
        !shouldRecordSample(
          { ...last, recordedAt: last.recordedAt.toISOString() },
          { ...sample, recordedAt: recordedAt.toISOString() },
        )
      )
        return { accepted: false, reason: "THROTTLED" };
      await tx.patrolLocation.create({
        data: { id, patrolId, ...sample },
        select: { latitude: true, longitude: true, recordedAt: true },
      });
      return { accepted: true, location: sample };
    },
    { maxWait: 5000, timeout: 10000 },
  );
};
