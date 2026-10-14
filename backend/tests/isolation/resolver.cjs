const path = require('node:path');
const directory = __dirname;

module.exports = (request, options) => {
  // Only the guarded facade may load generated metadata; it never exports the real constructor.
  if (request === 'wildguard-test-prisma-metadata') {
    return path.resolve(directory, '../../node_modules/.prisma/client/index.js');
  }
  if (request === 'wildguard-test-prisma-runtime') {
    return path.resolve(directory, '../../node_modules/@prisma/client/runtime/client.js');
  }
  const resolved = options.defaultResolver(request, options);
  const file = resolved.replace(/\\/g, '/');
  if (/\/src\/config\/database\.js$/.test(file)) return path.join(directory, 'database-blocked.cjs');
  if (/\/src\/config\/environment\.js$/.test(file)) return path.join(directory, 'environment.cjs');
  if (/\/node_modules\/dotenv\//.test(file)) return path.join(directory, 'dotenv-blocked.cjs');
  if (/\/node_modules\/(?:pg|pg-pool|@prisma\/adapter-pg)\//.test(file)) return path.join(directory, 'driver-blocked.cjs');
  if (/\/node_modules\/@prisma\/client\/runtime\/client\.js$/.test(file)) return path.join(directory, 'prisma-runtime.cjs');
  if (/\/node_modules\/(?:@prisma\/client|\.prisma\/client)\/[^/]+\.js$/.test(file)) {
    return path.join(directory, 'prisma.cjs');
  }
  return resolved;
};
