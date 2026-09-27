const healthService = require('../services/health.service');

async function getHealth(req, res) {
  const health = await healthService.getHealth();
  res.status(health.success ? 200 : 503).json(health);
}

module.exports = { getHealth };
