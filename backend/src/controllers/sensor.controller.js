const service = require('../services/sensor.service');
exports.addSensorData = async (req, res, next) => {
  try {
    console.log('Add sensor data request:', req.body);
    const data = await service.addSensorData(req.body);
    res.status(201).json({ success: true, message: 'Sensor data added successfully', data });
  } catch (error) {
    console.error('Add sensor data error:', error);
    next(error);
  }
};
exports.createAnimal = async (req, res, next) => {
  try {
    console.log('Create animal request:', req.body);
    const data = await service.createAnimal(req.body);
    res.status(201).json({ success: true, message: 'Animal created successfully', data });
  } catch (error) {
    console.error('Create animal error:', error);
    next(error);
  }
};
exports.getAllAnimals = async (req, res, next) => {
  try {
    const animals = await service.getAllAnimals();
    res.json({ success: true, data: animals });
  } catch (error) { next(error); }
};
exports.getAnimalsWithLatestLocations = async (req, res, next) => {
  try {
    const animals = await service.getAnimalsWithLatestLocations();
    res.json({ success: true, data: animals });
  } catch (error) { next(error); }
};
exports.getAnimalLocationsByDateRange = async (req, res, next) => {
  try {
    const { animalId } = req.params;
    const { startDate, endDate } = req.query;
    const locations = await service.getAnimalLocationsByDateRange(animalId, new Date(startDate), new Date(endDate));
    res.json({ success: true, data: locations });
  } catch (error) { next(error); }
};
exports.getAllLocationsByDateRange = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const locations = await service.getAllLocationsByDateRange(new Date(startDate), new Date(endDate));
    res.json({ success: true, data: locations });
  } catch (error) { next(error); }
};
exports.getDensityZones = async (req, res, next) => {
  try {
    const { startDate, endDate, radius } = req.query;
    const zones = await service.getDensityZones(
      new Date(startDate),
      new Date(endDate),
      radius ? parseInt(radius) : 300
    );
    res.json({ success: true, data: zones });
  } catch (error) { next(error); }
};
exports.updateAnimal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await service.updateAnimal(id, req.body);
    res.json({ success: true, message: 'Animal updated successfully', data });
  } catch (error) { next(error); }
};
exports.deleteAnimal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await service.deleteAnimal(id);
    res.json({ success: true, message: 'Animal deleted successfully', data });
  } catch (error) { next(error); }
};
