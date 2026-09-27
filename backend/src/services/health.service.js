const healthRepository = require('../repositories/health.repository');

async function getHealth() {
  try {
    await healthRepository.checkDatabase();
    return {
      success: true,
      message: 'WildGuard LK API is running',
      database: 'connected',
    };
  } catch {
    return {
      success: false,
      message: 'WildGuard LK API is running, but database connectivity is unavailable',
      database: 'disconnected',
    };
  }
}

module.exports = { getHealth };
