import base from './vitest.config.mjs';
import { createRequire } from 'node:module';
const scope = createRequire(import.meta.url)('../test-support/coverage-scope.cjs');
import path from 'node:path';
export default { ...base, test: { ...base.test, coverage: {
  provider: 'istanbul',
  include: scope.buildManifest().applications['sensor-dashboard'].map(file => file.slice('sensor-dashboard/'.length)),
  reportsDirectory: path.join(scope.root, 'coverage/.raw/sensor-dashboard'),
  reporter: ['json', 'json-summary'],
  processingConcurrency: 1,
} } };
