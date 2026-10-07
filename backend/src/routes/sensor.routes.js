const router = require('express').Router();
router.post('/', require('../controllers/sensor.controller').addSensorData);
router.post('/animals', require('../controllers/sensor.controller').createAnimal);
router.get('/animals', require('../controllers/sensor.controller').getAllAnimals);
router.get('/animals/locations', require('../controllers/sensor.controller').getAnimalsWithLatestLocations);
router.put('/animals/:id', require('../controllers/sensor.controller').updateAnimal);
module.exports = router;
