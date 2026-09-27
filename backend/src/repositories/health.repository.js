const prisma = require('../config/database');

async function checkDatabase() {
  await prisma.$queryRaw`SELECT 1`;
}

module.exports = { checkDatabase };
