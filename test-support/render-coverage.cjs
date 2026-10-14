// Render only verified, original-source Istanbul maps; never load application code.
const fs = require('node:fs');
const path = require('node:path');
const { root, buildManifest } = require('./coverage-scope.cjs');
const { createCoverageMap } = require('../backend/node_modules/istanbul-lib-coverage');
const { createContext } = require('../backend/node_modules/istanbul-lib-report');
const reporters = require('../backend/node_modules/istanbul-reports');
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  if (!/^--(?:manifest|raw|output|apps)=/.test(arg)) throw new Error(`Unknown argument ${arg}`);
  return arg.slice(2).split(/=(.*)/s).slice(0, 2);
}));
function inside(relativePath) {
  const target = path.resolve(root, relativePath);
  if (!target.startsWith(root + path.sep)) throw new Error('Output/input path must remain inside repository');
  return target;
}
const manifest = JSON.parse(fs.readFileSync(inside(args.manifest || 'coverage/source-manifest.json'), 'utf8'));
const current = buildManifest();
if (JSON.stringify(manifest.hashes) !== JSON.stringify(current.hashes)) throw new Error('Source hashes changed: regenerate manifest and rerun coverage');
const rawRoot = inside(args.raw || 'coverage/.raw');
const output = inside(args.output || 'coverage');
const normalize = value => value.replace(/"withdrawnAt":"[^"]+"/g, '"withdrawnAt":"<runtime>"');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const available = args.apps ? args.apps.split(',') : ['backend', 'mobile'];
if (available.some(app => !Object.hasOwn(manifest.applications, app))) throw new Error('Unknown application');
const previous = args.apps ? read(path.join(output, 'verification.json')) : null;
const summaries = { ...previous?.applications };
const sharedMaps = {};
const inventories = { ...previous?.inventories };
for (const app of available) {
  const frontend = ['web', 'sensor-dashboard'].includes(app);
  const resultFile = path.join(root, `.cache/${frontend ? 'phase4c' : 'phase4'}-${app === 'sensor-dashboard' ? 'sensor' : app}-coverage-tests.json`);
  const result = read(resultFile);
  const baseline = read(path.join(root, `.cache/batch5-${app === 'sensor-dashboard' ? 'sensor' : app}-full.json`));
  const actual = new Set(result.testResults.flatMap(s => s.assertionResults).filter(t => t.status === 'passed').map(t => normalize(t.fullName)));
  if (!result.success || result.numFailedTests || result.numPendingTests || result.numTodoTests || result.numPassedTests !== baseline.numPassedTests) throw new Error(`Incomplete safe ${app} test run`);
  if (baseline.testResults.flatMap(s => s.assertionResults).some(t => t.status === 'passed' && !actual.has(normalize(t.fullName)))) throw new Error(`${app} baseline assertion missing`);
  const rawFile = path.join(rawRoot, app, 'coverage-final.json');
  if (fs.statSync(rawFile).mtimeMs < result.startTime) throw new Error(`${app} raw coverage predates test run`);
  const raw = read(rawFile), byPath = new Map();
  const expected = [...manifest.applications[app], ...(frontend ? [] : manifest.shared)];
  for (const data of Object.values(raw)) {
    const relative = path.relative(root, path.resolve(data.path)).replace(/\\/g, '/');
    const canonical = expected.find(file => file.toLowerCase() === relative.toLowerCase());
    if (!canonical) throw new Error(`Unexpected coverage file: ${relative}`);
    if (byPath.has(canonical)) throw new Error(`Duplicate coverage file: ${canonical}`);
    byPath.set(canonical, { ...data, path: path.join(root, canonical) });
  }
  const missing = expected.filter(file => !byPath.has(file));
  if (missing.length) throw new Error(`${app} source files missing from coverage: ${missing.join(', ')}`);
  inventories[app] = { sourceFiles: manifest.applications[app].length, rawFiles: byPath.size, tests: result.numPassedTests, suites: result.testResults.length, openHandles: result.openHandles?.length, zeroStatementHits: [] };
  const appMap = createCoverageMap({});
  const sharedMap = createCoverageMap({});
  for (const [file, data] of byPath) {
    (manifest.shared.includes(file) ? sharedMap : appMap).addFileCoverage(data);
    if (!manifest.shared.includes(file) && Object.values(data.s).every(hit => hit === 0)) inventories[app].zeroStatementHits.push(file);
  }
  sharedMaps[app] = sharedMap;
  summaries[app] = appMap.getCoverageSummary().toJSON();
  render(appMap, path.join(output, app));
}
function render(map, directory) {
  for (const file of map.files()) {
    const source = fs.readFileSync(file, 'utf8');
    // Report only filenames; do not render a potential literal credential.
    const candidates = [...source.matchAll(/\b(?:DATABASE_URL|DIRECT_URL|API_SECRET|API_KEY|JWT_SECRET|PASSWORD)\s*[:=]\s*["'`]([^"'`\r\n]+)["'`]/gi)];
    const publicPasswordMessages = new Set([
      'Enter your password.',
      'Use at least 8 characters with uppercase, lowercase and a number; maximum 72 UTF-8 bytes.',
    ]);
    const publicValidationOwners = {
      'backend/src/validators/auth.validator.js': 'fields.',
      'mobile/src/screens/auth/LoginScreen.js': 'next.',
      'mobile/src/utils/registration.js': 'errors.',
      'web/src/utils/registration.js': 'errors.',
    };
    const fileKey = path.relative(root, file).replace(/\\/g, '/');
    // Recognize verified public UI/validator prompts, never arbitrary password values.
    if (candidates.some(match => {
      if (publicPasswordMessages.has(match[1])) return false;
      const owner = publicValidationOwners[fileKey];
      return !(owner && /^password\b/i.test(match[0]) && source.slice(0, match.index).endsWith(owner));
    })) throw new Error(`Review potential literal credential in report source: ${path.relative(root, file)}`);
  }
  fs.mkdirSync(directory, { recursive: true });
  const context = createContext({ dir: directory, coverageMap: map, sourceFinder(file) {
    const relative = path.relative(root, file).replace(/\\/g, '/');
    if (!Object.hasOwn(manifest.hashes, relative)) throw new Error('Source outside approved manifest');
    return fs.readFileSync(file, 'utf8');
  } });
  reporters.create('html').execute(context);
  reporters.create('json').execute(context);
  reporters.create('json-summary').execute(context);
}
const signature = data => JSON.stringify([data.statementMap, data.fnMap, data.branchMap]);
const compatible = sharedMaps.backend && sharedMaps.mobile ? manifest.shared.every(file => signature(sharedMaps.backend.fileCoverageFor(path.join(root, file)).toJSON()) === signature(sharedMaps.mobile.fileCoverageFor(path.join(root, file)).toJSON())) : previous?.shared.compatible;
let shared = previous?.shared;
if (sharedMaps.backend && sharedMaps.mobile && compatible) {
  const merged = createCoverageMap(sharedMaps.backend.toJSON());
  merged.merge(sharedMaps.mobile);
  render(merged, path.join(output, 'shared'));
  shared = { compatible: true, contributors: available, sourceFiles: manifest.shared.length, metrics: merged.getCoverageSummary().toJSON(), report: 'shared/index.html' };
} else if (sharedMaps.backend && sharedMaps.mobile) {
  for (const app of available) render(sharedMaps[app], path.join(output, 'shared', app));
  shared = { compatible: false, reason: 'Statement/function/branch maps differ; no all-runner shared percentage', reports: available.map(app => ({ app, report: `shared/${app}/index.html`, metrics: sharedMaps[app].getCoverageSummary().toJSON() })) };
}
const unmeasured = Object.keys(manifest.applications).filter(app => !summaries[app]);
const summary = { generatedAt: new Date().toISOString(), applications: summaries, inventories, shared, unmeasured, projectPercentage: null, reason: 'Application and shared metrics reported separately; no averaged project percentage', versions: { ...previous?.versions, provider: 'babel', backendJest: read(path.join(root, 'backend/node_modules/jest/package.json')).version, mobileJest: read(path.join(root, 'mobile/node_modules/jest/package.json')).version, backendIstanbulPlugin: read(path.join(root, 'backend/node_modules/babel-plugin-istanbul/package.json')).version, mobileIstanbulPlugin: read(path.join(root, 'mobile/node_modules/babel-plugin-istanbul/package.json')).version, istanbulReports: read(path.join(root, 'backend/node_modules/istanbul-reports/package.json')).version, ...(args.apps && { vitest: read(path.join(root, 'web/node_modules/vitest/package.json')).version, vitestIstanbul: read(path.join(root, 'web/node_modules/@vitest/coverage-istanbul/package.json')).version }) } };
fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(summary, null, 2));
const metrics = value => ['statements', 'branches', 'functions', 'lines'].map(key => `${key}: ${value[key].covered}/${value[key].total} (${value[key].total ? value[key].pct + '%' : 'N/A'})`).join('; ');
fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>WildGuard coverage</title><body><h1>WildGuard coverage reports</h1><p>${summary.generatedAt}</p><ul>${Object.keys(summaries).map(app => `<li><a href="${app}/index.html">${app}</a>: ${metrics(summaries[app])}; ${inventories[app].sourceFiles} application files</li>`).join('')}${compatible ? `<li><a href="shared/index.html">Shared</a>: ${metrics(shared.metrics)}; backend and mobile compatible maps merged once</li>` : ['backend', 'mobile'].map(app => `<li><a href="shared/${app}/index.html">Shared exercised by ${app}</a> — incompatible maps, unmerged</li>`).join('')}</ul><p>Unmeasured applications: ${unmeasured.join(', ') || 'none'}. No averaged project-wide or combined percentage.</p><p>Original source included even when untested; application reports exclude shared to prevent duplicate counting. Zero-total metrics are not evidence of testing. See verification.json and source-manifest.json for inventory and hashes.</p></body></html>`);
console.log(JSON.stringify({ applications: summaries, inventories, shared }));
