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

exports.deleteRiskZone = async (id) => {
  const database = db();
  
  // First, delete related alerts to avoid foreign key constraint errors
  await database.alert.deleteMany({
    where: { riskZoneId: id }
  });
  
  // Then delete the risk zone
  await database.riskZone.delete({
    where: { id }
  });
};

exports.getFirstPark = () =>
  db().park.findFirst();
