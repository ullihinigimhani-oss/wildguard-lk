const router = require('express').Router();
const controller = require('../controllers/riskZone.controller');

router.post('/', controller.createRiskZone);
router.get('/', controller.getAllRiskZones);
router.get('/:id', controller.getRiskZoneById);
router.put('/:id', controller.updateRiskZone);
router.delete('/:id', controller.deleteRiskZone);

module.exports = router;
