// Runs before test modules and application imports. Replace inherited values without reading them.
for (const key of ['DATABASE_URL', 'DIRECT_URL', 'CLOUDINARY_URL', 'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'RESEND_API_KEY', 'EMAIL_FROM', 'ORS_API_KEY']) {
  delete process.env[key];
}
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/blocked_test_database';
process.env.JWT_SECRET = 'isolated-test-secret-at-least-32-characters';
const { installNetworkIsolation } = require('../../../test-support/network-isolation.cjs');
global.__restoreTestNetwork = installNetworkIsolation({
  allowLocalServers: /[\\/]integration[\\/]|[\\/]report\.api\.test\.js$/.test(expect.getState().testPath),
});
afterAll(() => global.__restoreTestNetwork());
