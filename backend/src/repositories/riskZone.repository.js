const db = () => require('../config/database');

exports.createRiskZone = (data) =>
  db().riskZone.create({ data });

exports.getAllRiskZones = () =>
  db().riskZone.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' }
  });

exports.getRiskZoneById = (id) =>
  db().riskZone.findUnique({ where: { id } });

exports.updateRiskZone = (id, data) =>
  db().riskZone.update({
    where: { id },
    data
  });

exports.deleteRiskZone = (id) =>
  db().riskZone.update({
    where: { id },
    data: { isActive: false }
  });

exports.getFirstPark = () =>
  db().park.findFirst();
