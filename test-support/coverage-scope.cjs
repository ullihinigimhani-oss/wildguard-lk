// Test-only source inventory. Reads declared JavaScript and package metadata only.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const apps = ['backend', 'web', 'mobile', 'sensor-dashboard'];
const relative = file => path.relative(root, file).replace(/\\/g, '/');
function sources(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sources(file) : /\.(?:[cm]?js|jsx|tsx?)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name) ? [file] : [];
  });
}
function buildManifest() {
  const audit = fs.readFileSync(path.join(root, 'docs/testing-and-refactoring/PHASE_4_COVERAGE.md'), 'utf8');
  const exclusions = [...audit.matchAll(/^\| ((?:backend|web|mobile)\/src\/[^|]+) \| Empty\/whitespace-only scaffold;/gm)].map(match => match[1]);
  if (exclusions.length !== 38 || new Set(exclusions).size !== 38) throw new Error('Expected the 38 approved empty-scaffold exclusions');
  for (const file of exclusions) if (fs.readFileSync(path.join(root, file), 'utf8').trim()) throw new Error(`Excluded scaffold is now implemented: ${file}`);
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  const manifest = { generatedAt: new Date().toISOString(), applications: {}, shared: [], excluded: exclusions.sort(), hashes: {} };
  for (const app of apps) {
    let files = sources(path.join(root, app, 'src')).map(relative);
    if (app === 'mobile') files.push('mobile/App.js', 'mobile/index.js');
    manifest.applications[app] = files.filter(file => !exclusions.includes(file)).sort();
  }
  manifest.shared = sources(path.join(root, 'shared')).map(relative).sort();
  for (const file of [...Object.values(manifest.applications).flat(), ...manifest.shared]) manifest.hashes[file] = hash(file);
  return manifest;
}
function jestScope(app) {
  if (path.resolve(process.cwd()) !== root) throw new Error('Run coverage from the repository root so Babel instruments shared files outside the application directory');
  const manifest = buildManifest();
  return [...manifest.applications[app], ...manifest.shared].map(file => path.relative(path.join(root, app), path.join(root, file)).replace(/\\/g, '/'));
}
if (require.main === module) {
  const manifest = buildManifest();
  fs.mkdirSync(path.join(root, 'coverage'), { recursive: true });
  fs.writeFileSync(path.join(root, 'coverage/source-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ files: Object.fromEntries(Object.entries(manifest.applications).map(([app, files]) => [app, files.length])), shared: manifest.shared.length, excluded: manifest.excluded.length }));
}
module.exports = { root, buildManifest, jestScope };
