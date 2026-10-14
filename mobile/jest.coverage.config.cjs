const base = require('./jest.config.js');
const { jestScope } = require('../test-support/coverage-scope.cjs');
module.exports = {
  ...base,
  rootDir: __dirname,
  roots: ['<rootDir>', '<rootDir>/../shared'],
  collectCoverageFrom: jestScope('mobile'),
  coverageProvider: 'babel',
  coverageDirectory: '<rootDir>/../coverage/.raw/mobile',
  coverageReporters: ['json', 'json-summary'],
  // Cold Expo/Babel instrumentation can exceed the normal 5s wall-clock budget.
  // Functional waitFor limits and fake-clock assertions remain unchanged.
  testTimeout: 15000,
  maxWorkers: 1,
};
