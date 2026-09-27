const fs = require('node:fs');
const path = require('node:path');

// The scaffold contains empty tests for future use cases. Discover them once implemented.
function findTests(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return findTests(file);
    return /\.test\.js$/.test(file) && fs.readFileSync(file, 'utf8').trim()
      ? [file.replace(/\\/g, '/')] : [];
  });
}

module.exports = {
  testEnvironment: 'node',
  testMatch: findTests(path.join(__dirname, 'tests')),
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/config/**'],
  coverageDirectory: 'coverage',
};
