import base from './vite.config.js';
import { createRequire } from 'node:module';
const scope = createRequire(import.meta.url)('../test-support/coverage-scope.cjs');
import path from 'node:path';
export default context => {
  const config = base(context);
  return { ...config, test: { ...config.test, coverage: {
    provider: 'istanbul',
    include: scope.buildManifest().applications.web.map(file => file.slice('web/'.length)),
    reportsDirectory: path.join(scope.root, 'coverage/.raw/web'),
    reporter: ['json', 'json-summary'],
    processingConcurrency: 1,
  } } };
};
