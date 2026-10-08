const service = require('../services/riskZone.service');
const repository = require('../repositories/riskZone.repository');

exports.createRiskZone = async (req, res, next) => {
  try {
    let data = req.body;

    // If parkId is not provided or is the default placeholder, get the first available park
    if (!data.parkId || data.parkId === 'default-park-id') {
      const park = await repository.getFirstPark();
      if (!park) {
        return res.status(400).json({ success: false, message: 'No parks available in the system' });
      }
      data.parkId = park.id;
    }

    const result = await service.createRiskZone(data);
    res.json({ success: true, message: 'Risk zone created successfully', data: result });
  } catch (error) { next(error); }
};

exports.getAllRiskZones = async (req, res, next) => {
  try {
    const data = await service.getAllRiskZones();
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

exports.getRiskZoneById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await service.getRiskZoneById(id);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

exports.updateRiskZone = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await service.updateRiskZone(id, req.body);
    res.json({ success: true, message: 'Risk zone updated successfully', data });
  } catch (error) { next(error); }
};

exports.deleteRiskZone = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await service.deleteRiskZone(id);
    res.json({ success: true, message: 'Risk zone deleted successfully', data });
  } catch (error) { next(error); }
};
