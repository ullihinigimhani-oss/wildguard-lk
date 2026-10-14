const runtime = require('wildguard-test-prisma-runtime');
module.exports = {
  ...runtime,
  getPrismaClient: () => class {
    constructor() { throw new Error('TEST_DATABASE_BLOCKED: Prisma runtime initialization is forbidden'); }
  },
};
