// Explicit manual connectivity check. Temporary geometry only; no database writes.
const provider = require("../src/services/ors.service");
const {
  zonePolygon,
  routeIntersectsZones,
} = require("../../shared/riskGeometry");
(async () => {
  const nativeFetch = global.fetch,
    statuses = [];
  global.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    statuses.push(response.status);
    return response;
  };
  const input = {
    patrolId: "verification-only",
    destination: {
      id: "temporary-end",
      type: "END",
      label: "Connectivity test",
      latitude: 49.420318,
      longitude: 8.687872,
    },
    currentLocation: { latitude: 49.41461, longitude: 8.681495 },
  };
  try {
    const normal = await provider.walkingRoute({
      ...input,
      rangerId: "verify-normal",
    });
    const middle =
      normal.geometry.coordinates[
        Math.floor(normal.geometry.coordinates.length / 2)
      ];
    const record = {
      centerLongitude: middle[0],
      centerLatitude: middle[1],
      radiusMeters: 35,
    };
    const zone = {
      id: "temporary-zone",
      name: "Temporary connectivity zone",
      description: null,
      riskLevel: "HIGH",
      geometry: zonePolygon(record),
    };
    const avoiding = await provider.walkingRoute({
      ...input,
      rangerId: "verify-avoidance",
      riskZones: [zone],
    });
    console.log(
      JSON.stringify({
        authentication: statuses.every((status) => status === 200)
          ? "succeeded"
          : "failed",
        httpStatuses: statuses,
        profile: avoiding.profile,
        avoidanceApplied: avoiding.riskAvoidance.applied,
        geometryReturned: avoiding.geometry.coordinates.length > 1,
        intersectsZone: routeIntersectsZones(avoiding.geometry, [zone]),
        distanceReturned: Number.isFinite(avoiding.distanceMeters),
        durationReturned: Number.isFinite(avoiding.durationSeconds),
        normalDistanceMeters: normal.distanceMeters,
        avoidingDistanceMeters: avoiding.distanceMeters,
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        httpStatuses: statuses,
        errorCode: error.code || "VERIFICATION_FAILED",
      }),
    );
    process.exitCode = 1;
  } finally {
    global.fetch = nativeFetch;
  }
})();
