const { installNetworkIsolation } = require('../../test-support/network-isolation.cjs');
const restore = installNetworkIsolation();
afterAll(restore);
