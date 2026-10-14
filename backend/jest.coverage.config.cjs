const base = require('./jest.config.js');
const { jestScope } = require('../test-support/coverage-scope.cjs');
module.exports = {
  ...base,
  rootDir: __dirname,
  roots: ['<rootDir>', '<rootDir>/../shared'],
  collectCoverageFrom: jestScope('backend'),
  coverageProvider: 'babel',
  coverageDirectory: '<rootDir>/../coverage/.raw/backend',
  coverageReporters: ['json', 'json-summary'],
  maxWorkers: 1,
};
