# Phase 2B bug fixes

## Checkpoint A: backend

Verified on 13 October 2026 on `quality/testing-refactoring`.
Only Checkpoint A was authorized for this run. Web fixes, mobile warning investigation, coverage configuration, and SOLID refactoring have not started.

Phase 2A's resolver, database blocking modules, environment replacement, network guard, test discovery, and mocked report fixtures are unchanged. No real database connections, migrations, seeds, resets, environment-file changes, commits, pushes, merges, or branch switches were performed. Neither manual database test script was run.

### Before-and-after results

| Run | Suites | Passed tests | Failed tests |
| --- | --- | --- | --- |
| Phase 2A full backend baseline | 42 | 799 | 11 |
| Checkpoint A reproduction: incident API and validator | 2 | 73 | 11 |
| Checkpoint A affected suites after fixes and new regressions | 2 | 96 | 0 |
| Checkpoint A complete safe backend suite | 42 | 822 | 0 |

Twelve regression cases were added. The two outdated status scenarios remain executed as strict success/persistence cases; no scenario was removed or skipped. Existing valid tests continue to run. Targeted and full runs overlap, so their counts must not be added together.

### Classification of every original failure

The names below come from `backend/tests/integration/incident.api.test.js`, except the last row, which comes from `backend/tests/unit/incident/incident.validator.test.js`.

| Failing test | Classification | Before: expected / actual | Root cause and verified correction |
| --- | --- | --- | --- |
| manager reads only; other roles and anonymous sessions are denied | Application bug | Manager edit: 403 / 404 | The general edit route had no Ranger role guard. It reached patrol ownership checks instead of rejecting the role. Added the existing `allowRoles("RANGER")` middleware; the manager edit now returns 403 before resource lookup. Manager reads and the separate manager review operation remain supported. |
| invalid input and mass assignment never write | Application bug | Creation with client status: 400 / 201 | `status` was in the general incident field allowlist. Creation silently accepted it, while editing could persist valid client-supplied statuses. Removed it from creation/edit fields. Invalid client-owned fields return 400 with no write. |
| unsupported status RESPONDING is rejected without writing | Outdated test expectation | 400 / 200 | `RESPONDING` is already in the Prisma IncidentStatus enum and validator, and in reporting UI filters. Rejecting it would change the existing contract. Retained the scenario as a positive test asserting status persistence, Ranger readback, and the exact guarded database update. |
| unsupported status RESOLVED is rejected without writing | Outdated test expectation | 400 / 200 | `RESOLVED` has the same existing schema, validator, and reporting support. Retained the scenario as a strict positive persistence test. |
| unsupported status in review is rejected without writing | Application bug | 400 / 200 | The controller passed status directly to the service without invoking `validateStatus`. It now calls that validator before any incident lookup or write. |
| unsupported status IN_REVIEW is rejected without writing | Application bug | 400 / 200 | Same missing status validation. Unsupported aliases remain rejected. |
| unsupported status [empty string] is rejected without writing | Application bug | 400 / 200 | Same missing validation. Empty status remains rejected. |
| unsupported status PENDING,UNDER_REVIEW is rejected without writing | Application bug | 400 / 200 | Same missing validation. A comma-separated value is not a status and remains rejected. |
| manager status update rejects unknown fields and never writes them | Application bug | 400 / 200 | The controller destructured `status`, silently dropping extra fields instead of validating the request shape. `validateStatus` enforces the exact status-only body. Unknown fields and missing status now return 400 without a write. |
| only approved Park Managers may change incident status | Application bug | Ranger status mutation: 403 / 200 | The shared status route had authentication but no manager role check for review. It now requires approved PARK_MANAGER accounts for status-only requests. Other roles receive 403; anonymous requests still receive 401. |
| rejects client-owned field status | Application bug | Validator throws / no throw on creation | Same erroneous general field allowlist. Creation and editing now reject `status`; manager review continues through the separate status validator. |

Nine failures exposed application defects; two were outdated expectations. No original failure was caused by database mocking, asynchronous timing, or environment/configuration. The Phase 2A report suites and isolation tests pass in the full run.

The actual 200 responses for invalid statuses were observed against deterministic database mocks. A real Prisma enum error could instead have produced a 500; no real database was used to investigate this. Request validation is necessary before persistence in either case.

### Why the production changes are necessary

1. `backend/src/validators/incident.validator.js`: creation and general edits must not accept review status. New incidents still receive server-assigned PENDING status. Review keeps all six existing lifecycle values: PENDING, UNDER_REVIEW, RESPONDING, RESOLVED, VERIFIED, REJECTED.
2. `backend/src/routes/incident.routes.js`: reject non-Ranger general edits and non-manager review requests before entering business logic. The status path also supports an existing `markAsDone` operation, so applying manager middleware to the entire path would break that operation. Dispatch preserves it while protecting status review.
3. `backend/src/controllers/incident.controller.js`: validate review bodies and incident IDs; return structured validation errors for malformed status requests; prevent mixed `markAsDone`/`status` payloads from using the completion branch; set `Cache-Control: no-store` on review responses consistently with the other incident endpoints.

Endpoint URLs, successful status response shape, completion-flag response shape, valid lifecycle vocabulary, incident ownership, evidence handling, withdrawal guards, transaction behavior, and patrol completion behavior remain intact. Existing completion-flag permissions were preserved, not redesigned. The service and repository were not refactored.

### Regression evidence

Added in `backend/tests/integration/incident.api.test.js`:

- Three cases reject valid client-owned statuses (PENDING, UNDER_REVIEW, VERIFIED) on both creation and general edit, assert no database write, and verify the stored status remains PENDING.
- Five cases reject non-string review statuses (null, boolean, number, array, object) before incident lookup or write.
- Two cases reject manager/researcher general edits for both existing and missing IDs before incident lookup or write.
- One case rejects a mixed completion-flag/review-status payload without either database update method being called.
- One compatibility case retains the completion-flag response and exact update payload, without calling the review persistence method.

Also strengthened the existing successful manager-review test with a no-store response assertion. The two corrected lifecycle scenarios assert persisted statuses and authorized Ranger readback, rather than merely accepting a 200 response.

Existing regression scenarios continue to verify wrong-Ranger denial, reassignment, approval checks, invalid input, missing resources, withdrawn records, secure evidence presentation, review after patrol completion, and edit/withdrawal races with patrol completion.

### Commands and local evidence

From the backend directory:

```powershell
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/integration/incident.api.test.js tests/unit/incident/incident.validator.test.js
node node_modules/jest/bin/jest.js --runInBand
```

Both commands use the unchanged Phase 2A guards. Commands were run outside the managed sandbox's known native-path restriction, using the normal user account without administrator privileges.

Ignored root `.cache` evidence files:

- `backend-phase2b-before.json` and `.log`: reproduction of all 11 original failures.
- `backend-phase2b-targeted.json` and `.log`: affected suites after fixes.
- `backend-phase2b-full.json` and `.log`: complete safe backend suite.

`git diff --check` passed. No coverage was measured.

### Files changed in Checkpoint A

- `backend/src/validators/incident.validator.js`
- `backend/src/routes/incident.routes.js`
- `backend/src/controllers/incident.controller.js`
- `backend/tests/integration/incident.api.test.js`
- `docs/testing-and-refactoring/PHASE_2B_BUG_FIXES.md` (new)

These are additional changes on top of the uncommitted Phase 2A files; the Phase 2A files were preserved.

## Checkpoint B: web and mobile

Work was authorized after Checkpoint A. The Checkpoint A backend fixes and all Phase 2A safety files remain unchanged during this checkpoint. Mobile production code was not changed. No coverage configuration or SOLID refactoring was started.

### Before-and-after evidence

| Application/run | Suites/files | Passed tests | Failed tests |
| --- | --- | --- | --- |
| Web: supplied Phase 2A baseline | 27 | 206 | 27 |
| Web: fresh full reproduction before changes | 27 | 208 | 25 |
| Web: affected suites after provider/endpoint fixes | 4 | 50 | 0 |
| Web: final complete safe suite | 27 | 234 | 0 |
| Mobile: full reproduction with open-handle detection | 47 | 529 | 0 |
| Mobile: final complete safe suite with open-handle detection | 47 | 531 | 0 |
| Backend: complete safe regression run | 42 | 822 | 0 |
| Sensor dashboard: isolated test suite | 1 | 3 | 0 |

The two intermittent web failures from the Phase 2A baseline did not recur in the fresh reproduction. They were not deleted or ignored: their tests were made to await initialization and user interactions, and both pass in the final full suite. No assertion was changed to match an incorrect response. There are three new cases: one web endpoint compatibility regression and two mobile delayed-read lifecycle regressions. Targeted runs overlap the full runs.

### Authentication/rendering failures: test composition problem

All 23 failures in `web/tests/foundation/app.test.jsx` had the same actual error: `useZoneAlerts must be used within ZoneAlertProvider`. The test rendered App directly inside MemoryRouter. The real `web/src/main.jsx` wraps App with ZoneAlertProvider; authentication and routing production code was not at fault.

The test now uses that real provider, with explicit empty-data mocks for its animal/risk-zone polling services. Those services create their own Axios clients, so mocking only the shared authentication API was insufficient. The Phase 2A transport guard remains active; no polling requests reach real services. Existing provider cleanup removes its interval when the test tree is unmounted.

Each originally failing case below now passes with its existing meaningful assertions:

| Original failing case | Classification / correction |
| --- | --- |
| login validates required fields and toggles password visibility | Missing provider test setup; render the real application composition |
| invalid credentials remain on login | Same missing provider |
| network failure is recoverable | Same missing provider |
| successful login opens personalized dashboard, profile and logout | Same missing provider |
| protects /dashboard | Same missing provider |
| protects /patrols | Same missing provider |
| protects /patrols/live | Same missing provider |
| protects /patrols/patrol-1/track | Same missing provider |
| protects /incidents | Same missing provider |
| protects /profile | Same missing provider |
| protects /map | Same missing provider |
| refresh waits for server session verification | Same missing provider |
| invalid saved session returns to login | Same missing provider |
| submitting disables duplicate submissions | Same missing provider |
| unknown page remains a 404 | Same missing provider |
| pending account message is displayed without a session | Same missing provider |
| ranger cannot open manager users route | Same missing provider |
| approved manager /users renders inside existing dashboard layout | Same missing provider |
| rejected account shows backend rejection message without a session | Same missing provider |
| a new failed login clears the previous approval notice and preserves credential errors | Same missing provider |
| an authenticated non-manager cannot open patrol management | Same missing provider |
| an authenticated non-manager cannot open live ranger monitoring | Same missing provider |
| an authenticated non-manager cannot open per-ranger tracking | Same missing provider |

### Manager Incident API failures: application defect

| Original failing case | Before | Actual root cause / after |
| --- | --- | --- |
| complete results fetch every backend page before returning accurate totals | Expected the second request to `/incidents`; actual request was `/incidents/ranger` | Manager pagination used the wrong endpoint. Every page now uses the documented manager endpoint, with the same params and cancellation signal. |
| manager list uses the authenticated shared API and drops unsupported filters | Expected `/incidents`; actual request was `/incidents/ranger` | Same incorrect endpoint. The strict filter and request assertions are retained. |

Evidence: `backend/src/routes/incident.routes.js` defines the manager GET `/incidents` with PARK_MANAGER authorization; `docs/api/MANAGER_INCIDENTS.md` documents the same endpoint. These test expectations were correct.

Production changes are limited to `web/src/services/incidentApi.js` and the Reporting screen's loader import/call. `listIncidents` now uses `/incidents`. A separate `listReportingIncidents` loader retains `/incidents/ranger` for the existing researcher Reporting screen, which had shared the erroneous manager adapter. This preserves that screen's existing request/response behavior without changing backend routes or inventing permissions. Both loaders retain the same shared client, supported filters, response validation, and AbortSignal handling.

The new compatibility regression verifies the exact request params and signal for Reporting and manager pagination. Existing complete-pagination, changed-total, missing-page, duplicate-ID, cancellation, and private-evidence assertions remain executed. No production authorization behavior was changed during Checkpoint B.

### Remaining two baseline failures: intermittent test timing

| Original failing case | Baseline symptom | Investigation and correction |
| --- | --- | --- |
| a PENDING report can be verified directly | Expected updateCommunityReportStatus call did not occur | Passed in the fresh reproduction and initial targeted run. The test had clicked immediately after finding a select while asynchronous report initialization could still be finishing. It now waits for loading to finish and awaits userEvent selection/click. It still asserts the exact update call, and additionally verifies the saved-status confirmation. No community production change was required. |
| save conflict preserves edits and displays the server conflict | Walking-route confirmation was not found | Also passed in the fresh reproduction and initial targeted run. The test previously found the patrol title, then immediately validated without waiting for park/ranger controls to finish loading. It now waits for both controls to be enabled, awaits realistic validation/save clicks, and keeps the route confirmation, exact conflict message, and preserved-title assertions. No patrol production change was required. |

These are test-readiness fixes. The earlier failures were intermittent; this checkpoint did not establish a deterministic production defect for either scenario. Timeouts were not increased, and the checks were not weakened.

### Mobile warnings: lifecycle and timer reliability

The full reproduction passed 529 tests but reported eight AlertDetailsScreen `act()` warnings from automatic mark-as-read Promise completions and one VirtualizedList warning from a deferred list update. A later full verification exposed the same timer issue in the patrol-card preview suite. Each was traced to its stack and test suite.

- `safetyAlerts.test.js`: alert-detail tests now await React Native Testing Library's `renderAsync`, which settles React effects inside asynchronous act. Tests which explicitly unmount use `unmountAsync`. Mocked mark-as-read Promises complete before synchronous assertions/interactions leave the React lifecycle. Real alert handling code was not changed.
- `rangerDashboard.test.js` and `patrolCardPreview.test.js`: use controlled timers and drain pending callbacks inside act, then restore real timers. The dashboard filter test awaits deferred list updates inside act. The real VirtualizedList remains rendered; it was not replaced with a simplified mock.
- Two new delayed-read tests verify UNREAD NOTICE becomes READ after a controlled Promise settles, and that settlement after unmount produces no component update. Their console.error spies call through, so unexpected errors remain visible, and each test asserts no error was logged.
- `incidentScreens.test.js`: the unavailable-iOS-file negative scenario intentionally triggers `LOCAL_MEDIA_UNAVAILABLE`. The existing UI rejection/no-extra-create assertions remain, and the test now asserts the exact single diagnostic stage, step, and code. Only that expected warning is captured within the scenario and restored in finally; errors are not globally suppressed.

The final full mobile diagnostic run reports no React act() warnings, unexpected console.error/warn messages, or detected open handles. Expected application console.info diagnostics remain visible. Node's experimental SQLite warning remains visible: it describes the runtime API used by existing tests, not a failed assertion or application state-update defect. No warning-suppression flags were added.

### Verification commands and evidence

From each application's directory:

```powershell
# web
node node_modules/vitest/vitest.mjs run
# mobile
node node_modules/jest/bin/jest.js --runInBand --detectOpenHandles
# backend
node node_modules/jest/bin/jest.js --runInBand
# sensor-dashboard
node ../web/node_modules/vitest/vitest.mjs run --config vitest.config.mjs
```

All commands used the unchanged Phase 2A isolation configurations. They ran as the normal user outside the managed sandbox's known native-path restriction. No real database or external API was contacted; the prohibited manual scripts were not run.

Local ignored `.cache` evidence:

- `web-phase2b-before.json` / `.log`: fresh baseline reproduction.
- `web-phase2b-targeted.json` / `.log`: four affected suites after the initial fixes.
- `web-phase2b-full.json` / `.log`: complete web suite, including the new regression.
- `mobile-phase2b-before.json` / `.log`: full baseline and warning stacks.
- `mobile-phase2b-targeted.json` / `.log`: final 89-test alert/dashboard/card verification with open-handle detection.
- `mobile-phase2b-full.json` / `.log`: final complete mobile diagnostic run.
- `backend-phase2b-checkpointb.json` / `.log`: all 822 backend regressions.
- `sensor-phase2b-full.json` / `.log`: sensor isolation verification.

`git diff --check` passed. Actual coverage was not measured.

### Every file changed in Checkpoint B

1. `web/src/services/incidentApi.js`
2. `web/src/pages/Reporting/Reporting.jsx`
3. `web/tests/foundation/app.test.jsx`
4. `web/tests/foundation/managerIncidentApi.test.jsx`
5. `web/tests/integration/communityReportManagement.test.jsx`
6. `web/tests/integration/patrolEditCancel.test.jsx`
7. `mobile/tests/foundation/safetyAlerts.test.js`
8. `mobile/tests/foundation/rangerDashboard.test.js`
9. `mobile/tests/foundation/patrolCardPreview.test.js`
10. `mobile/tests/foundation/incidentScreens.test.js`
11. `docs/testing-and-refactoring/PHASE_2B_BUG_FIXES.md`

The earlier Phase 2A and Checkpoint A changes remain uncommitted and untouched by this checkpoint. No failing test was deleted, disabled, or skipped. Stop here and wait for user approval before coverage or SOLID work.
