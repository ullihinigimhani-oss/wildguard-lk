const metadata = require('wildguard-test-prisma-metadata');
module.exports = {
  ...metadata,
  PrismaClient: class {
    constructor() { throw new Error('TEST_DATABASE_BLOCKED: PrismaClient initialization is forbidden'); }
  },
};
