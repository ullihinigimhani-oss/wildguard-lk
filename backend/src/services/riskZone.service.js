const {
  RISK_POLICY,
  zonePolygon,
  withinLimits,
} = require("../../../shared/riskGeometry");
const repository = require('../repositories/riskZone.repository');

const fail = (code, message, riskZones) =>
  Object.assign(new Error(message), {
    navigationError: true,
    status: 422,
    code,
    riskZones,
  });
exports.forPark = async (parkId) => {
  if (typeof parkId !== "string" || !parkId)
    throw fail(
      "RISK_ZONE_DATA_UNAVAILABLE",
      "Known risk-zone information is unavailable. Refresh the patrol or contact the Park Manager.",
      [],
    );
  const records = await require("../config/database").riskZone.findMany({
    where: { parkId, isActive: true, riskLevel: { in: ["HIGH", "CRITICAL"] } },
    orderBy: { id: "asc" },
    take: RISK_POLICY.maxZones + 1,
    select: {
      id: true,
      name: true,
      description: true,
      riskLevel: true,
      isActive: true,
      parkId: true,
      centerLatitude: true,
      centerLongitude: true,
      radiusMeters: true,
    },
  });
  const applicable = records.filter(
    (zone) =>
      zone.parkId === parkId &&
      zone.isActive &&
      ["HIGH", "CRITICAL"].includes(zone.riskLevel),
  );
  const zones = [];
  let invalid = false;
  for (const zone of applicable) {
    const geometry = zonePolygon(zone);
    if (!geometry) {
      invalid = true;
      continue;
    }
    zones.push({
      id: zone.id,
      name: String(zone.name).slice(0, 160),
      description:
        typeof zone.description === "string"
          ? zone.description.slice(0, 2000)
          : null,
      riskLevel: zone.riskLevel,
      geometry,
      radiusMeters: zone.radiusMeters,
    });
  }
  const publicZones = zones
    .slice(0, RISK_POLICY.maxZones)
    .map(({ radiusMeters, ...zone }) => zone);
  if (invalid)
    throw fail(
      "RISK_ZONE_DATA_INVALID",
      "A known high-risk area has invalid geographic data. Contact the Park Manager before continuing navigation.",
      publicZones,
    );
  if (!withinLimits(zones))
    throw fail(
      "RISK_AVOIDANCE_LIMIT",
      "Known risk areas exceed walking routing limits. Review the planned route and contact the Park Manager.",
      publicZones,
    );
  return publicZones;
};

exports.createRiskZone = async (data) => {
  return await repository.createRiskZone(data);
};

exports.getAllRiskZones = async () => {
  return await repository.getAllRiskZones();
};

exports.getRiskZoneById = async (id) => {
  return await repository.getRiskZoneById(id);
};

exports.updateRiskZone = async (id, data) => {
  return await repository.updateRiskZone(id, data);
};

exports.deleteRiskZone = async (id) => {
  return await repository.deleteRiskZone(id);
};
