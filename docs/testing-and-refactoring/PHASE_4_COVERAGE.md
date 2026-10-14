# Phase 4 — Coverage readiness and diagnostics

**Current result: Checkpoint C complete.** All four applications and shared now have validated HTML coverage reports. The approved exact provider4.1.11 is installed; web404/38 and sensor30/3 passed their full coverage runs. Backend/mobile/shared reports from CheckpointB are preserved byte-for-byte. Historical audits and earlier results below remain intact; CheckpointC evidence is appended at the end.

## Checkpoint A: audit and plan only — 14 October 2026

**Status:** ready to implement diagnostic corrections after approval; Jest coverage dependencies are available; Vitest coverage requires an approved dependency addition. No coverage percentage has been measured here. No tests, application source, runner configurations, scripts, dependencies or lockfiles were changed. No tests or coverage commands were executed during this checkpoint. This document is the only file created.

Repository root: `C:\Users\Lihini\Desktop\WildGuard LK\wildguard-lk`. The latest verified baseline remains Phase3 Batch5: backend1047/58 suites, web404/38 files, mobile632/53 suites, sensor30/3 files; total2113 passing tests. These are prior execution results, not a fresh CheckpointA run or coverage measurements.

Audit evidence: current runner/package/source files, installed package manifests and installed Jest/Vitest coverage implementation; `.cache/batch5-web-full.log`, `.cache/batch5-*-full.json`, `.cache/batch5-verification.json`; and the Phase3 inventory. Existing older `backend/coverage` and `mobile/coverage` artifacts were observed by filename/timestamp only. They are stale, mixed historical outputs, not evidence for current coverage. They were not regenerated, deleted or used to infer percentages.

## Web diagnostic root causes

The final full Batch5 web log contains27 React warnings, distributed across **six assertions in six files**. The counts below were extracted from each `stderr | file > assertion` block and its `An update to ...` lines. Counts depend on React scheduling and are historical evidence, not an expected fixed number to suppress.

| Test file and exact assertion | Observed warnings | Root cause from source inspection | Smallest proposed test-side correction |
|---|---:|---|---|
| `web/tests/foundation/app.test.jsx:129` — `unknown page remains a 404` | 1 ZoneAlertProvider | Synchronous404 assertion mounts the real provider. Its initial `Promise.all(getAllAnimals(), getAllRiskZones())` resolves mocked data and invokes `setAlerts` after the render's synchronous act scope. The effect also owns a5000ms interval. | Make the test async; settle provider initialization within awaited async `act`, retaining the404 heading assertion and real provider. Verify expected mocked calls. Unmount within the test/RTL cleanup after settlement; do not replace a valid provider globally. |
| `web/tests/integration/patrolList.test.jsx:170` — `shows a loading state while the list request is pending` | 1 PatrolManagement | The test keeps `listPatrols` permanently pending but `listAssignableRangers` resolves immediately and calls `setRangers` outside an awaited scope. The loading UI appears before the list's200ms debounce actually invokes the mocked request. | Retain loading/no-table assertions. Control the list Promise and use local fake timers with async `act` to settle ranger options and advance the200ms debounce. Assert the list request actually started while its controlled Promise remains pending. Unmount before restoring timers; settle any deferred work inside `act` if needed. Do not resolve the list merely to remove loading. |
| `web/tests/foundation/conservationReports.test.jsx:67` — `[B3-RUI-15] CSV exports the preview filters even after unsent form edits` | 1 ConservationReports | After synchronous `fireEvent.click`, `download()` awaits a mocked adapter (reset mock currently returns undefined) and then executes `finally { setDownloading("") }` in a later microtask. The test only asserts the call arguments and returns. | Explicitly resolve the download mock and await the click/completion in async `act`, or use an awaited user interaction plus a `waitFor` assertion on the re-enabled download button. Preserve exact preview-filter arguments despite unsent edits. Prefer verifying completion rather than merely flushing arbitrary microtasks. |
| `web/tests/foundation/landing.test.jsx:105` — `authenticated users keep the existing protected navigation` | 2 FieldMap plus one error log | This synchronous navigation assertion mounts the real FieldMap but mocks only the general `services/api` module. Sensor/risk modules each create independent Axios instances. Their rejected request triggers `setError` and `setLoading(false)` after the synchronous assertion. | Mock the two FieldMap adapters explicitly with valid envelope fixtures; make the assertion async and await map loading completion inside `act`/RTL waits. Preserve the authenticated Field Map heading and absence of registration heading. Also assert adapter calls and absence of load-error UI. |
| `web/tests/integration/liveMonitoring.test.jsx:161` — `polls for updates on an interval and stops after leaving the page` | 9 RangerMonitoring +1 Leaflet MapContainer | All three `vi.advanceTimersByTimeAsync(0/7000/21000)` calls run outside React `act`. Promise completions perform multiple state writes; mounting real react-leaflet also schedules a MapContainer update. | Import `act`; wrap each awaited timer advancement in `await act(async () => ...)`. Assert initial data/GPS UI and unchanged1/2/2 request counts. Unmount before the post-unmount21000ms advance, then restore real timers in finally. Preserve actual Leaflet behavior already asserted elsewhere; no global map replacement or warning suppression. |
| `web/tests/integration/rangerTracking.test.jsx:102` — `polls recorded positions while in progress and stops on unmount` | 11 RangerTrack +1 Leaflet MapContainer | Same timer/act issue, with two dependent effects: the patrol Promise resolves, then the history effect loads trail and schedules polling. The test checks request counts before fully observing UI settlement. | Await initial patrol/history settlement and timer advances inside async `act`. Keep1/2/2 history call counts and post-unmount cleanup assertion; add/retain a visible recorded-history assertion. Unmount before remaining fake-time advancement and restore timers in finally. |
| **Total** | **27** | Missing awaited React update scopes and one incomplete mock | Verify corrections individually, then rerun the full guarded web suite. |

### Blocked Field Map request: exact chain and safety

`landing.test.jsx` imports real `AppRoutes`; the authenticated `/map` route renders `FieldMap`. `web/src/pages/FieldMap/FieldMap.jsx:46` calls both `getAnimalsWithLatestLocations()` and `getAllRiskZones()` in `Promise.all`. Each adapter calls its own `axios.create` instance, so the mock of `web/src/services/api` does not intercept either.

- Sensor adapter: `web/src/services/sensorApi.js`, `GET /sensors/animals/locations`.
- Risk-zone adapter: `web/src/services/riskZoneApi.js`, `GET /risk-zones`.
- Both use an API-base setting with a source-code fallback to `http://localhost:5000/api`. No production environment values were inspected.
- `web/tests/setup.js` installs `test-support/network-isolation.cjs` before test execution. XHR `send` and network transports throw `TEST_NETWORK_BLOCKED`. The saved console stack identifies the sensor adapter; the source starts both independent adapters, and the single `Promise.all` catch logs the first rejection once.

There is an unexpected **attempt to use real adapter transport** in this test, but no evidence of a successful real request. The guard rejects before dispatch; do not relax it, allow localhost5000 or start a server. Source inspection/logs are not a packet capture, so this conclusion concerns the guarded API path actually observed. Use fixtures of shape `{ data: [] }` for these adapter functions: they return `response.data`, and FieldMap expects their result to contain `.data`. A plain array mock would create a new malformed-response error.

These warnings alone do not demonstrate a production defect or failed cleanup. Provider/patrol/monitoring effects already invalidate pending work and clear their owned timer on cleanup. The saved polling tests pass their post-unmount call-count checks. FieldMap itself lacks a pending-request unmount guard; that is a separate possible future lifecycle regression to demonstrate before any production change, not the first correction for this synchronous navigation test. No warnings are to be globally silenced, and genuine error-case diagnostics must remain observable/asserted.

## Installed tooling and discovery audit

| Application | Current installed tooling | Current guarded discovery/config | Coverage readiness |
|---|---|---|---|
| Backend | Jest30.5.2; babel-jest30.5.2; babel-plugin-istanbul8.0.0; istanbul-lib-coverage3.2.2; istanbul-lib-report3.0.1; istanbul-reports3.2.0; v8-to-istanbul9.3.0 | `backend/jest.config.js`: node environment; isolation resolver and setup; recursively selects nonempty `tests/**/*.test.js`; latest58 suites | Babel/Istanbul and built-in Jest V8 paths available. `istanbul-reports/lib/html/index.js` present. Existing `test:coverage` script uses guarded Jest but scope is incomplete. No dependency installation needed for Jest HTML. |
| Web | Vitest4.1.11, Vite7-compatible setup and React plugin; neither `@vitest/coverage-istanbul` nor `@vitest/coverage-v8` installed | `web/vite.config.js`: jsdom; globals; network/RTL setup; foundation `.test.jsx` plus12 explicitly listed integration files; latest38 files | Vitest default provider is V8, but providers are optional packages and missing. Default reporter names include HTML/JSON; the missing provider prevents treating HTML coverage as ready. |
| Mobile | Jest29.7.0; jest-expo57-compatible preset; babel-jest29.7.0; babel-plugin-istanbul6.1.1; same Istanbul library/report versions above; v8-to-istanbul9.3.0 | `mobile/jest.config.js`: jest-expo; `tests/foundation/**/*.test.js`; isolation setup before native mocks; latest53 suites. Babel uses babel-preset-expo. | Babel/Istanbul and Jest V8 paths available; HTML implementation installed. Babel is preferred for the existing Expo JSX transforms. Root `App.js` and `index.js` need inclusion beyond `src`. |
| Sensor dashboard | No local Vitest/provider package; existing test command reuses web's Vitest4.1.11 and installed web React/testing dependencies | `sensor-dashboard/vitest.config.mjs`: jsdom; CJS network setup plus UI setup; `tests/**/*.test.{js,jsx}`; JSX automatic transform; latest3 files | Reuse the single approved provider installed in web. Preserve explicit sensor project root/aliases and configuration. No independent Vitest or React installation proposed. |
| Shared | Three CommonJS modules: patrolLifecycle, patrolNavigation, riskGeometry; consumed/tested by backend and mobile | Backend shared-specific suites and mobile consumer suites; no separate shared package/runner | Instrument original files, account for each canonical path once. Different Jest/Babel versions require map-compatibility validation before merging. |

Local installed Jest defaults use `coverageProvider: 'babel'` and reporters `json/text/lcov/clover`; HTML reporter availability was checked separately. Do not confuse another Jest config/template's V8 value with the active default. Vitest defaults have `coverage.enabled:false`, provider`v8`, reporters`text/html/clover/json`, and `allowExternal:false`.

The web lockfile mentions coverage providers only as optional peer requirements of Vitest, not installed provider entries. Their physical installed package manifests are absent. Optional peer metadata does not establish availability. Backend/mobile's transitive Istanbul libraries also do not substitute for a matching Vitest provider.

### Proposed provider/dependency decision

Prefer **Babel/Istanbul for backend/mobile and `@vitest/coverage-istanbul@4.1.11` for web/sensor**, matching the installed Vitest exactly. This gives a common Istanbul JSON format while retaining each runner's normal transform pipeline. A matching V8 provider is a valid alternative for web/sensor, but branch locations can differ and cross-runner shared merging still needs validation. Do not install both providers or upgrade Vitest unnecessarily.

CheckpointB approval must explicitly cover the web dev-dependency/package-lock addition. Check installed Vitest remains4.1.11 and confirm matching provider availability before installation; if unavailable, report the issue instead of silently changing versions. Sensor reuses web's provider. Proposed command, **not executed**, cwd`web`:

```powershell
npm install --save-dev --save-exact @vitest/coverage-istanbul@4.1.11
```

Keep any other necessary direct reporting dependency decision reviewable. The initial proposed local renderer can use already installed backend Istanbul libraries via an explicit repository-relative package location; do not rely on undocumented global `nyc` or a root dependency that is absent.

## Source scope and denominator rules

The filesystem audit found the following `.js/.jsx/.ts/.tsx` source-file counts. These are file inventories, not executable-statement counts or coverage denominators. Nonempty modules can contain constants/re-exports and may have different executable metrics.

| Scope | Files found | Genuinely empty source files | Nonempty source files | Proposed raw inclusion |
|---|---:|---:|---:|---|
| Backend `src` | 93 | 16 | 77 | `src/**/*.{js,cjs,mjs,jsx,ts,tsx}` plus`../shared/*.js` |
| Web `src` | 101 | 8 | 93 | `src/**/*.{js,cjs,mjs,jsx,ts,tsx}` |
| Mobile `src` | 131 | 14 | 117 | `src/**/*.{js,cjs,mjs,jsx,ts,tsx}`, root`App.js`, root`index.js`, plus`../shared/*.js` |
| Sensor dashboard `src` | 3 | 0 | 3 | `src/**/*.{js,cjs,mjs,jsx,ts,tsx}` |
| Shared | 3 | 0 | 3 | `shared/*.js`, one canonical final report |

Include implemented controllers, services, validators, repositories, middleware, hooks, UI components/pages/screens, API adapters, storage/synchronization, navigation, utilities and executable constants, including ones untouched by tests. Include `.native.js` and `.web.js` implementations separately: platform-specific untested alternatives must not disappear just because only one platform's module was imported. Include `main.jsx`, `App` and mobile entry registration code; do not exclude bootstrap code merely to improve numbers.

**Backend correction needed in CheckpointB:** existing `collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/config/**']` excludes production environment/Prisma configuration, serialPgClient and server lifecycle code. Replace that coverage-only scope with the approved full source manifest. Report these original files as uncovered if unexecuted; never import/start them to manufacture coverage. The isolation resolver's replacement facades are test infrastructure and do not earn coverage for original production config files. Verify all original source files appear in the final manifest; static instrumentation must not execute dotenv, database constructors, app.listen or provider clients.

Jest's explicit `collectCoverageFrom` must include untouched files. Proposed coverage-only configs retain each application's original root/config/preset and add`../shared` to Jest's `roots` so external shared files can be discovered; validate relative globs/source maps rather than assuming import hits alone include untested shared files. Do not broaden test discovery or drop existing safety setup/resolver while composing these configs.

Vitest4's installed coverage implementation only collects untested files when `coverage.include` is explicit (`getUntestedFiles` returns none if include is null). Specify positive inclusion globs and verify the final source manifest; do not copy obsolete `coverage.all` examples. Sensor globs must resolve from sensor-dashboard, even though its executable is under web. No current web/sensor production imports require shared inclusion; update the manifest if consumers change.

### Justified exclusions

- Dependency/generated/vendor output: `node_modules/**`, generated Prisma client, bundles`dist/**`, `build/**`, `.expo/**`, transpilation caches and coverage outputs. Do not exclude handwritten `src/config` or runtime modules.
- Tests and test-only support: `tests/**`, `test-support/**`, fixtures, mocks under test directories, diagnostic helpers`.cache/**`. A production helper named mock is not excluded by name; only genuinely empty items below qualify here.
- Non-JavaScript executable artifacts: styles, images, fonts, documentation, static HTML shell, `.d.ts` declarations and manifest JSON. Executable code that consumes/manipulates these remains included. JSX UI and executable JavaScript configuration inside `src` remain included.
- Runner/build tooling outside the declared application scope: Jest/Vitest/Vite/Babel/Metro configs, package manifests, lockfiles. Backend Prisma CLI config, migrations and seed/standalone operational scripts are out of runtime application scope and must not run; list them as unmeasured operational tooling, not covered logic.
- Only the exact38 whitespace/empty source scaffolds below, verified by file contents, may be omitted as non-executable. Keep an explicit checked manifest; fail validation if an excluded scaffold becomes implemented. Avoid broad directory exclusions that would also hide adjacent implemented modules.

No implemented source may be excluded because it is hard to mock, low coverage, provider-dependent or not imported. Do not insert Istanbul ignore comments or threshold exceptions to inflate results.

### Measuring and presenting the four metrics

Report **statements, branches, functions and lines separately**, each with covered/total and percentage. Statements measure instrumented executable statements; branches measure each instrumented alternative; functions measure invocation; lines measure covered executable source lines after source-map remapping. A statement hit does not establish both branches were exercised. Annotate empty/no-executable denominators as N/A in the audit summary/manifest; native Istanbul output may use a100% convention for zero totals, which must not be interpreted as evidence of tested functionality.

Project metrics use sums of covered/total counts over unique canonical source files, never an average of application percentages. Preserve raw counters and mappings so totals can be checked. Provider/version/source-map differences can change branch/function denominators; record versions and do not compare incompatible snapshots as an improvement. No90% target, threshold or percentage is assumed. HTML color watermarks are presentation defaults, not pass/fail requirements.

## HTML outputs and shared-source accounting

Proposed browsable native Istanbul HTML reports, rooted at repository`coverage`:

- `coverage/backend/index.html`
- `coverage/web/index.html`
- `coverage/mobile/index.html`
- `coverage/sensor-dashboard/index.html`
- `coverage/shared/index.html` for the three shared source files.
- `coverage/index.html` as a report directory/manifest landing page; optional accurate combined Istanbul report at`coverage/combined/index.html` only after validation.

Each HTML report uses the normal Istanbul folder/file table, four metric columns, source links with hit counts and highlighted uncovered statements/branches. Use real measured results, not screenshot percentages. No reference image was attached to this checkpoint; standard Istanbul HTML provides the requested style without inventing reference content.

Proposed raw outputs: `coverage/.raw/backend`, `coverage/.raw/web`, `coverage/.raw/mobile`, `coverage/.raw/sensor-dashboard`, each containing`coverage-final.json`, `coverage-summary.json` and an execution/source manifest. Render application HTML from **application-owned files only**; raw backend/mobile maps retain shared hits, which are partitioned into the shared report. Thus shared is not counted twice in the final application tables or aggregate. The shared page must identify which runners contributed.

An accurate combined report is feasible **conditionally**:

1. Require every configured safe suite to finish with the expected preserved assertion inventory, exit0 and a newly completed coverage map. Reject truncated output even when its JSON says success, as Batch5 demonstrated.
2. Compare the source manifest to all final included files, including untouched files with zero hits. No silent omissions from root, source-map or module-resolution issues.
3. Canonicalize Windows paths/case/separators to repository-relative original paths and verify source hashes. Only declared repository source enters the map; no dependencies, tests, facades, generated JS or duplicate platform aliases.
4. For repeated shared files, require identical statement/function/branch maps and original source hashes. Sum hits for compatible maps with Istanbul's coverage-map APIs; count each file's denominator once. Never concatenate report totals, average percentages or blindly merge structurally different maps.
5. Backend Babel plugin8 and mobile plugin6/Expo transforms can produce incompatible shared mappings. If incompatible, publish separate runner-attributed shared evidence and withhold an all-runner combined percentage. A backend-owned shared report may be published only with an explicit backend-only label, not presented as including mobile hits. A future common shared instrumentation harness could resolve this after approval; it is not already implemented.
6. Render validated per-app/shared maps through installed `istanbul-lib-report` and`istanbul-reports`; preserve JSON/source manifests and a run timestamp so stale files cannot be mistaken for the current run. Any runner cleanup is restricted to its verified raw-output subdirectory; HTML rendering must not delete the parent coverage directory containing raw evidence or unrelated historical artifacts. Use conservative coverage-processing concurrency as well as test-worker limits.

Do not generate a combined report until these checks pass. Independent per-app reports remain useful even if shared map incompatibility blocks aggregation.

## Checkpoint B plan and exact planned commands

**None of these commands or proposed new configs/helpers has been executed/created in CheckpointA.** Config filenames below are planned coverage-only wrappers that must import/extend current guarded configurations, including test roots/discovery/aliases. They must use Babel/Istanbul as proposed, explicit source manifests and JSON/JSON-summary raw reporters. The planned renderer produces the actual HTML afterward. Plain existing `npm run test:coverage` is insufficient for the corrected denominator/output layout.

Order: approve provider addition; apply only the six diagnostic test-side corrections; run targeted/full guarded web without coverage and retain unsuppressed logs; introduce reviewed coverage-only configs/manifest/renderer; run four applications **sequentially** with conservative workers; validate raw maps and render reports. The previous simultaneous resource-related early exits had no definitive logged cause; sequential execution avoids relying on that incomplete evidence. Preserve expected2113 baseline cases; any added diagnostic assertion cases must be enumerated separately.

Diagnostics, cwd`web`:

```powershell
node node_modules/vitest/vitest.mjs run tests/foundation/app.test.jsx tests/foundation/landing.test.jsx tests/foundation/conservationReports.test.jsx tests/integration/patrolList.test.jsx tests/integration/liveMonitoring.test.jsx tests/integration/rangerTracking.test.jsx --maxWorkers=1 --reporter=default --reporter=json --outputFile=../.cache/phase4-web-diagnostics.json *> ../.cache/phase4-web-diagnostics.log
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --reporter=default --reporter=json --outputFile=../.cache/phase4-web-safe.json *> ../.cache/phase4-web-safe.log
```

After approved configuration/tooling implementation, backend cwd`backend`:

```powershell
node node_modules/jest/bin/jest.js --config=jest.coverage.config.cjs --runInBand --detectOpenHandles --coverage --coverageProvider=babel --json --outputFile=../.cache/phase4-backend-coverage-tests.json *> ../.cache/phase4-backend-coverage.log
```

Web cwd`web`:

```powershell
node node_modules/vitest/vitest.mjs run --config=vitest.coverage.config.mjs --maxWorkers=1 --coverage --coverage.provider=istanbul --reporter=default --reporter=json --outputFile=../.cache/phase4-web-coverage-tests.json *> ../.cache/phase4-web-coverage.log
```

Mobile cwd`mobile`:

```powershell
node node_modules/jest/bin/jest.js --config=jest.coverage.config.cjs --runInBand --detectOpenHandles --coverage --coverageProvider=babel --json --outputFile=../.cache/phase4-mobile-coverage-tests.json *> ../.cache/phase4-mobile-coverage.log
```

Sensor cwd`sensor-dashboard`:

```powershell
node ../web/node_modules/vitest/vitest.mjs run --config=vitest.coverage.config.mjs --maxWorkers=1 --coverage --coverage.provider=istanbul --reporter=default --reporter=json --outputFile=../.cache/phase4-sensor-coverage-tests.json *> ../.cache/phase4-sensor-coverage.log
```

Validation/HTML renderer, cwd repository root, after reviewing the planned implementation:

```powershell
node test-support/render-coverage.cjs --manifest=coverage/source-manifest.json --raw=coverage/.raw --output=coverage
git diff --check
```

The renderer/manifest are future artifacts, not currently available commands to run. It must validate inventories/maps before writing HTML and must not require importing application modules. Run manifests must contain exact versions, source hashes, commands, complete assertion results, exclusions/reasons and elapsed times. No global CLI or inferred90% threshold is required. Existing root`.gitignore` already ignores coverage and`.cache`; preserve evidence locally and share/export only intentionally.

## Risks, decisions and stop point

- **Approval needed:** install only the matching web Istanbul provider and approve its package/lockfile diff; approve diagnostic test fixes and coverage-only config/source-manifest/renderer additions. An approval to audit is not an approval to perform them.
- **Source accuracy:** resolver facades, manual mocks, untouched files, root entry files, platform alternatives and external shared roots can otherwise produce falsely high reports. Verify original-file inventory, source hashes, source maps and zero-hit rows before trusting percentages.
- **Shared compatibility:** matching Istanbul JSON format does not guarantee compatible branch/function maps. Withhold combined percentages if maps cannot safely merge.
- **Resource/environment reliability:** coverage adds runtime/memory overhead. Use sequential runs, one worker, complete inventory/exit-code validation. Windows Node realpath EPERM in the managed sandbox previously required ordinary-user execution outside that sandbox; this is not administrator access. Do not delete unrelated caches/files or weaken guards to bypass it. No EPERM reproduction or environment changes were attempted here.
- **Diagnostics:** recommended root causes are source/log-supported; corrections are proposals, not verified fixes. Preserve assertions, observe completion/cleanup and retain logs in CheckpointB. Do not clear an interval or resolve a Promise in a way that avoids exercising the behavior under test.
- **Safety:** keep backend isolation resolver/setup and frontend/mobile/sensor network guards. No development server, real PostgreSQL, Neon, provider, migration, seed, reset, unsafe standalone script, `.env` file read/change or Git mutation. Coverage instrumentation may parse declared JavaScript; it must not execute untested startup/config/provider code to obtain hits.
- **Prior unresolved policies:** sensor/risk authorization, out-of-order telemetry, density meaning and transactional deletion remain as documented in Phase3. Coverage reporting is not authorization to change them. Real hardware/native/browser/provider/PostgreSQL behavior remains unverified by isolated mocks.
- **Unmeasured tooling:** scripts/migrations/build config outside runtime application scope are explicitly not covered by these application percentages. JavaScript constants can have executable statements; their source inclusion is retained rather than categorically discarded.

**CheckpointA stops here.** No diagnostic fix, dependency installation, runner configuration change, coverage report generation, SOLID analysis or refactoring has begun. Await approval for CheckpointB.

## Exact empty-scaffold exclusion inventory

These were checked for empty/whitespace-only contents during CheckpointA. Exclusion is conditional on remaining empty; future implemented contents must be included automatically or cause manifest validation to fail.

| File | Reason |
|---|---|
| backend/src/routes/cameraTrap.routes.js | Empty/whitespace-only scaffold; no implemented executable content |
| backend/src/routes/animal.routes.js | Empty/whitespace-only scaffold; no implemented executable content |
| backend/src/utils/response.js | Empty/whitespace-only scaffold; no implemented executable content |
| backend/src/utils/logger.js | Empty/whitespace-only scaffold; no implemented executable content |
| backend/src/utils/geoUtils.js | Empty/whitespace-only scaffold; no implemented executable content |
| backend/src/services/sync.service.js | Empty/whitespace-only scaffold; no implemented executable content |
| backend/src/middleware/validation.middleware.js | Empty/whitespace-only scaffold; no implemented executable content |
| backend/src/services/cameraTrap.service.js | Empty/whitespace-only scaffold; no implemented executable content |
| backend/src/services/animal.service.js | Empty/whitespace-only scaffold; no implemented executable content |
| backend/src/controllers/cameraTrap.controller.js | Empty/whitespace-only scaffold; no implemented executable content |
| backend/src/controllers/animal.controller.js | Empty/whitespace-only scaffold; no implemented executable content |
| backend/src/mocks/collar.mock.js | Empty/whitespace-only scaffold; no implemented executable content |
| backend/src/mocks/cameraTrap.mock.js | Empty/whitespace-only scaffold; no implemented executable content |
| backend/src/mocks/sensorData.mock.js | Empty/whitespace-only scaffold; no implemented executable content |
| backend/src/repositories/cameraTrap.repository.js | Empty/whitespace-only scaffold; no implemented executable content |
| backend/src/repositories/animal.repository.js | Empty/whitespace-only scaffold; no implemented executable content |
| web/src/services/animalApi.js | Empty/whitespace-only scaffold; no implemented executable content |
| web/src/services/alertApi.js | Empty/whitespace-only scaffold; no implemented executable content |
| web/src/components/DataTable/DataTable.jsx | Empty/whitespace-only scaffold; no implemented executable content |
| web/src/components/Map/Map.jsx | Empty/whitespace-only scaffold; no implemented executable content |
| web/src/pages/RiskZones/RiskZones.jsx | Empty/whitespace-only scaffold; no implemented executable content |
| web/src/components/AlertCard/AlertCard.jsx | Empty/whitespace-only scaffold; no implemented executable content |
| web/src/pages/CameraTraps/CameraTraps.jsx | Empty/whitespace-only scaffold; no implemented executable content |
| web/src/pages/Alerts/Alerts.jsx | Empty/whitespace-only scaffold; no implemented executable content |
| mobile/src/hooks/useSync.js | Empty/whitespace-only scaffold; no implemented executable content |
| mobile/src/hooks/useNetworkStatus.js | Empty/whitespace-only scaffold; no implemented executable content |
| mobile/src/hooks/useLocation.js | Empty/whitespace-only scaffold; no implemented executable content |
| mobile/src/storage/pendingPatrolData.js | Empty/whitespace-only scaffold; no implemented executable content |
| mobile/src/storage/pendingIncidents.js | Empty/whitespace-only scaffold; no implemented executable content |
| mobile/src/storage/syncQueue.js | Empty/whitespace-only scaffold; no implemented executable content |
| mobile/src/components/OfflineBanner.js | Empty/whitespace-only scaffold; no implemented executable content |
| mobile/src/screens/patrol/CompletePatrolScreen.js | Empty/whitespace-only scaffold; no implemented executable content |
| mobile/src/screens/patrol/AssignedPatrolScreen.js | Empty/whitespace-only scaffold; no implemented executable content |
| mobile/src/screens/patrol/ActivePatrolScreen.js | Empty/whitespace-only scaffold; no implemented executable content |
| mobile/src/screens/incident/ReviewIncidentScreen.js | Empty/whitespace-only scaffold; no implemented executable content |
| mobile/src/screens/incident/IncidentConfirmationScreen.js | Empty/whitespace-only scaffold; no implemented executable content |
| mobile/src/screens/incident/EvidenceScreen.js | Empty/whitespace-only scaffold; no implemented executable content |
| mobile/src/screens/community/CommunityEvidenceScreen.js | Empty/whitespace-only scaffold; no implemented executable content |

## Checkpoint B verified results — 14 October 2026

### Diagnostic corrections and before/after evidence

Implemented the six test-side corrections described in CheckpointA. Existing assertion names/counts and meaningful assertions are retained; added completion/API/pending-request/UI assertions inside those existing cases. No production functionality or shared source changed; no new test cases, test suppression or global console spies were introduced.

- `app.test.jsx`: awaited the real ZoneAlertProvider initial effect in async act;404 assertion preserved; both expected adapter calls checked.
- `patrolList.test.jsx`: controlled pending list Promise,200ms fake-clock debounce and awaited ranger-option updates in act. Assert the request actually started while loading/no-table remained. Unmount then settle pending Promise inside act before restoring timers.
- `conservationReports.test.jsx`: explicit resolved download mock and async act around CSV completion; exact saved-preview arguments preserved; download button re-enabled afterward.
- `landing.test.jsx`: explicit mocks of sensor and risk adapters with `{data:[]}` envelopes; await real FieldMap mount/effect completion. Preserve authenticated headings/navigation checks and assert both API calls, no loading and no error UI.
- `liveMonitoring.test.jsx` and `rangerTracking.test.jsx`: timer advancement inside awaited async act; retain1/2/2 request counts and post-unmount21000ms assertion. Assert initial Ranger/history UI; no Leaflet behavior replaced.

| Evidence | Passed | Suites/files | React act warnings | Unexpected FieldMap blocked-transport error |
|---|---:|---:|---:|---:|
| Prior Batch5 full web `.cache/batch5-web-full.{json,log}` | 404 | 38 | 27 | 1 |
| Affected six-file `.cache/phase4-web-diagnostics.{json,log}` | 93 | 6 | **0** | **0** |
| Final complete web `.cache/phase4-web-safe.{json,log}` | 404 | 38 | **0** | **0** |

The network guard is unchanged and still tested. Expected denial assertions in isolation tests remain active; zero unexpected diagnostics does not mean transport is permitted. No real FieldMap adapter request dispatch was enabled.

### Complete final safe-suite results

| Application | Passed | Suites/files | Failed | Skipped/pending | Todo | Coverage execution | Open handles |
|---|---:|---:|---:|---:|---:|---|---|
| Backend | **1047** | **58** | 0 | 0 | 0 | Babel coverage enabled | **0**, Jest detectOpenHandles |
| Web | **404** | **38** | 0 | 0 | 0 | Safe suite without missing provider | Vitest has no equivalent Jest handle array; normal exit |
| Mobile | **632** | **53** | 0 | 0 | 0 | Babel coverage enabled | **0**, Jest detectOpenHandles |
| Sensor dashboard | **30** | **3** | 0 | 0 | 0 | Safe suite without missing provider | Vitest has no equivalent Jest handle array; normal exit |
| Total | **2113** | **152** | **0** | **0** | **0** | Two applications measured | — |

Every final command exited0. `.cache/phase4-verify.cjs` matches all passed assertion names against the four Batch5 full JSON files and confirms identical counts. Only the pre-existing backend evidence title's runtime withdrawnAt value is normalized. No configured test remains unable to execute in the final runs. Empty test scaffolds and unsafe operational scripts remain outside guarded discovery.

No final React act warning, unexpected blocked-transport diagnostic, unhandled rejection or unexpected console error was found. Mobile retains **one Node SQLite ExperimentalWarning**, unsuppressed, from the approved isolated native SQLite fixture. Expected structured fixture diagnostics remain observable. `git diff --check` passes; Git separately emits existing LF/CRLF notices for older modified files, not test failures.

### Actual coverage percentages and denominators

Application reports contain application-owned files only. Raw backend/mobile maps each include shared; shared is partitioned out and merged once after exact statement/function/branch-map compatibility checks. No average of application percentages or project-wide combined percentage was generated.

| Report | Included source files | Statements | Branches | Functions | Lines |
|---|---:|---|---|---|---|
| **Backend** | **77** (raw80 including shared) | **91.06%** —3202/3516 | **84.07%** —2502/2976 | **92.67%** —519/560 | **91.86%** —3003/3269 |
| **Mobile** | **119** (raw122 including shared) | **82.90%** —3546/4277 | **76.90%** —3709/4823 | **79.60%** —843/1059 | **87.36%** —3161/3618 |
| **Shared**, compatible backend+mobile maps merged once | **3** | **97.60%** —204/209 | **92.19%** —189/205 | **100.00%** —52/52 | **98.21%** —165/168 |
| Web | **Not measured**; approved inventory93 nonempty files | Not measured | Not measured | Not measured | Not measured |
| Sensor dashboard | **Not measured**; approved inventory3 files | Not measured | Not measured | Not measured | Not measured |

These are actual Istanbul hit counters from complete executed suites, with zero-hit untouched files statically instrumented by Jest. They are not inferred from passing test counts. Native Istanbul reports retain their zero-total metric convention; the landing page identifies zero totals as N/A. Coverage is not evidence of real provider/database/native-device correctness.

Providers: backend Jest30.5.2/babel-jest30.5.2 with babel-plugin-istanbul8.0.0; mobile Jest29.7.0/babel-jest29.7.0 with plugin6.1.1 and unchanged Expo Babel preset. Rendering uses installed istanbul-lib-coverage3.2.2, istanbul-lib-report3.0.1 and istanbul-reports3.2.0. Despite plugin-version differences, all three original shared maps were structurally identical, so merged hits preserve each denominator once.

### Scope, HTML verification and privacy

`coverage/source-manifest.json` inventories all approved nonempty source files and hashes;38 exact empty scaffolds remain excluded with a fail-fast check if any becomes implemented. New coverage-only configs extend existing guarded runner configs and use exact positive source lists, including backend configuration/server, mobileApp/index, both platform alternatives and shared. Existing normal Jest configurations and all database/network guard files are unchanged.

The renderer rejects unexpected/missing/duplicate files, stale raw maps, changed source hashes or incomplete/regressed test inventories. Backend raw80 and mobile raw122 exactly match expected original sources. It generates native Istanbul directory/file tables, four metrics and source pages with uncovered lines. Verification checked **1350 local HTML links** and found **114 source pages containing uncovered-statement highlights**. File-by-file counters remain in each report's`coverage-final.json` and`coverage-summary.json`.

Reports contain declared original JavaScript and coverage counters, not `.env` contents, runtime database records, provider payloads or user/device data. Source retrieval is restricted to manifest paths; untested bootstrap/config is parsed without importing/executing it. A conservative literal-credential check runs before HTML rendering; public password prompts and reviewed validation-error assignments are classified explicitly as public UI diagnostics, not secret values. That heuristic supplements source/path restrictions and is not claimed as a comprehensive secret scanner. No secret values were displayed. No production `.env` file or provider/database data was loaded.

Browsable output paths, relative to repository root:

- **`coverage/backend/index.html`** — native Istanbul backend report.
- **`coverage/mobile/index.html`** — native Istanbul mobile report.
- **`coverage/shared/index.html`** — backend/mobile shared hits merged once.
- **`coverage/index.html`** — links, measured summaries and explicit unmeasured applications.
- `coverage/verification.json` — metrics/counts/zero-hit files/map compatibility/provider versions.
- `coverage/source-manifest.json` — approved original-source inventory, hashes and exclusions.
- `coverage/.raw/backend/{coverage-final.json,coverage-summary.json}` and equivalent mobile files — fresh runner output.
- **No** `coverage/web/index.html` or`coverage/sensor-dashboard/index.html` was generated; no percentage is claimed for either. No`coverage/combined/index.html` or whole-project percentage was generated.

Existing older application-local coverage folders remain untouched and must not be confused with these new repository-root reports. No recursive delete, cache reset or unrelated file cleanup was used.

### Coverage execution corrections and retained unsuccessful evidence

1. **External shared root:** the first backend run from cwd`backend` passed1047 tests but produced only77 raw files. Merely adding shared to Jest roots and collectCoverageFrom was insufficient: installed Babel-Jest explicitly sets Istanbul's cwd boundary from the process cwd, excluding shared outside the app directory. Run coverage from the repository root instead while preserving per-app rootDir, transforms, preset, resolver and test discovery. `jestScope` now fails fast if invoked from an app directory. Final raw maps have80/122 files and all3 shared modules; no omission is accepted.
2. **Cold mobile instrumentation timeout:** the initial mobile coverage run was631 passed/1 failed across53 suites. Exact case: `Task 9: Community Safety & Wildlife Alerts > AlertsScreen loads active alerts, displays unread notice banner, and navigates to details`, exceeded Jest's normal5000ms wall-clock budget during a slow cold coverage run. The new **coverage-only** mobile config allows15000ms. Normal Jest still uses its original budget, and functional waitFor limits, fake clocks, assertions and navigation expectations are unchanged. Final root invocation passes all632. No production fix or test-case deletion was made.
3. **Renderer privacy-check false positives:** initial render attempts flagged public password-validation strings in backend auth validation, mobile LoginScreen and mobile registration validation. Reviewed their role without displaying credential candidates, then narrowed recognition to the verified public prompts/validation owners. HTML generation succeeded; no environment file was used to resolve these checks.

Retain `.cache/phase4-backend-coverage-tests-first.json`, `phase4-backend-coverage-first.log`, `phase4-backend-raw-first.json`; corresponding mobile-first artifacts include the actual timeout and incomplete shared scope. These unsuccessful/incomplete attempts are not final coverage evidence.

### Missing dependency — approval still required

Rechecked installed Vitest: **4.1.11**. Both `web/node_modules/@vitest/coverage-istanbul/package.json` and`@vitest/coverage-v8/package.json` are absent. Sensor reuses web's executable. In accordance with the user's explicit instruction, stopped coverage setup for **web and sensor**; did not create their coverage configs, invoke coverage auto-install prompts or change packages/lockfiles. Their full safe suites still ran successfully.

Required package/version and proposed installation command, cwd`web`, **NOT executed**:

```powershell
npm install --save-dev --save-exact @vitest/coverage-istanbul@4.1.11
```

Approval must cover this dependency/lockfile change, followed by web/sensor coverage configuration and measurement in a later authorized step. No separate sensor install or Vitest upgrade is needed. Match/recheck the installed Vitest version at installation time rather than assuming it cannot change.

### Exact executed commands

All commands used the ordinary user account; Node commands ran outside the managed sandbox due the previously diagnosed Windows realpath EPERM. No administrator access, package installation or weakened isolation was required.

Affected web diagnostics and final complete web, cwd`web`:

```powershell
node node_modules/vitest/vitest.mjs run tests/foundation/app.test.jsx tests/foundation/landing.test.jsx tests/foundation/conservationReports.test.jsx tests/integration/patrolList.test.jsx tests/integration/liveMonitoring.test.jsx tests/integration/rangerTracking.test.jsx --maxWorkers=1 --reporter=default --reporter=json --outputFile=../.cache/phase4-web-diagnostics.json *> ../.cache/phase4-web-diagnostics.log
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --reporter=default --reporter=json --outputFile=../.cache/phase4-web-safe.json *> ../.cache/phase4-web-safe.log
```

Manifest and final coverage commands, **cwd repository root**:

```powershell
node test-support/coverage-scope.cjs
node backend/node_modules/jest/bin/jest.js --config=backend/jest.coverage.config.cjs --runInBand --detectOpenHandles --coverage --coverageProvider=babel --json --outputFile=.cache/phase4-backend-coverage-tests.json *> .cache/phase4-backend-coverage.log
node mobile/node_modules/jest/bin/jest.js --config=mobile/jest.coverage.config.cjs --runInBand --detectOpenHandles --coverage --coverageProvider=babel --json --outputFile=.cache/phase4-mobile-coverage-tests.json *> .cache/phase4-mobile-coverage.log
node test-support/render-coverage.cjs --manifest=coverage/source-manifest.json --raw=coverage/.raw --output=coverage *> .cache/phase4-render.log
node .cache/phase4-verify.cjs
git diff --check
```

Full sensor without coverage, cwd`sensor-dashboard`:

```powershell
node ../web/node_modules/vitest/vitest.mjs run --config vitest.config.mjs --maxWorkers=1 --reporter=default --reporter=json --outputFile=../.cache/phase4-sensor-safe.json *> ../.cache/phase4-sensor-safe.log
```

The first backend/mobile coverage commands used the equivalent app-local executable/config/output paths from their app cwd, before the cwd fail-fast correction and mobile coverage-only timeout setting. Their evidence was copied to the`-first` artifacts above before final root reruns. Effective configuration inspection, cwd`backend`, before adding the cwd guard:

```powershell
node node_modules/jest/bin/jest.js --config=jest.coverage.config.cjs --showConfig *> ../.cache/phase4-backend-effective-config.json
```

Applications were verified sequentially; no simultaneous four-runner execution. HTML validation and documentation helpers run independently and never import production modules. Final evidence includes `.cache/phase4-web-diagnostics.{json,log}`, `phase4-web-safe.{json,log}`, `phase4-backend-coverage-tests.json`/`phase4-backend-coverage.log`, equivalent mobile files, `phase4-sensor-safe.{json,log}`, `phase4-render.log`, `phase4-verification.json` and the root coverage manifest/maps/reports. Web/sensor coverage commands from the historical plan **could not be executed** because the provider is absent; they were not attempted and no zero/estimated percentages substituted.

### Remaining uncovered critical paths and recommendations

- Backend server startup/shutdown and production environment/database initialization have **zero statement hits**. They remain in the denominator. Future tests must mock bootstrap/config/provider boundaries safely; never start a real database-backed server to increase these numbers.
- Backend branches remain partially untested in community-report repository(**57.97%**), evidence storage(**66.66%**), alert repository(**67.39%**) and export utility(**70.45%**). These figures identify file-level gaps; HTML branch/line locations show exact uncovered alternatives. Do not infer which policy branch is missing from percentages alone.
- Mobile has zero statement hits in `index.js`, OfflineMapControls, OfflinePatrolMap, PatrolMapSurface.web, useDemoAuth, useOfflinePatrolMap, usePatrolClock, PlaceholderScreen, offlineMaps.web and parkApi. Implemented web/native alternatives were retained. Low navigation/offline-map branch coverage should inform a later proposed test plan, not exclusions or fixes during this checkpoint.
- Shared merged coverage still has3 uncovered lines and16 uncovered branch alternatives. No coverage-driven expansion was performed here.
- Web/sensor coverage and critical-path measurement remain unknown until the matching provider install/configuration is approved. Their passing counts cannot substitute for line/branch coverage.
- Preserve earlier unresolved sensor/risk access, telemetry order, density and transaction/retention decisions. Measured coverage does not authorize changing these policies, and mocks do not validate real PostgreSQL/hardware/provider behavior.

### Files changed in Checkpoint B

1. `web/tests/foundation/app.test.jsx`
2. `web/tests/foundation/landing.test.jsx`
3. `web/tests/foundation/conservationReports.test.jsx`
4. `web/tests/integration/patrolList.test.jsx`
5. `web/tests/integration/liveMonitoring.test.jsx`
6. `web/tests/integration/rangerTracking.test.jsx`
7. `backend/jest.coverage.config.cjs` — new coverage-only wrapper.
8. `mobile/jest.coverage.config.cjs` — new coverage-only wrapper.
9. `test-support/coverage-scope.cjs` — new source/exclusion/hash manifest helper.
10. `test-support/render-coverage.cjs` — new validation/partition/HTML renderer.
11. `docs/testing-and-refactoring/PHASE_4_COVERAGE.md` — results appended; historical audit preserved.

Generated reports/maps are under ignored root`coverage`; diagnostics/verification helper and assembly text are under ignored`.cache`. Existing modifications from earlier phases are retained and not attributed to this checkpoint. No production source, normal runner config, isolation guard, package manifest, lockfile or production environment file was modified here. No commit/push/merge/branch switch, migration, seed, reset, unsafe script or real provider/Neon connection occurred.

**Stop:** CheckpointB work supported by installed tooling is complete; web/sensor coverage awaits the explicit dependency approval above. Do not begin coverage-driven test expansion or SOLID analysis/refactoring.

## Checkpoint C — verified web and sensor coverage

### Approved dependency installation

Before installation, installed Vitest was4.1.11. `npm view @vitest/coverage-istanbul@4.1.11 version peerDependencies engines --json` confirmed provider4.1.11 requires the exact Vitest peer4.1.11. Installation used the user's approved `npm install --save-dev --save-exact @vitest/coverage-istanbul@4.1.11` from `web` and exited0 without dependency conflicts or force options.

`web/package.json` adds only that exact devDependency; `web/package-lock.json` adds11 provider/transitive development package entries. Comparing the pre-install package/lock snapshots proves **zero existing package-version changes, zero removed package entries and identical production dependencies**. Sensor reuses the web-installed provider; no sensor dependency installation, unrelated upgrade or backend/mobile dependency change occurred.

Added lock entries: @vitest/coverage-istanbul, @istanbuljs/schema, istanbul-lib-coverage, istanbul-lib-report, istanbul-reports, magicast, html-escaper, make-dir, its nested semver, supports-color and has-flag. npm reported3 vulnerability notices (1 moderate,1 high,1 critical) during the existing dependency audit. No `npm audit fix`, force install or unrelated remediation was run; these notices are not attributed to the new provider without a before/after advisory analysis.

### Scope, configuration and preservation

New `web/vitest.coverage.config.mjs` extends the existing web config, retaining mode=test environment loading protection, React transform, jsdom, test discovery and network setup. New sensor coverage config extends its existing config, retaining JSX transform, aliases, discovery and both isolation/UI setup files. Both use the same approved source manifest, provider`istanbul`, exact positive production-file lists, processingConcurrency1 and raw JSON/JSON-summary reporters. Source scope is **93 web files** and **3 sensor files**. Only the8 documented empty web scaffolds are excluded from web production source; sensor has no empty scaffold exclusions. Untested implemented modules and entrypoints are retained.

The first web launch stopped before executing tests because Vite bundled the CommonJS inventory helper and raised `Dynamic require of node:fs is not supported`. Both coverage wrappers now use native `createRequire(import.meta.url)` for that helper. Scope and isolation were unchanged; the initial startup log is retained as `.cache/phase4c-web-startup-first.log`. This was a configuration-loading correction, not an application defect or test failure.

The renderer adds `--apps=web,sensor-dashboard` incremental rendering. It validates fresh full-suite results, source hashes and exact original-file inventory, renders only those new application reports, and updates the root navigation/verification metadata. Existing backend/mobile/shared directories are not rendered again. Hash verification confirms **all259 existing report files remain byte-for-byte unchanged**, including their counters, summaries, HTML, source pages and assets. The shared source manifest and all production/shared source are unchanged. No backend/mobile rerun was needed: their source and relevant dependencies were not modified. Their metrics below are retained verified CheckpointB evidence, not newly executed CheckpointC tests.

### Test execution and diagnostics

| Application | Passed | Files | Failed | Skipped/pending | Todo | Coverage provider |
|---|---:|---:|---:|---:|---:|---|
| Web, full CheckpointC run | **404** | **38** | **0** | **0** | **0** | @vitest/coverage-istanbul4.1.11 |
| Sensor dashboard, full CheckpointC run | **30** | **3** | **0** | **0** | **0** | Same provider via web |

Both final commands exited0; all434 prior assertion names match the Batch5 baseline. There are **zero React act warnings, unexpected blocked transport diagnostics, unhandled-rejection or unexpected console-error diagnostics** in the final coverage logs. Sensor's expected fixture/code-generation stdout remains observable. No configured test could not execute. Vitest exited normally without a hanging-process/open-handle warning; it provides no Jest-equivalent detected-handle array, so a formal zero-handle count is not claimed. The initial config startup failure and npm audit notices are separately documented above, not hidden.

Latest verified project tests still total2113 (backend1047, mobile632, web404, sensor30). Only web/sensor were rerun in this checkpoint. Backend/mobile's previous zero-handle results and mobile's unsuppressed SQLite experimental warning remain historical CheckpointB evidence.

### Complete measured coverage summary

| Application/scope | Original source files | Statements | Branches | Functions | Lines | Evidence |
|---|---:|---:|---:|---:|---:|---|
| Backend | **77** | **91.06%** | **84.07%** | **92.67%** | **91.86%** | CheckpointB, preserved |
| Web | **93** | **88.64%** | **76.88%** | **84.24%** | **89.94%** | CheckpointC |
| Mobile | **119** | **82.90%** | **76.90%** | **79.60%** | **87.36%** | CheckpointB, preserved |
| Sensor dashboard | **3** | **94.77%** | **94.31%** | **86.27%** | **94.52%** | CheckpointC |
| Shared, counted once | **3** | **97.60%** | **92.19%** | **100.00%** | **98.21%** | CheckpointB compatible merged maps, preserved |

Web counters: statements2397/2704, branches1982/2578, functions711/844, lines2210/2457. Sensor counters: statements145/153, branches83/88, functions44/51, lines138/146. All four metrics are reported separately, from actual Istanbul counters. The295 unique included application/shared files are not counted twice; tests, fixtures, dependencies/generated code and38 documented empty scaffolds do not enter the production reports. No averaged or combined project percentage was generated. Provider-specific zero-denominator conventions are not evidence of tested behavior.

### HTML paths and verification evidence

The root **`coverage/index.html`** now links to:

- `coverage/backend/index.html` — unchanged.
- **`coverage/web/index.html`** — new.
- `coverage/mobile/index.html` — unchanged.
- **`coverage/sensor-dashboard/index.html`** — new.
- `coverage/shared/index.html` — unchanged, merged once from compatible backend/mobile maps.

The new reports use native Istanbul folder/file tables, all four percentages, source hit counts and uncovered-line/branch highlighting. Verification checked **762 new local HTML links** and found **55 new source pages containing uncovered-statement highlights**. Each report includes `coverage-final.json` and `coverage-summary.json`; fresh runner maps are under `coverage/.raw/web` and `coverage/.raw/sensor-dashboard`.

Reports contain only approved original JavaScript and coverage counters. They do not load environment files, production records or provider payloads. The conservative renderer source check identified the web registration `errors.password` public validation message; the reviewed public validation owner was explicitly classified, following the same existing mobile check. No credential candidate value was printed. No production functionality or test assertions were changed to create coverage.

Exact evidence files: `.cache/phase4c-provider-compatibility.json`, `phase4c-install.log`, `phase4c-web-package-before.json`, `phase4c-web-lock-before.json`, `phase4c-preserved-report-hashes.json`, `phase4c-web-startup-first.log`, `phase4c-web-coverage-tests.json`, `phase4c-web-coverage.log`, `phase4c-sensor-coverage-tests.json`, `phase4c-sensor-coverage.log`, `phase4c-render.log`, `phase4c-verification.json`, `phase4c-verify.log`; plus the existing root `coverage/source-manifest.json` and updated `coverage/verification.json`. Verification script `.cache/phase4c-verify.cjs` checks preserved report hashes, dependency changes, assertion names and local links. These artifacts are ignored local evidence, not committed output.

### Exact commands executed

Compatibility/install/web coverage, cwd`web`:

```powershell
npm view @vitest/coverage-istanbul@4.1.11 version peerDependencies engines --json *> ../.cache/phase4c-provider-compatibility.json
npm install --save-dev --save-exact @vitest/coverage-istanbul@4.1.11 *> ../.cache/phase4c-install.log
node node_modules/vitest/vitest.mjs run --config=vitest.coverage.config.mjs --maxWorkers=1 --coverage --coverage.provider=istanbul --reporter=default --reporter=json --outputFile=../.cache/phase4c-web-coverage-tests.json *> ../.cache/phase4c-web-coverage.log
```

The same web coverage command first produced the retained startup failure, then succeeded after native helper loading was corrected. Sensor coverage, cwd`sensor-dashboard`:

```powershell
node ../web/node_modules/vitest/vitest.mjs run --config=vitest.coverage.config.mjs --maxWorkers=1 --coverage --coverage.provider=istanbul --reporter=default --reporter=json --outputFile=../.cache/phase4c-sensor-coverage-tests.json *> ../.cache/phase4c-sensor-coverage.log
```

Rendering/verification, cwd repository root:

```powershell
node test-support/render-coverage.cjs --manifest=coverage/source-manifest.json --raw=coverage/.raw --output=coverage --apps=web,sensor-dashboard *> .cache/phase4c-render.log
node .cache/phase4c-verify.cjs *> .cache/phase4c-verify.log
git diff --check
```

The first frontend render stopped on a public registration validation-message false positive, then succeeded after that explicit classification. Test execution did not need rerunning for renderer-only changes. Node/npm commands used the ordinary user outside the managed Node sandbox, without administrator privileges. npm registry access was limited to the authorized metadata/install operation; application tests retained network isolation. There was no development server, real Neon/PostgreSQL/provider call, migration, seed, reset or unsafe standalone script.

### Remaining critical gaps and stop point

Web main.jsx, StatusBadge, the implemented Placeholder page and the separate Analytics/Analytics.jsx module have zero statement hits and remain included. These are distinct from the tested manager analytics/dashboard modules. Inspect actual source-page branch highlights before proposing future cases for other partial coverage. Sensor main.jsx has zero statement hits; App/API tests do not exercise real browser startup. Sensor retains8 uncovered lines,8 statements,7 functions and5 branch alternatives. Web retains247 uncovered lines,307 statements,133 functions and596 branch alternatives. No coverage-driven test expansion occurred in this checkpoint.

Additional measured web branch gaps include ZoneAlertBanner(**3.84%**), OperationsLayout(**35.00%**), TrendChart(**50.00%**) and Reporting(**55.31%**). These are file-level measurements, not a claim that every specific failure or authorization path is uncovered; source-page highlights identify actual missed alternatives.

Backend/mobile/shared gaps from CheckpointB remain unchanged. Earlier unresolved access-policy, telemetry-ordering, density-semantics and transactional-retention decisions remain unresolved; coverage is not approval to change them. Registry audit notices need separate review rather than automatic package upgrades.

Repository files changed in CheckpointC:

1. `web/package.json` — exact approved development provider.
2. `web/package-lock.json` —11 new development package entries including the provider; existing versions preserved.
3. `web/vitest.coverage.config.mjs` — new coverage-only config.
4. `sensor-dashboard/vitest.coverage.config.mjs` — new coverage-only config.
5. `test-support/render-coverage.cjs` — incremental frontend rendering/root navigation and reviewed public validation classification.
6. `docs/testing-and-refactoring/PHASE_4_COVERAGE.md` — current status and verified results.

No tests, production/shared source, normal runner config, isolation guard, backend/mobile dependencies, sensor package manifest, production `.env` file or branch changed. No commit/push/merge/branch switch occurred. Existing reports are preserved, not silently regenerated. **CheckpointC is complete. Stop for approval before coverage-driven test expansion or SOLID work.**
