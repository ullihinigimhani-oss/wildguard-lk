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
exports.updateAnimal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await service.updateAnimal(id, req.body);
    res.json({ success: true, message: 'Animal updated successfully', data });
  } catch (error) { next(error); }
};
