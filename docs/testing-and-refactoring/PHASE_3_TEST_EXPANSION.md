# Phase 3: project-wide test expansion

## Checkpoint A: audit and proposed plan

Audit date: 13 October 2026. Branch: `quality/testing-refactoring`.

This checkpoint inventories existing implementation and tests. No application source, test, configuration, package, or environment file was changed. This document is the only file added. No new tests were executed or implemented in Checkpoint A. Implementation awaits approval for Checkpoint B.

The audit used application source, test bodies and imports, runner discovery settings, and the completed Phase 2B JSON reports. It did not generate coverage. An application imported by a test is not necessarily exercised by its assertions; passing test counts are not coverage percentages.

### Verified starting point

| Application | Executed suites/files in latest Phase 2B run | Passed tests | Failed tests |
| --- | --- | --- | --- |
| Backend | 42 | 822 | 0 |
| Web | 27 | 234 | 0 |
| Mobile | 47 | 531 | 0 |
| Sensor dashboard | 1 | 3 | 0 |
| Total | 117 | 1,590 | 0 |

Shared logic is already exercised through backend/mobile suites; those cases are included in their totals. There is no additional standalone shared test count to add.

Evidence: ignored root `.cache/backend-phase2b-checkpointb.json`, `web-phase2b-full.json`, `mobile-phase2b-full.json`, and `sensor-phase2b-full.json`. These are prior verified executions, not new Phase 3 runs.

### Scope and discovery findings

- Inventoried 331 JS/JSX/TS/TSX files under the five source areas: 293 nonempty files and 38 empty source scaffolds. Nonempty files include constants, demo/placeholder code, and entry points; this count is not a count of business features.
- Found 17 empty `.test` files and six empty test fixture/mock helper files. None proves implemented testing.
- Backend discovers all nonempty `.test.js` files under its tests directory. Filling an existing empty unit/integration test will make it discoverable.
- Web discovers foundation `.test.jsx` files and a specific list of integration files. New foundation suites can use the current configuration; a new integration suite would need an explicit discovery addition.
- Mobile discovers only foundation `.test.js` files. Empty unit/integration directories are currently outside discovery. New focused suites should use foundation discovery unless an integration suite is intentionally added with its safety setup verified.
- Sensor dashboard discovers only `.test.js`, so JSX UI suites require a small matcher/transform setup adjustment. Its current runner uses the web Vitest installation. Its own node_modules contains Vite caches, not an installed application/test dependency tree. UI testing needs deliberate dependency resolution with one React instance, or installation of the required declared/test dependencies after approval.
- No standalone shared runner is necessary. Add focused shared cases to guarded backend Jest suites and retain consumer-level mobile/web checks.

## Module-by-module inventory

The case counts below describe representative existing suites and are not additive coverage percentages. Many suites exercise multiple modules.

| Application/module | Existing evidence | Missing or insufficiently asserted behavior | Priority |
| --- | --- | --- | --- |
| Backend authentication, registration, users and park assignment | registration API 34, login API 13, approval API 38, auth middleware 3, email service 6, health API 5 cases | Direct validator boundary matrices; JWT/configuration error seams where not already covered; email-provider transport failures; dedicated general error-handler contract tests | P2 |
| Backend patrol scheduling, editing, cancellation and lifecycle | patrol API 55, management API 22, lifecycle API 14, patrol validator 57, patrol service 12, planned route 25 cases | Direct service/repository failure seams and rollback/readback contracts not asserted by existing API tests; supplement boundaries rather than repeat successful scheduling cases | P1 |
| Backend GPS, routing, live tracking and risk avoidance | navigation API 40, live Ranger API 8, ORS 39, route validation 10, shared geometry 13 cases | Real riskZone.service.forPark is mocked in several routing suites. Add park-scoped active HIGH/CRITICAL selection, invalid stored geometry, count/area/extent limits, and data-access failure tests | P1 |
| Backend incident creation, editing, review, withdrawal and synchronization identity | incident API 51, incident validator 45, idempotency service 6, repository 1 case | The general incident.service unit file is empty. Fill focused service failure/presentation seams; add equivalent timestamp/UUID replay and P2002 recovery cases absent from current idempotency tests | P1 |
| Backend private evidence and asynchronous receipts | evidence API 23, upload API 11, evidence validator 8, evidence service 15, serial pg client 2 cases | Direct evidenceUploadJobs capacity, expiry, owner binding, and safe failure receipt tests. Existing upload/private-ticket/cleanup tests should be retained rather than duplicated | P1 |
| Backend community reports, anonymous reporting and SMS | community API 50, anonymous API 6, SMS API 12, SMS parser 15 cases | Empty community service unit file; direct validator lengths/coordinate-pair/transition/filter boundaries; SMS provider cache boundary and service-failure cases | P2 |
| Backend alerts and notifications | alert API 62 cases cover read/acknowledgement, operational response, forwarding, escalation, ingestion and role restrictions | Empty alert service unit file; targeted exact age-boundary and repository-failure cases; retain the already-tested duplicate/escalation/security flows | P2 |
| Backend wildlife/sensor ingestion, animals, density and risk proximity | Implemented in sensor routes/service/repository; no focused functional suite found | Existing/new animal ingestion; duplicate code rejection; optional data normalization; update-versus-insert at the one-hour boundary; same-species density threshold; overlapping risk-zone count; CRUD/query failure contracts | P1 |
| Backend analytics, conservation reports and exports | analytics API 12, analytics service 18, validator 11, repository 3; report API 20, report service 12 cases | Populated report filtering; combined date bounds; exact boundary inclusion; summary/detail agreement; report validator and CSV/HTML field escaping/privacy tests | P1 |
| Web authentication, protected routes and user management | app 23, auth API 2, registration 8, role selection 3, users 6, Ranger area 4, login status 7 cases | Actual JWT UI-expiry timer and interceptor callbacks; more implemented role/route combinations; direct user/park adapter payload/error tests; health-hook cancellation | P2 |
| Web manager dashboard and analytics | analytics dashboard 9 and analytics API 9 cases | Additional panel independence, malformed response handling, zero values and retry/cancellation cases where current assertions do not cover them | P2 |
| Web patrol planning, edit/cancel, tracking and maps | patrol management 8, list 17, detail 5, edit/cancel 9, live monitoring 8, tracking 6, route planner 6, route API 6, validation 10, preview 2 cases | Adapter-level error/abort boundaries and late-response tests not already covered; keep existing stale validation, list filtering and route invalidation tests | P1 |
| Web manager incidents, evidence, grouping and review | manager API 8, manager incidents 24, private evidence 4, review 11 cases | Status vocabulary consistency with the six backend lifecycle values; API update/count/reporting-loader error paths; additional response-shape and navigation-context edge cases | P1 |
| Web community reports | manager API 8 and UI management 11 cases | Navigation/filter helper boundary cases, terminal-state select behavior, stale saves after record changes, and page/empty/error cases missing from current scenarios | P2 |
| Web wildlife monitoring, field map, zone alerts and Reporting | Functional pages/provider exist. App tests mock polling to empty data, but do not test zone decisions or these pages' operations | Species/location filtering, missing latest location, zero counts, density display, date-range route loading, partial API failures, zone dismissal/polling cleanup, risk-zone CRUD and completion actions | P1 |
| Web conservation report page, API and PDF generation | Implementation exists; no focused suites found for conservationReportApi, ConservationReports or reportPdf | Type/filter/date payloads; loading/empty/error/generation states; authenticated download; HTTP failures; filename fallback; object URL cleanup; PDF rendering adapter calls and summary mapping | P1 |
| Mobile authentication, navigation, registration and startup | session 5, auth API 6, role navigation 7, linking 46, registration 8, startup/font/onboarding/role suites | Direct health/API error contracts and additional expiry/role boundary cases only where not already covered; explicitly identify demo versus authenticated production paths | P2 |
| Mobile Ranger patrol, route, GPS and live navigation | Dashboard 20, detail 11, route screen 9, card preview 11, manager sync 3, foreground location 9, navigation hook 14, full route 11, navigation screen 9 cases | Direct location service malformed readings/native exception/precision boundaries; subscription failures; API adapters and focus-scoped resource cancellation; supplement existing GPS disabled/denied/timeout UI checks | P1 |
| Mobile incident forms, evidence and offline reporting | Incident screens 54, incident API 20, evidence API 20, preparation 12, evidence utilities 17, offline storage/coordinator 20, offline maps 18 cases | HTTP-date Retry-After and server retryAfterSeconds branches; targeted storage fault/recovery paths; resource refresh race cases and unsupported browser storage; preserve existing durable SQLite, ownership, backoff and concurrent GPS/media tests | P1 |
| Mobile community reporting, permissions and alerts | Community location 6, evidence 12, create 7, reports 8, review 6, home 6, anonymous 5; safety alerts 58 cases | Direct alertApi request/response/error/cancellation cases (screen tests mock this service); direct location service boundary errors; small community adapter gaps beyond existing UI rejection/permission checks | P2 |
| Sensor dashboard functional UI and API | Three isolation tests only | All animal CRUD, generated codes, required-field behavior, species-dependent animal choices, map selection, telemetry parsing, busy states, success resets, confirmation cancellation and API failure states | P1 |
| Shared patrolLifecycle | 18 backend cases plus mobile consumers | Equal-deadline and just-after-deadline cases if absent; date fallback, leap/year rollover, deterministic equal-start sorting, input immutability and unknown filter behavior | P1 |
| Shared patrolNavigation | Exercised by navigation API, geometry tests and mobile navigation cases | Dedicated validCoordinate/distanceToRouteMeters/shouldRecordSample tests: zero/same-point/degenerate segments, inclusive coordinate edges, min-time/movement/max-interval boundaries | P1 |
| Shared riskGeometry | 13 dedicated backend cases plus routing/mobile consumers | Exact policy thresholds rather than only excessive values; MultiPolygon/hole/invalid-ring cases supported by the current implementation; no mutation of input geometries | P1 |

### Empty scaffolds and unsupported features

Do not invent tests for behavior that is not implemented:

- Backend animal and camera-trap service/controller/repository/routes are empty. Actual animal CRUD/telemetry lives under sensor APIs and is in scope there.
- Backend sync.service is empty. Offline incident/GPS behavior exists through other backend endpoints and mobile offlineSync; test those implementations.
- Web standalone Alerts, CameraTraps and RiskZones pages and several common components/services are empty. Risk-zone operations exist inside Reporting, and alerts exist in ZoneAlertProvider/banner and mobile; those implemented paths are in scope.
- Mobile legacy pendingIncidents/pendingPatrolData/syncQueue, several patrol/incident screens, useLocation/useNetworkStatus/useSync and other scaffold files are empty. Patrol completion exists in the implemented patrol/detail/navigation flow, so it must not be confused with the empty CompletePatrolScreen file.
- Browser offline field storage explicitly reports that native SQLite/media are required. Test its unsupported-state rejection and pure transforms; do not claim durable browser queue support.

## Findings that new tests should expose

### Populated date-range regression: confirmed structural defect

`backend/src/services/report.service.js` creates incident queries with separate object spreads assigning `reportedAt` for from and to. When both are present, the second assignment replaces the first. Community report details repeat the same problem with `submittedAt`.

The current incident date-range test runs against an empty report fixture and checks dates only in a forEach over the returned list. It therefore cannot demonstrate exclusion of older rows. Analytics uses both bounds, so report summaries and details may disagree.

Proposed regression: populate records before the window, exactly at each bound, within it and after it. Assert included IDs, both query bounds, and agreement between summary counts and detail rows. If approved, reproduce with in-memory mocks first, then document the smallest necessary correction. No source fix has been made in Checkpoint A.

### Sensor/risk-zone authorization needs a defined contract

`backend/src/routes/sensor.routes.js` and `riskZone.routes.js` currently have no authentication/role middleware. The sensor dashboard itself has no login flow. A test must not invent a manager/Ranger policy or describe unrestricted writes as a passed security requirement.

Plan: test implemented service/query behavior with mocks, identify and report the missing access controls separately, and confirm the intended telemetry-ingestion and risk-zone mutation access policy before adding acceptance assertions or changing production permissions.

### Additional contracts to check, not assumed defects

- Out-of-order telemetry currently satisfies the service's timeDiff < oneHour condition; establish the intended older-sample policy before asserting rejection or preservation of the newer sample.
- Density grouping operates on location records. Test distinct-animal versus repeated-location examples and establish the intended count interpretation before proposing a correction.
- Backend supports six incident statuses while the web review adapter's options expose four. Add a contract regression and explain any necessary UI correction rather than reduce the backend vocabulary.
- Export utilities interpolate record text. Test commas, quotes, newlines and HTML-sensitive input to establish escaping/privacy behavior; do not label an unsafe output as acceptable merely because it is current behavior.

## Proposed Checkpoint B batches

Each batch adds only meaningful missing cases, uses deterministic fixtures, runs the affected guarded suites, and records actual outcomes. No count target or coverage percentage is promised.

### Batch 1: viva-critical patrol, incidents and shared boundaries

First fill the real risk-zone service gap and receipt capacity/expiry gap. Extend incident idempotency and direct service assertions without repeating the existing patrol-completion races. Add dedicated navigation thresholds and missing lifecycle/geometry boundary cases through backend Jest. Include the populated report-date regression because it is a concrete hidden defect.

Relevant proposed files:

- `backend/tests/unit/patrol/riskZone.service.test.js` (new)
- `backend/tests/unit/patrol/patrolNavigation.test.js` (new, exercises shared code)
- Existing `patrol.lifecycle.test.js`, `riskGeometry.test.js`, and `patrol.service.test.js`
- Existing empty `backend/tests/unit/incident/incident.service.test.js`
- `backend/tests/unit/incident/evidenceUploadJobs.test.js` (new)
- Existing `incident.idempotency.test.js` and `backend/tests/report.service.test.js`

### Batch 2: wildlife/sensor functionality across applications

Add mocked backend sensor service, query/density and HTTP integration tests; risk-zone CRUD fallback/no-park/error tests; sensor dashboard API and UI tests; web WildlifeMonitoring, FieldMap and zone alert decisions. This batch must cover actual operations, not merely network denial. Mock maps, tiles, confirm dialogs, APIs and clocks. Keep numeric transformations and displayed data observable through the UI rather than extracting production functions just to test them.

Relevant proposed files:

- `backend/tests/unit/monitoring/sensor.service.test.js` and `sensor.repository.test.js` (new)
- Existing empty `backend/tests/integration/monitoring.api.test.js`, plus a focused risk-zone API suite if useful
- `sensor-dashboard/tests/api.test.js` and `App.test.jsx` (new), with minimal JSX/dependency setup changes
- Web foundation suites for wildlife monitoring, field map, zone alerts and sensor/risk-zone API adapters

Negative examples: duplicate animal code produces no create; database error is handled safely; cancelled deletion makes no request; API failure retains editable values; missing map selection keeps telemetry submission unavailable. Do not assume an undocumented HTTP status or role policy.

### Batch 3: web services, reports and authentication lifecycle

Add direct conservation API/download/PDF adapter tests and report-page states. Add user/park adapter contracts and JWT-expiry/interceptor/health-hook tests. Extend only missing incident/community review, dashboard and patrol API states. Use explicit Axios/fetch mocks; simulated downloads must not create real browser downloads or network calls.

Relevant proposed files: new foundation suites for conservationReportApi, conservation reports, reportPdf, API health, user/park/patrol adapters; extensions to app, managerIncidentApi, incidentReview, communityReportManagement and analytics suites where the inventory shows an actual gap.

### Batch 4: mobile API, permissions and offline failure branches

Add direct alertApi and locationService cases, API health and incident resource cancellation, offline Retry-After date/body variants, storage failures and explicit browser unsupported-state checks. Reuse the existing temporary test-only SQLite harness for native persistence; do not connect to PostgreSQL or delete unrelated files. Retain awaited render/act and timer cleanup from Phase 2B.

Relevant proposed foundation suites: alertApi, locationService, apiHealth, incidentResource and browser offline storage; extensions to offlineStorage, foregroundLocation, incidentEvidenceApi and session/role suites only for missing cases.

### Batch 5: remaining implemented validator/service/error seams and final evidence

Complete focused community/report/auth validator matrices, alert/SMS service gaps, populated analytics/report/export cases and error middleware sanitization. Review every implemented module against the updated inventory, then run all four safe applications. Finish the verified case table and remaining-gap list in this document. If a batch finds a defect, retain the failing regression, explain it, and apply only a justified minimal fix within the approved scope; unresolved policy decisions must be reported rather than forced green.

## Existing verified test-case examples

These rows represent real assertions in the latest saved Phase 2B reports. IDs below are documentation labels for existing cases. No proposed/new Phase 3 case is assigned a pass result.

| Test Case ID | Module | Scenario | Test Type | Input | Expected Result | Actual Result | Pass/Fail |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EXIST-BE-INC-01 | Backend incident API | Client assigns valid review status during creation/edit | Negative/security | Valid incident payload plus status VERIFIED | Both requests rejected with 400; no incident create/update | Assertions passed in incident.api suite | Pass |
| EXIST-BE-INC-02 | Backend incident review | Non-manager tries review mutation | Authorization | Approved Ranger/researcher requests UNDER_REVIEW | 403; no status write; anonymous request 401 | Assertions passed in incident.api suite | Pass |
| EXIST-BE-SYNC-01 | Backend incident service | Concurrent/lost-response retry | Edge/concurrency | Two concurrent requests with the same Ranger/patrol UUID | One persisted incident; same ID returned; retry after completion replays it | Assertions passed in incident.idempotency suite | Pass |
| EXIST-SHARED-GEO-01 | Shared riskGeometry | Circle uses meters at different latitudes | Positive/boundary | 100 m radius at latitudes 7.5, 49 and 70 | Valid enclosing closed ring; vertex distances match buffered radius | All three parameter cases passed | Pass |
| EXIST-SHARED-GEO-02 | Shared riskGeometry | Invalid coordinates/rings | Negative | Invalid coordinates, poles/dateline or unclosed ring fixtures | Invalid geometry rejected | Assertions passed in riskGeometry suite | Pass |
| EXIST-SHARED-TIME-01 | Shared patrolLifecycle | Sri Lankan midnight rollover | Boundary | 2026-10-07T18:29:59Z and 18:30:00Z | Local date changes from 7 to 8 October; schedule conversion correct | Assertions passed in patrol.lifecycle suite | Pass |
| EXIST-WEB-AUTH-01 | Web authentication | Pending login disables duplicate submission | Edge | Valid login fields; unresolved mocked login Promise | Disabled Logging in button and exactly one post; successful resolution opens dashboard | Assertions passed in app suite | Pass |
| EXIST-WEB-INC-01 | Web manager API | Complete pagination | Positive | 26 records returned across pages of 25 | All 26 returned; second call uses manager endpoint and page 2 | Assertions passed in managerIncidentApi suite | Pass |
| EXIST-WEB-INC-02 | Web manager API | Pagination total changes | Error/edge | Second page reports a different total | Loader rejects incomplete/inconsistent results | Assertions passed in managerIncidentApi suite | Pass |
| EXIST-MOB-GPS-01 | Mobile foreground GPS | Permission denied | Negative/permission | Mocked permission status denied | Friendly permission error; null position; no watcher started | Assertions passed in foregroundLocation suite | Pass |
| EXIST-MOB-OFFLINE-01 | Mobile offline storage | GPS survives SQLite reopen | Positive/persistence | Enqueued GPS sample; close and reopen isolated test SQLite | Original sample and timestamp retained | Assertions passed in offlineStorage suite | Pass |
| EXIST-MOB-OFFLINE-02 | Mobile synchronization | Manual retry cannot bypass persisted cooldown | Boundary/error | Mocked 429 with Retry-After 60 seconds; restart/retry | No additional GPS request during cooldown | Assertions passed in offlineStorage suite | Pass |
| EXIST-MOB-ALERT-01 | Mobile alerts | Delayed automatic mark-as-read | Async/positive | Unread alert and controlled unresolved read Promise | UNREAD NOTICE becomes READ after settlement inside act; no console error | Assertions passed in safetyAlerts suite | Pass |
| EXIST-SENSOR-SAFE-01 | Sensor test infrastructure | Fetch tries real backend | Safety/negative | Fetch localhost sensor URL | TEST_NETWORK_BLOCKED before real request | Assertion passed in testIsolation suite | Pass |

Source suites are named in the inventory and can be matched to their full assertion names in the saved JSON. The sensor row intentionally proves isolation only; functional sensor outcomes remain unverified until Batch 2.

## Execution and safety rules for approved implementation

- Keep Phase 2A resolver/setup and transport guards enabled in every new test.
- Mock Prisma/database/repository seams explicitly. A test needing a real PostgreSQL connection is outside this plan.
- Use Supertest only against an in-process app. Never run the development server for these tests.
- Mock Cloudinary, ORS, Expo permissions/GPS/media/network, map tiles, and download adapters. Expected diagnostics must be asserted in their own tests, not globally hidden.
- Keep application/runner time deterministic using clocks/deferred Promises and clean up timers, subscriptions, object URLs, and isolated SQLite handles.
- Use existing runners; change discovery/dependency setup only where needed, especially sensor JSX. This is not coverage configuration.
- Run the affected suites after each batch. Run full backend, web, mobile and sensor suites at the end, with mobile open-handle diagnostics as appropriate.
- Do not run testReports.js, testRiskZones.js, seeds, migrations, resets, or production environment loading. Do not commit, push, merge, or switch branches.
- Do not create tests for empty scaffolds or unsupported hardware capabilities. Browser/native/device end-to-end behavior, real providers, PostgreSQL execution plans and physical GPS/camera reliability remain outside this isolated test plan.

## Checkpoint A status

Files changed: this document only. Tests added: zero. Bugs fixed: zero. New test execution: none. Coverage measured: none. The prior verified baseline remains 1,590 passed / zero failed.

Await approval for Checkpoint B. The proposed batches and outstanding access/data-policy questions above are the reviewable expansion plan.

## Checkpoint B — Batch 1 implementation and evidence

Batch 1 implements only viva-critical patrol, risk avoidance, navigation, incidents, receipt handling, shared boundaries and report-date tests. Batch 2, coverage configuration and SOLID refactoring have not started. The preceding Checkpoint A text is the historical audit/plan.

### Actual execution and counts

| Run | Suites | Passed | Failed | New Batch 1 cases included |
| --- | --- | --- | --- | --- |
| Previous complete backend baseline | 42 | 822 | 0 | 0 |
| Report regression reproduction before production fix | 1 | 12 | 2 | 2 |
| First report/risk/navigation/receipt verification | 4 | 58 | 0 | 46 |
| Final affected-suite verification | 9 | 146 | 0 | 85 |
| Final complete safe backend suite | 46 | 907 | 0 | 85 |

Exactly **85 tests were added**: risk-zone service 14, navigation 21, lifecycle 7, risk geometry 6, patrol service 6, incident service 8, idempotency 6, upload jobs 9, and report dates 8. Four previously undiscovered suites now execute: three new files and the formerly empty incident.service test file. Parameterized cases count as individual executed tests. Every new case has a unique B1 identifier in its Jest name.

The targeted runs overlap the full run; do not add their counts together. Backend increased from 822 to 907, not by 146. Web/mobile/sensor files were not changed or rerun in this backend-only batch; their most recent verified results remain 234/531/3 passed. Passing test counts are not code coverage. No coverage measurement was made.

### Report bug: failing evidence before the fix

The new B1-RPT-01 and B1-RPT-02 fixtures contain five rows dated 9, 10, 15, 20 and 21 January 2026. A requested inclusive range of 10–20 January must return only start, inside and end.

Before changing production code, both tests failed because details also returned the 9 January `before` row. The first filter object used `reportedAt: { gte: from }` (or submittedAt for community reports); the second spread assigned the same field with only `lte: to`, replacing the lower bound. Existing empty-data tests did not expose this.

The only production change in this batch is in `backend/src/services/report.service.js`: each detail query now builds one date-field object containing both gte and lte when present. One-sided ranges are preserved. No new service/repository abstraction or unrelated refactoring was introduced.

After correction, both regressions return exactly three rows, assert the actual combined query constraints and inclusive boundaries, and verify the summary count is three and equals the detail row count. Six additional report cases verify lower-only, upper-only and equal-start/end ranges for both report generators. They use the real analytics/report services over the existing in-memory fixture, not a mocked summary that simply repeats a desired count.

### Other findings and test reliability

- No further application defect was demonstrated by the new cases. Existing role/ownership, transaction, geometry and idempotency contracts passed the added assertions.
- During test authoring, six new patrol cases initially failed because their setup named a nonexistent repository.findPatrol method. The actual method is findPatrolById. The mock was corrected; no production code or assertion was weakened.
- The risk-zone forPark implementation reads the database delegate directly. Tests mock that actual boundary and verify a database failure is propagated rather than treated as an empty safe area.
- Service tests verify delegated scoped reads and Ranger/manager listing behavior. HTTP role authorization is still enforced and covered by existing API tests; the new tests do not invent a service-layer role policy.
- The exact geographic extent comparison is tested with an isolated distance dependency returning 18,000 and 18,000.001 metres. Other new/retained geometry and navigation cases use real distance calculations. This avoids pretending a rounded coordinate fixture is mathematically exact at the policy boundary.
- Receipt tests use a fresh isolated module, fixed clock and deterministic UUID source per case. Timer/UUID mocks are restored after each test. Risk/lifecycle/navigation tests retain frozen inputs or explicit mutation checks.

### Complete new-case table

Actual outcomes below are verified in the final affected and full backend runs. All inputs are test-only fixtures. IDs correspond exactly to Jest case names in the JSON evidence.

| Test Case ID | Module | Scenario | Test Type | Input | Expected Result | Actual Result | Pass/Fail |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B1-RSK-01 | Risk-zone service | Park and active high-risk selection | Positive/security | Requested park; HIGH/CRITICAL plus wrong-park, inactive and LOW fixtures | Only two applicable zones; exact scoped query, limit and order | As expected | Pass |
| B1-RSK-02 | Risk-zone service | Empty applicable set | Positive/empty | Empty mocked query result | Empty avoidance set | As expected | Pass |
| B1-RSK-03 | Risk-zone service | Empty park ID | Negative | Empty string | 422 DATA_UNAVAILABLE; no data access | As expected | Pass |
| B1-RSK-04 | Risk-zone service | Missing park ID | Negative | null | 422 DATA_UNAVAILABLE; no data access | As expected | Pass |
| B1-RSK-05 | Risk-zone service | Wrong park ID type | Negative | Number 1 | 422 DATA_UNAVAILABLE; no data access | As expected | Pass |
| B1-RSK-06 | Risk-zone service | Invalid stored zone fails closed | Error/security | Valid zone plus zero-radius zone | DATA_INVALID; only safe valid context retained | As expected | Pass |
| B1-RSK-07 | Risk-zone service | Exact zone count limit | Boundary | 32 valid tiny zones | All 32 returned | As expected | Pass |
| B1-RSK-08 | Risk-zone service | Count exceeds limit | Boundary/negative | 33 valid tiny zones | AVOIDANCE_LIMIT; bounded context of 32, not successful truncation | As expected | Pass |
| B1-RSK-09 | Risk-zone service | Exact maximum radius | Boundary | Radius 5,000 m | One valid zone returned | As expected | Pass |
| B1-RSK-10 | Risk-zone service | Oversized radius | Boundary/negative | Radius 5,000.001 m | DATA_INVALID | As expected | Pass |
| B1-RSK-11 | Risk-zone service | Combined area overflow | Boundary/negative | Two 5,000 m zones | AVOIDANCE_LIMIT | As expected | Pass |
| B1-RSK-12 | Risk-zone service | Geographic extent overflow | Boundary/negative | Zones at latitude 7.5 and 8 | AVOIDANCE_LIMIT | As expected | Pass |
| B1-RSK-13 | Risk-zone service | Database unavailable | Error | Rejected riskZone.findMany Promise | Original error propagates; no fake empty result | As expected | Pass |
| B1-RSK-14 | Risk-zone service | Bounded presentation and immutability | Boundary/security | Frozen record; name 170 chars, description 2,010, extra field | Output lengths 160/2,000; private/internal fields omitted; source unchanged | As expected | Pass |
| B1-NAV-01 | Shared navigation | Zero coordinate | Positive/boundary | Latitude/longitude 0 | Valid | As expected | Pass |
| B1-NAV-02 | Shared navigation | Positive coordinate bounds | Boundary | Latitude 90, longitude 180 | Valid | As expected | Pass |
| B1-NAV-03 | Shared navigation | Negative coordinate bounds | Boundary | Latitude -90, longitude -180 | Valid | As expected | Pass |
| B1-NAV-04 | Shared navigation | Latitude out of range | Negative/boundary | Latitude 90.001 | Invalid | As expected | Pass |
| B1-NAV-05 | Shared navigation | Longitude out of range | Negative/boundary | Longitude -180.001 | Invalid | As expected | Pass |
| B1-NAV-06 | Shared navigation | No coordinate coercion | Negative | String latitude 7.5 | Invalid | As expected | Pass |
| B1-NAV-07 | Shared navigation | NaN coordinate | Negative | NaN latitude | Invalid | As expected | Pass |
| B1-NAV-08 | Shared navigation | Infinite coordinate | Negative | Infinite longitude | Invalid | As expected | Pass |
| B1-NAV-09 | Shared navigation | Missing point | Negative | null | Invalid/falsy | As expected | Pass |
| B1-NAV-10 | Shared navigation | Zero and antipodal distances | Positive/edge | Origin to itself and antipode | Zero distance; finite half-earth circumference | As expected | Pass |
| B1-NAV-11 | Shared navigation | Empty route distance | Edge | Empty coordinates | Infinity; no invented finite route | As expected | Pass |
| B1-NAV-12 | Shared navigation | Degenerate segment | Edge/immutability | Frozen repeated coordinates; at/on-offset query point | Zero or 111.19508 m; no division-by-zero or mutation | As expected | Pass |
| B1-NAV-13 | Shared navigation | Projection beyond segment | Boundary | Point beyond a one-segment endpoint | Clamped endpoint distance 111.19508 m | As expected | Pass |
| B1-NAV-14 | Shared navigation | First sample | Positive | No previous fix | Record sample | As expected | Pass |
| B1-NAV-15 | Shared navigation | Before minimum sample interval | Boundary/negative | 9,999 ms; 100 m movement | Do not record | As expected | Pass |
| B1-NAV-16 | Shared navigation | Exact time and movement thresholds | Boundary | 10,000 ms; 30 m movement | Record | As expected | Pass |
| B1-NAV-17 | Shared navigation | Movement just below threshold | Boundary/negative | 10,000 ms; 29.999 m | Do not record | As expected | Pass |
| B1-NAV-18 | Shared navigation | Movement just above threshold | Boundary | 10,000 ms; 30.001 m | Record | As expected | Pass |
| B1-NAV-19 | Shared navigation | Before stationary maximum interval | Boundary/negative | 59,999 ms; no movement | Do not record | As expected | Pass |
| B1-NAV-20 | Shared navigation | Exact stationary maximum interval | Boundary | 60,000 ms; no movement | Record | As expected | Pass |
| B1-NAV-21 | Shared navigation | Out-of-order sample | Edge/negative | -1 ms; 100 m movement | Do not record | As expected | Pass |
| B1-LIFE-01 | Shared lifecycle | Scheduled overdue boundary | Boundary | Exact end time, then end plus 1 ms | Not overdue at equality; overdue after | As expected | Pass |
| B1-LIFE-02 | Shared lifecycle | Active overdue boundary | Boundary | IN_PROGRESS at exact end and plus 1 ms | Same inclusive boundary; workflow status unchanged | As expected | Pass |
| B1-LIFE-03 | Shared lifecycle | Minimal lateness | Boundary | Completed 1 ms late | Late badge; less-than-one-minute message | As expected | Pass |
| B1-LIFE-04 | Shared lifecycle | Stable tie ordering | Edge/immutability | Frozen equal schedules ordered b,a | Select a; caller order remains b,a | As expected | Pass |
| B1-LIFE-05 | Shared lifecycle | Leap-day date-only deadline | Boundary | 29 February 2024 with no timestamps | Deadline at 1 March Sri Lankan midnight | As expected | Pass |
| B1-LIFE-06 | Shared lifecycle | Schedule fallback and year rollover | Edge | Invalid scheduledDate; start 31 December 19:00 UTC | Local scheduled date 1 January 2027 | As expected | Pass |
| B1-LIFE-07 | Shared lifecycle | Unknown filter | Negative | UNSUPPORTED filter | No match | As expected | Pass |
| B1-GEO-01 | Shared risk geometry | Radius equality and source immutability | Boundary | Frozen radius 5,000; then 5,000.001 | Polygon at equality; null above; unchanged input | As expected | Pass |
| B1-GEO-02 | Shared risk geometry | Exact policy count | Boundary | 32/33 tiny zones | true/false | As expected | Pass |
| B1-GEO-03 | Shared risk geometry | Extent equality | Boundary | Isolated computed distance 18,000 m | Within limits | As expected | Pass |
| B1-GEO-04 | Shared risk geometry | Extent just above limit | Boundary/negative | Computed distance 18,000.001 m | Outside limits | As expected | Pass |
| B1-GEO-05 | Shared risk geometry | Analytical area boundary | Boundary | Two circles at 150,000,000 square m combined buffered area; radius plus 1 mm | Boundary accepted; extra radius rejected | As expected | Pass |
| B1-GEO-06 | Shared risk geometry | Route touches polygon vertex | Boundary/immutability | Route ends exactly at a zone vertex | Intersection true; route and geometry unchanged | As expected | Pass |
| B1-PAT-01 | Patrol service | Route rejection blocks scheduling | Error/security | Route validator rejects with 422 | Error propagates; no create | As expected | Pass |
| B1-PAT-02 | Patrol service | Cross-park reassignment | Authorization/negative | Ranger assigned to another park | 400 field error before routing/update | As expected | Pass |
| B1-PAT-03 | Patrol service | Unassigned approved Ranger eligibility | Positive | Approved active Ranger with no assigned park | Validate and update the same scheduled patrol | As expected | Pass |
| B1-PAT-04 | Patrol service | Edit persistence error | Error | Rejected updateScheduledPatrol Promise | Original error propagates | As expected | Pass |
| B1-PAT-05 | Patrol service | Cancellation persistence error | Error | Rejected scheduled cancellation write | Original error propagates; exact CANCELLED write attempted | As expected | Pass |
| B1-PAT-06 | Patrol service | Cancelled filtering preserves history | Positive/immutability | Frozen CANCELLED, COMPLETED and IN_PROGRESS rows | Return completed/active; preserve source list and Ranger query | As expected | Pass |
| B1-INC-01 | Incident service | Summary presentation | Boundary/immutability | Frozen 501-character description; evidence count 3; page 2 | Cap to 500; retain count/pagination; omit internal count; source unchanged | As expected | Pass |
| B1-INC-02 | Incident service | Scoped read denied | Authorization/negative | Scoped repository returns null for Ranger | 404; same user passed; no widened read or mutation | As expected | Pass |
| B1-INC-03 | Incident service | Row lock unavailable | Error | lockIncident rejects | Error propagates; no update | As expected | Pass |
| B1-INC-04 | Incident service | Transaction update unavailable | Error | update rejects after successful lock | Error propagates through active patrol transaction | As expected | Pass |
| B1-INC-05 | Incident service | Failed creation uses server identity | Error/security | Valid DTO; create rejects | No invented success; exact reporter/patrol/park/PENDING/SYNCED payload; DTO unchanged | As expected | Pass |
| B1-INC-06 | Incident service | Ranger list ownership | Authorization | Filters propose other reporter; Ranger r | Query bound to r and patrol p | As expected | Pass |
| B1-INC-07 | Incident service | Manager list scope | Positive/role | Manager plus explicit reporter filter | Preserve filter without Ranger-only scope injection | As expected | Pass |
| B1-INC-08 | Incident service | Review persistence failure | Error/immutability | Frozen PENDING record; setStatus rejects | Error propagates; record stays PENDING | As expected | Pass |
| B1-IDEM-01 | Incident idempotency | Equivalent UUID/time replay | Edge | Uppercase same UUID; timezone-equivalent timestamp | Same persisted ID; one create | As expected | Pass |
| B1-IDEM-02 | Incident idempotency | Missing versus null manual location | Edge | Original missing manualLocation; replay null | Same persisted ID; one create | As expected | Pass |
| B1-IDEM-03 | Incident idempotency | Inline evidence on replay | Negative/security | Existing UUID with new inline evidence | 409 IDEMPOTENCY_CONFLICT; no second create | As expected | Pass |
| B1-IDEM-04 | Incident idempotency | Database uniqueness conflict recovery | Error/recovery | P2002 after initial lookup misses a matching persisted record | Replay matching owned record | As expected | Pass |
| B1-IDEM-05 | Incident idempotency | Unrecoverable uniqueness conflict | Error/security | P2002; no owned record exists | Original P2002 propagates; no create | As expected | Pass |
| B1-IDEM-06 | Incident idempotency | Conflicting recovered content | Negative/error | P2002; saved longitude differs | IDEMPOTENCY_CONFLICT; no second create | As expected | Pass |
| B1-JOB-01 | Upload receipts | Processing receipt identity | Positive | Incident i, Ranger r, request ID | PROCESSING receipt bound to all three; same receipt found | As expected | Pass |
| B1-JOB-02 | Upload receipts | Wrong incident | Authorization | Existing receipt queried through another incident | 404 RECEIPT_UNAVAILABLE | As expected | Pass |
| B1-JOB-03 | Upload receipts | Wrong owner | Authorization | Existing receipt queried by another Ranger | Same 404 | As expected | Pass |
| B1-JOB-04 | Upload receipts | Unknown receipt | Negative | Missing receipt ID | Same safe 404 | As expected | Pass |
| B1-JOB-05 | Upload receipts | Capacity boundary | Boundary | 100 receipts, then a 101st | 100 unique receipts accepted; next rejected with 429 UPLOAD_BUSY | As expected | Pass |
| B1-JOB-06 | Upload receipts | Completion expiry boundary | Boundary | COMPLETE receipt; advance 600,000 then 1 ms | Readable at ten minutes; unavailable one ms later | As expected | Pass |
| B1-JOB-07 | Upload receipts | Expiry frees capacity | Edge | One finished and 99 processing receipts; advance beyond expiry | New receipt fits; processing receipt remains readable | As expected | Pass |
| B1-JOB-08 | Upload receipts | Unknown provider failure sanitization | Error/security | Error with fixture-private provider text | FAILED with safe 503/code/message; no raw detail | As expected | Pass |
| B1-JOB-09 | Upload receipts | Known failure sanitization and expiry | Error/security | Known 409/code plus private message; advance past expiry | Keep status/code only; generic message; receipt expires | As expected | Pass |
| B1-RPT-01 | Incident reports | Populated combined range | Regression/boundary | Rows before, at start, inside, at end, after 10–20 January | Three matching IDs; both query bounds; summary equals detail count | Failed before fix; passed after | Pass |
| B1-RPT-02 | Community conflict reports | Populated combined range | Regression/boundary | Same five submittedAt fixtures | Same inclusive three-row result and summary agreement | Failed before fix; passed after | Pass |
| B1-RPT-03 | Incident reports | Lower bound only | Boundary | from 10 January; five fixtures | Four rows from start onward; summary 4 | As expected | Pass |
| B1-RPT-04 | Incident reports | Upper bound only | Boundary | to 20 January; five fixtures | Four rows through end; summary 4 | As expected | Pass |
| B1-RPT-05 | Community conflict reports | Lower bound only | Boundary | from 10 January; five fixtures | Four rows; summary 4 | As expected | Pass |
| B1-RPT-06 | Community conflict reports | Upper bound only | Boundary | to 20 January; five fixtures | Four rows; summary 4 | As expected | Pass |
| B1-RPT-07 | Incident reports | Equal start/end | Boundary | Both bounds at 10 January midnight | Only exact start row; summary 1 | As expected | Pass |
| B1-RPT-08 | Community conflict reports | Equal start/end | Boundary | Same equal bounds | Only exact start row; summary 1 | As expected | Pass |

### Files changed in Batch 1

1. `backend/src/services/report.service.js` — only production change; preserve both detail date bounds.
2. `backend/tests/report.service.test.js` — eight populated date cases.
3. `backend/tests/unit/patrol/riskZone.service.test.js` — new, 14 cases.
4. `backend/tests/unit/patrol/patrolNavigation.test.js` — new, 21 cases.
5. `backend/tests/unit/patrol/patrol.lifecycle.test.js` — seven cases added.
6. `backend/tests/unit/patrol/riskGeometry.test.js` — six cases added.
7. `backend/tests/unit/patrol/patrol.service.test.js` — six cases added.
8. `backend/tests/unit/incident/incident.service.test.js` — filled existing empty scaffold with eight cases.
9. `backend/tests/unit/incident/incident.idempotency.test.js` — six cases added.
10. `backend/tests/unit/incident/evidenceUploadJobs.test.js` — new, nine cases.
11. `docs/testing-and-refactoring/PHASE_3_TEST_EXPANSION.md` — this verified Batch 1 evidence.

Earlier Phase 2 changes remain uncommitted. The Phase 2A setup/resolver/network guards, Jest discovery and report database fixture were not changed. No production .env, migrations, seeds, real database, unsafe manual scripts, commits, pushes, merges or branch switches were used.

### Commands and evidence files

Backend commands used the installed Jest runner and the unchanged guarded configuration. They ran outside the previously diagnosed managed-sandbox native-path restriction under the normal user account.

```powershell
# Initial regression proof, executed before the production correction
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/report.service.test.js
# Final affected suites
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/report.service.test.js tests/unit/patrol/riskZone.service.test.js tests/unit/patrol/patrolNavigation.test.js tests/unit/patrol/patrol.lifecycle.test.js tests/unit/patrol/riskGeometry.test.js tests/unit/patrol/patrol.service.test.js tests/unit/incident/incident.service.test.js tests/unit/incident/incident.idempotency.test.js tests/unit/incident/evidenceUploadJobs.test.js
# Full safe backend suite
node node_modules/jest/bin/jest.js --runInBand
```

Local ignored evidence: `.cache/batch1-report-before.json` / `.log`, `batch1-first-targeted.json` / `.log`, `batch1-targeted.json` / `.log`, and `batch1-full.json` / `.log`. The two initial failures are preserved in the report-before files. Each B1 ID appears exactly once among final executed assertion results.

### Remaining gaps and stop point

The Batch 2 sensor/wildlife/UI work and unresolved access/data policy questions remain untouched. Web reports/downloads, remaining mobile API/storage branches and later validator/error-handler gaps remain as listed in the audit. This batch does not claim complete branch or line coverage, real PostgreSQL/provider testing, physical GPS/camera verification or device end-to-end coverage.

Stop after Batch 1. Await approval before Batch 2, coverage configuration or SOLID work.

## Checkpoint B — Batch 2 completed (13 October 2026)

This section supersedes the historical Batch 1 stop point above. Batch 2 implements wildlife/sensor service, repository, HTTP, dashboard and web tests from the approved audit. **146 meaningful tests were added: 69 backend, 50 web and 27 sensor dashboard.** An existing Ranger Tracking assertion was stabilized without changing its expectation or adding a test. No shared code, mobile dependency, lockfile or production package dependency was changed; mobile was not rerun in this batch.

### Module inventory and verification

| Application/module | Previously verified | Batch 2 additions and scenarios | Final verified result |
|---|---|---|---|
| Backend sensor service | No dedicated populated sensor suite | 24 direct tests: animal creation, duplicate rejection, update whitelist, Unknown collar, Date/coordinate handling, one-hour boundary, out-of-order characterization, ingestion/density/proximity/delete failures | 24 passed |
| Backend sensor repository/density | No dedicated density/query suite | 9 real calculation cases and 2 query-contract cases: minimum cluster, species separation, radius boundaries, separated clusters, frozen fixtures, missing metadata, NaN, repeated-animal records, latest/date selection | 11 passed |
| Backend sensor/risk HTTP | Empty monitoring API scaffold; Batch 1 already covered park-scoped patrol risk selection | Real app/router/controller/service/repository chain with only database mock: 20 sensor and 14 risk CRUD/fallback/query/error cases | 34 passed |
| Sensor dashboard | 3 isolation tests; no functional UI/API tests | 20 rendered App tests and 7 actual Axios adapter tests; species/codes, validation, maps, telemetry, mutation/reset/loading/error/cancellation and malformed data | 27 new + 3 preserved = 30 passed |
| Web WildlifeMonitoring and FieldMap | No dedicated functional suites | 10 monitoring and 6 map cases: statistics, density popups, historical selection, missing fixes, map properties/interactions, loading/error/partial failure and selection races | 16 passed |
| Web ZoneAlertProvider | Provider mocked or polling APIs mocked in existing application tests | 10 direct provider cases: entry boundary, inactivity, overlap, polling timing/cleanup, dismissal, partial/malformed failures and stale completions | 10 passed |
| Web Reporting risk operations | No dedicated risk CRUD functional suite | 12 UI cases: required fields, map-selected geometry, metadata edit, pending states, success/reset, error retention, cancellation and independent API failure | 12 passed |
| Web sensor/risk adapters | No dedicated sensor/risk adapter contract suite | 12 actual adapter tests: endpoints, date/radius params, mutation bodies/envelopes and propagated failures | 12 passed |
| Existing Web Ranger Tracking | 6 existing tests | Await GPS history in freshness test; unchanged Available and two-point assertions | 6 passed; no count increase |

The proposed audit filenames were organizational suggestions: the sensor unit suites live under `unit/sensor`, the combined HTTP suite under `integration/sensorRisk.api.test.js`, and dashboard UI under `dashboard.test.jsx`. This keeps HTTP tests in the existing local-server permission directory. No change to guard rules was necessary. No empty scaffold was treated as implemented coverage.

| Complete safe application suite | Before Batch 2 | Added | After Batch 2 | Test files/suites after | Failed / skipped / pending |
|---|---:|---:|---:|---:|---|
| Backend | 907 | 69 | **976 passed** | 49 Jest suites | 0 / 0 / 0 |
| Web | 234 | 50 | **284 passed** | 31 Vitest test files | 0 / 0 / 0 |
| Sensor dashboard | 3 | 27 | **30 passed** | 3 Vitest test files | 0 / 0 / 0 |
| Mobile | 531 last verified | 0 | Not executed in Batch 2 | — | No new result claimed |

The three complete suites actually rerun here contain **1,290 passing tests**. The most recent project totals, including the earlier mobile run, sum to 1,821; this is not a new four-application run. Targeted runs overlap the full suites and must not be added to them. Passing counts are not line/branch coverage; no coverage configuration or measurement was introduced.

### Demonstrated defects and smallest fixes

1. **Sensor dashboard list handling.** `loadAnimals` put any truthy `response.data` into array state. An object crashed `.map`; malformed individual records could crash `.match` during code generation or `.toFixed` in location cards. Failed list requests only logged, leaving the user without a visible failure. B2-SUI-17/18 failed before correction; B2-SUI-19/20 separately failed before record checks. The fix checks array shape, code/species string fields and finite location coordinates before publishing state, preserves a previously usable list on failure, and displays `Failed to load animals` while retaining the diagnostic. It does not change valid animal forms or API endpoints.
2. **Wildlife history selection.** Every history response wrote the same `routeLocations` state, regardless of the selected animal. Clearing the selector never removed prior history. B2-WILD-09/10 demonstrated both failures before correction. A selection effect now clears old history and invalidates its pending response on selection change/unmount; only the current effect publishes a response. Valid ordered history and request date/ID contracts remain unchanged.
3. **Zone polling races.** `checkZoneEntries` closed over the dismissed set and published every response. An older in-flight poll could restore a dismissed alert or overwrite a newer empty result. B2-ZONE-07/08 failed before correction. A monotonically increasing ref identifies the latest poll; effect cleanup invalidates pending work on dismissal or unmount. Only the latest active result updates alerts. The five-second cadence, inclusive distance rule, per-zone alerts and preserved-alert error behaviour remain unchanged.
4. **Existing Ranger Tracking timing test.** The first full web run passed 283 and failed 1. The freshness test waited for `A. Perera`, which belongs to the first patrol request, and immediately asserted GPS availability before the independent history request had resolved. The DOM showed the header with Unavailable GPS. The correction awaits `Recorded route (2 points)` before the same freshness assertion. Follow-up: all 6 existing tracking tests plus 12 adapter tests passed; the subsequent full web suite passed all 284. No production patrol logic changed.

The initial new web group also had an incorrect test label (`Verified Incidents` instead of the existing `Verified Incidents Reported`). The assertion was corrected to the existing label while preserving its count assertion; no application change was needed.

### Actual execution evidence

| Run | Actual result | Interpretation |
|---|---|---|
| First backend placement attempt | 34 unit passed; 30 HTTP failed with TEST_NETWORK_BLOCKED | Guard correctly denied a new HTTP file outside its permitted integration directory; moved tests into integration, without changing guard |
| Backend group after placement correction | 64 passed, 0 failed | Initial sensor/query/API group verified |
| Final affected backend group | 69 passed, 0 failed, 3 suites | Added exact density boundary and remaining failure paths |
| Dashboard UI before first source fix | 16 passed, 2 failed | Malformed array payload and invisible API-load failure reproduced |
| Selected malformed-record tests before record checks | 0 passed, 2 failed | Null code and nonnumeric location crashes reproduced; other 18 were excluded by the selection expression in this diagnostic run only |
| New web group before source fixes | 21 passed, 5 failed | Four stale/cleared-state regressions plus the incorrect label expectation |
| Final affected frontend groups | Web 50/0; sensor dashboard 30/0 | Includes all new cases and existing sensor isolation assertions |
| First complete web suite | 283 passed, 1 failed | Existing GPS-history readiness issue described above |
| Web follow-up | 18 passed, 0 failed | Corrected tracking suite plus adapter suite |
| Final UI assertion follow-up | Web 22/0; dashboard UI 20/0 | Added visible created/edited/deleted card assertions and independent inactive/outside/missing-fix checks; no count change |
| Final complete safe suites | Backend 976/0; web 284/0; sensor dashboard 30/0 | All discovered meaningful tests executed; none skipped/pending |

Commands used installed runners and the unchanged database/network guards. As in earlier phases, test execution used the normal account outside the managed sandbox's diagnosed native-path EPERM restriction, without administrator privileges or filesystem cleanup. Sensor JSX uses Vitest/Vite's existing esbuild transform, aliases to installed web dependencies and one React instance; no dependency installation or lockfile update was needed. An initial attempt to load the web React plugin in sensor configuration failed on Vite's `internal` export; the simpler esbuild transform resolved startup without altering production tooling.

```powershell
# Backend affected group, from backend
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/unit/sensor/sensor.service.test.js tests/unit/sensor/sensor.repository.test.js tests/integration/sensorRisk.api.test.js
# Complete guarded backend
node node_modules/jest/bin/jest.js --runInBand
# Web regression group, from web
node node_modules/vitest/vitest.mjs run tests/integration/wildlifeMonitoring.test.jsx tests/integration/zoneAlerts.test.jsx
# Web final affected group
node node_modules/vitest/vitest.mjs run tests/integration/wildlifeMonitoring.test.jsx tests/integration/zoneAlerts.test.jsx tests/integration/riskZoneReporting.test.jsx tests/foundation/wildlifeApi.test.jsx
# Existing GPS timing follow-up
node node_modules/vitest/vitest.mjs run tests/integration/rangerTracking.test.jsx tests/foundation/wildlifeApi.test.jsx
# Complete safe web
node node_modules/vitest/vitest.mjs run --maxWorkers=2
# Dashboard initial regression and selected record regression, from sensor-dashboard
node ../web/node_modules/vitest/vitest.mjs run --config vitest.config.mjs tests/dashboard.test.jsx
node ../web/node_modules/vitest/vitest.mjs run --config vitest.config.mjs tests/dashboard.test.jsx -t 'B2-SUI-19|B2-SUI-20'
# Complete safe dashboard
node ../web/node_modules/vitest/vitest.mjs run --config vitest.config.mjs --maxWorkers=2
```

Executed commands also used JSON reporters/output files and redirected logs to the ignored root `.cache`. Preserved JSON/log pairs: `batch2-backend-targeted`, `batch2-backend-full`, `batch2-sensor-before`, `batch2-sensor-record-before`, `batch2-sensor-targeted`, `batch2-sensor-ui-final`, `batch2-sensor-full`, `batch2-web-before`, `batch2-web-targeted`, `batch2-web-full-first`, `batch2-web-followup`, `batch2-web-ui-final`, `batch2-web-full`. Final case table was matched by ID against all three final JSON reports: 146 unique new executed IDs, all passed. `batch2-document.cjs` and `batch2-case-table.md` are ignored local table-generation evidence. The first backend placement/startup diagnostic was superseded in the targeted output files; its observed result is recorded above.

Baseline assertion comparison also confirms all 907 previous backend and 234 previous web cases remain passing. One unchanged incident-evidence test embeds its runtime `withdrawnAt` timestamp in its title; comparison normalized only that runtime title value. The final frontend suites were rerun after the stronger UI assertions above and retained the same zero-failure totals.

Final frontend logs contain no React act warning, unhandled-error warning or reported open-handle warning. Expected failure diagnostics are asserted with scoped, restored spies; they were not globally suppressed. Dashboard/provider timer cleanup is explicitly exercised. This does not claim exhaustive open-handle detection or actual map rendering in a browser.

### All repository files changed in Batch 2

1. `backend/tests/unit/sensor/sensor.service.test.js` — new, 24 cases.
2. `backend/tests/unit/sensor/sensor.repository.test.js` — new, 11 cases.
3. `backend/tests/integration/sensorRisk.api.test.js` — new, 34 cases; mock database, actual application chain.
4. `sensor-dashboard/vitest.config.mjs` — JSX discovery/transform and installed test dependency aliases; env loading remains disabled.
5. `sensor-dashboard/tests/ui-setup.js` — jest-dom matchers and RTL cleanup, alongside unchanged network setup.
6. `sensor-dashboard/tests/dashboard.test.jsx` — new, 20 actual UI cases with API/maps/dialog mocks.
7. `sensor-dashboard/tests/api.test.js` — new, 7 actual Axios wrapper cases.
8. `sensor-dashboard/src/App.jsx` — demonstrated malformed-response/load-error correction only.
9. `web/vite.config.js` — discover three new integration files; retain test env loading protection.
10. `web/tests/integration/wildlifeMonitoring.test.jsx` — new, 10 monitoring and 6 Field Map cases.
11. `web/tests/integration/zoneAlerts.test.jsx` — new, 10 provider cases.
12. `web/tests/integration/riskZoneReporting.test.jsx` — new, 12 risk CRUD UI cases.
13. `web/tests/foundation/wildlifeApi.test.jsx` — new, 12 actual Axios adapter cases.
14. `web/tests/integration/rangerTracking.test.jsx` — await independent history readiness in existing assertion; no test added/removed.
15. `web/src/pages/WildlifeMonitoring/WildlifeMonitoring.jsx` — invalidate stale history and clear old selection data.
16. `web/src/contexts/ZoneAlertContext.jsx` — invalidate stale/pending poll results.
17. `docs/testing-and-refactoring/PHASE_3_TEST_EXPANSION.md` — verified inventory, defects, evidence, complete case table and remaining decisions.

Earlier Phase 2 and Batch 1 changes remain uncommitted. They are not additional Batch 2 changes. Database/environment resolver sentinels, backend guard setup, shared network guard and existing isolation assertions remain untouched. Backend mock tests can only call mocked Prisma models; accidentally importing real database initialization still fails. Frontend transport calls are explicitly mocked; Leaflet/map tiles and browser dialogs are mocked in new functional tests. All three full suites include their existing isolation tests. No real database/provider requests, migrations, seeds, resets, unsafe scripts, secret reads, production `.env` edits, commits, pushes, merges or branch switches occurred.

### Remaining gaps and unresolved decisions

- **Security decision requiring confirmation:** sensor and risk-zone routers currently have no authentication middleware, and CRUD is callable without a token. HTTP tests deliberately characterize this current public contract, not an approved access policy. Confirm intended roles, park scoping, device ingestion credentials and reader/writer permissions before introducing restrictions. No authentication or access-policy source changes were made.
- **Out-of-order telemetry:** negative time differences satisfy `< one hour`, so an old event overwrites the latest location/timestamp. Decide whether to reject, append, or otherwise retain historical telemetry before changing this behaviour. Same-time events also update the latest row.
- **Density semantics:** calculation counts location records, including repeated records/codes for one animal, not distinct animals. Confirm deduplication/time-window/cluster requirements; existing UI wording says animals. The new characterization test exposes this discrepancy without silently redefining density.
- **Backend validation/error contracts:** missing/invalid telemetry data currently reaches persistence; these tests inject deterministic persistence failures, not real Prisma validation. Duplicate registration currently maps to a generic 500; missing risk-zone lookup maps to 200/null. Confirm intended field validation and client error contracts before expanding them. UI native required fields are not server validation. Risk CRUD likewise has no domain validator on these routes.
- **Risk deletion is not transactional:** related alerts are deleted before deleting the zone; a later zone-delete failure can leave those alerts removed. Tests verify the existing ordering and safe HTTP response, not transaction rollback. Real database foreign-key/cascade/transaction behaviour was not exercised.
- Wildlife monitoring uses an animal selector with species labels; it has no independent species filter to invent or test. Initial monitoring/map loads use aggregate Promise.all failure; route errors and provider poll errors have diagnostics but no dedicated retry control. These tests verify actual states, not proposed features.
- Missing field-map fixes are tested; full malformed-schema validation for every web monitoring/risk response remains a gap. Dashboard load shape checks cover the render/code-generation fields used here, not a complete server schema.
- New map UI tests mock Leaflet and tiles to verify data properties and popup/click interactions. Real tile delivery, map projection, physical devices, real sensor hardware, and PostgreSQL concurrency are outside these safe suites. Authorization denials cannot be meaningfully tested for public sensor/risk routes until policy is defined.
- Later report/export/auth lifecycle, mobile API/offline and remaining validator/service gaps remain for the approved later batches. No code coverage percentage is inferred.

Stop after Batch 2. Await approval before Batch 3, coverage configuration or SOLID refactoring.

### Batch 2 verified test-case table

Every B2 ID below represents an actually executed assertion. B2-REL-01 labels an existing corrected assertion and is excluded from the 146 new-test count. Characterization rows describe current behaviour and do not endorse unresolved policies.

| Test Case ID | Module | Scenario | Test Type | Input | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|---|---|---|---|
| B2-SVC-01 | Sensor service | Optional animal metadata | Positive | New ELE001/Elephant; omitted name/sex/notes | Insert metadata with null optional fields; return persisted animal | As expected in full safe suite | Pass |
| B2-SVC-02 | Sensor service | Duplicate animal code | Negative | ELE001 lookup already exists | Reject before create | As expected in full safe suite | Pass |
| B2-SVC-03 | Sensor service | Update field whitelist | Security/immutability | Frozen metadata plus alternate id/code | Only species/name/sex/notes forwarded; original input unchanged | As expected in full safe suite | Pass |
| B2-SVC-04 | Sensor service | Unknown collar ingestion | Positive | Unknown ELE001 with valid telemetry | Create Unknown animal then location bound to its ID | As expected in full safe suite | Pass |
| B2-SVC-05 | Sensor service | Timestamp and coordinate normalization | Boundary | 05:30+05:30 timestamp; latitude 7.512345 | UTC-equivalent Date; coordinate precision retained | As expected in full safe suite | Pass |
| B2-SVC-06 | Sensor service | Omitted telemetry timestamp | Edge | Fixed 2026-01-01 clock; timestamp undefined | Use fixed current Date | As expected in full safe suite | Pass |
| B2-SVC-07 | Sensor service | Below one-hour boundary | Boundary | Latest row plus 3,599,999 ms | Update latest row; no insert | As expected in full safe suite | Pass |
| B2-SVC-08 | Sensor service | Exact one-hour boundary | Boundary | Latest row plus 3,600,000 ms | Insert new row; no update | As expected in full safe suite | Pass |
| B2-SVC-09 | Sensor service | Above one-hour boundary | Boundary | Latest row plus 3,600,001 ms | Insert new row; no update | As expected in full safe suite | Pass |
| B2-SVC-10 | Sensor service | Same-time telemetry | Boundary | Latest row plus 0 ms | Update latest row | As expected in full safe suite | Pass |
| B2-SVC-11 | Sensor service | Out-of-order telemetry characterization | Characterization/negative | Latest row minus 1 ms | Existing implementation updates latest row to older timestamp; policy unresolved | As expected in full safe suite | Pass |
| B2-SVC-12 | Sensor service | Animal lookup failure | Error | findAnimalByCode rejects | Same error propagates; no update | As expected in full safe suite | Pass |
| B2-SVC-13 | Sensor service | Latest-location lookup failure | Error | findLatestLocationByAnimalId rejects | Same error propagates; no update | As expected in full safe suite | Pass |
| B2-SVC-14 | Sensor service | Location create failure | Error | createAnimalLocation rejects | Same error propagates; no update | As expected in full safe suite | Pass |
| B2-SVC-15 | Sensor service | Location update failure | Error | Existing latest row; update rejects | Reject without fallback insert | As expected in full safe suite | Pass |
| B2-SVC-16 | Sensor service | Invalid timestamp validation gap | Characterization/error | recordedAt invalid; persistence rejects | Invalid Date reaches mock persistence; error propagates | As expected in full safe suite | Pass |
| B2-SVC-17 | Sensor service | Missing coordinates validation gap | Characterization/error | Undefined lat/lng; persistence rejects | Undefined coordinates reach mock persistence; error propagates | As expected in full safe suite | Pass |
| B2-SVC-18 | Sensor service | Density service range and radius | Positive | Equal fixed bounds; radius 500; mock locations | Forward exact bounds/radius; return calculated zones | As expected in full safe suite | Pass |
| B2-SVC-19 | Sensor service | Density repository failure | Error | Location range query rejects | Reject before density calculation | As expected in full safe suite | Pass |
| B2-SVC-20 | Sensor service | No high-risk zones | Empty/query | No active HIGH/CRITICAL zones | Return 0; no animal query; verify zone selector | As expected in full safe suite | Pass |
| B2-SVC-21 | Sensor service | Overlapping risk zones | Edge | Two overlapping zones; colocated, missing and distant latest fixes | Count colocated animal once; ignore old inside fix of distant animal | As expected in full safe suite | Pass |
| B2-SVC-22 | Sensor service | Inclusive proximity and invalid fix | Boundary/negative | Zero radius at origin; one exact fix and one NaN fix | Count exact center only | As expected in full safe suite | Pass |
| B2-SVC-23 | Sensor service | Proximity repository failure | Error | Zone query rejects | Propagate query error | As expected in full safe suite | Pass |
| B2-SVC-24 | Sensor service | Animal delete failure | Error | Related-data constraint mock rejects delete(a) | Propagate error; preserve requested ID | As expected in full safe suite | Pass |
| B2-DEN-01 | Wildlife density | Minimum cluster threshold | Boundary/negative | Two colocated Elephant records | No density zone | As expected in full safe suite | Pass |
| B2-DEN-02 | Wildlife density | Populated density cluster | Positive/immutability | Three frozen colocated Elephant records | One zone; count 3; correct center/radius/codes; no fixture mutation | As expected in full safe suite | Pass |
| B2-DEN-03 | Wildlife density | Species and metadata isolation | Negative | Two Elephants, one Leopard, one null animal | No mixed-species or missing-metadata cluster | As expected in full safe suite | Pass |
| B2-DEN-04 | Wildlife density | Outside density radius | Boundary/negative | Two origin records; third 1 degree away | No cluster within 300 m | As expected in full safe suite | Pass |
| B2-DEN-05 | Wildlife density | Zero-radius density | Boundary | Three identical coordinates; radius 0 | Cluster includes all three | As expected in full safe suite | Pass |
| B2-DEN-06 | Wildlife density | Records versus distinct animals | Characterization | Three records with same code A | Current count 3 and codes A/A/A; distinct-animal policy unresolved | As expected in full safe suite | Pass |
| B2-DEN-07 | Wildlife density | Invalid location exclusion | Negative | Two valid records; third latitude NaN | Invalid record cannot form three-record zone | As expected in full safe suite | Pass |
| B2-DEN-08 | Wildlife density | Separated same-species clusters | Positive/edge | Three origin and three latitude-1 records | Two independent centers at 0 and 1 | As expected in full safe suite | Pass |
| B2-DEN-09 | Wildlife density | Exact nonzero distance boundary | Boundary | Third latitude 0.001; computed Haversine radius, then minus 0.000001 m | Exact radius includes third record; smaller radius yields no zone | As expected in full safe suite | Pass |
| B2-REPO-01 | Sensor repository queries | Latest-location query contracts | Query/positive | Animal a; list with and without collars | Descending latest timestamps; take 1; correct collar inclusion | As expected in full safe suite | Pass |
| B2-REPO-02 | Sensor repository queries | Date query bounds and scope | Query/boundary | Animal a; 1–2 January 2026 | Both gte/lte retained; ascending results; global query includes animal | As expected in full safe suite | Pass |
| B2-API-01 | Sensor HTTP API | Public animal registration | Integration/positive | ELE001/Elephant/Nila; no authorization header | 201 persisted envelope and null optional sex | As expected in full safe suite | Pass |
| B2-API-02 | Sensor HTTP API | Duplicate registration contract | Integration/negative | ELE001 already exists | Current sanitized 500 contract; no insert | As expected in full safe suite | Pass |
| B2-API-03 | Sensor HTTP API | Telemetry timestamp normalization | Integration/positive | Numeric coordinates; timezone-equivalent timestamp | 201; UTC timestamp; coordinates/source preserved | As expected in full safe suite | Pass |
| B2-API-04 | Sensor HTTP API | Animal update whitelist | Integration/security | Update a with species/name and BAD code | 200; only metadata persisted, no code change | As expected in full safe suite | Pass |
| B2-API-05 | Sensor HTTP API | Public animal deletion | Integration/positive | DELETE animal a; no authorization header | 200 with deleted animal; exact repository ID | As expected in full safe suite | Pass |
| B2-API-06 | Sensor HTTP API | Latest locations route precedence | Integration/query | GET animals/locations | Specific route returns animals; latest-only query | As expected in full safe suite | Pass |
| B2-API-07 | Sensor HTTP API | Scoped inclusive location range | Integration/boundary | Animal a; equal start/end timestamp | 200 empty envelope; normalized gte/lte and animal identity | As expected in full safe suite | Pass |
| B2-API-08 | Sensor HTTP API | Real density calculation through API | Integration/positive | Three colocated Elephant rows; radius 450 | 200 one zone with exact center/count/codes/radius | As expected in full safe suite | Pass |
| B2-API-09 | Sensor HTTP API | Risk proximity count envelope | Integration/positive | One animal at active high-risk center | 200 success with data.count 1 | As expected in full safe suite | Pass |
| B2-API-10 | Sensor HTTP API | Missing telemetry data | Characterization/error | Empty body; location persistence rejects | Current sanitized 500; no service validation before persistence | As expected in full safe suite | Pass |
| B2-API-11 | Sensor HTTP API | Invalid telemetry coordinate | Characterization/error | Latitude invalid string; persistence rejects | Current sanitized 500; no private database detail | As expected in full safe suite | Pass |
| B2-API-12 | Sensor HTTP API | Invalid telemetry timestamp | Characterization/error | recordedAt invalid; persistence rejects | Current sanitized 500; no private database detail | As expected in full safe suite | Pass |
| B2-API-13 | Sensor HTTP API | Animal list query failure | Integration/error | GET animals; findMany rejects | 500 safe generic envelope | As expected in full safe suite | Pass |
| B2-API-14 | Sensor HTTP API | Latest list query failure | Integration/error | GET animals/locations; findMany rejects | 500 safe generic envelope | As expected in full safe suite | Pass |
| B2-API-15 | Sensor HTTP API | Global history query failure | Integration/error | GET locations with bounds; query rejects | 500 safe generic envelope | As expected in full safe suite | Pass |
| B2-API-16 | Sensor HTTP API | Density query failure | Integration/error | GET zones/density with bounds; query rejects | 500 safe generic envelope | As expected in full safe suite | Pass |
| B2-API-17 | Sensor HTTP API | Proximity query failure | Integration/error | GET near-high-risk-zones; query rejects | 500 safe generic envelope | As expected in full safe suite | Pass |
| B2-API-18 | Sensor HTTP API | Animal update persistence failure | Integration/error | PUT animal a; repository rejects | 500 with no private constraint detail | As expected in full safe suite | Pass |
| B2-API-19 | Sensor HTTP API | Animal delete persistence failure | Integration/error | DELETE animal a; repository rejects | 500 with no private constraint detail | As expected in full safe suite | Pass |
| B2-API-20 | Sensor HTTP API | Malformed JSON protection | Integration/negative | POST telemetry body { with JSON content type | 400 Invalid request body; no database mock calls | As expected in full safe suite | Pass |
| B2-RAPI-01 | Risk-zone HTTP API | Default park fallback | Integration/positive | Public POST with default-park-id; first park p | 200; persisted park p; fallback lookup once | As expected in full safe suite | Pass |
| B2-RAPI-02 | Risk-zone HTTP API | Explicit park selection | Integration/positive | POST parkId specific | Preserve supplied park; no first-park lookup | As expected in full safe suite | Pass |
| B2-RAPI-03 | Risk-zone HTTP API | No available park | Integration/negative | Missing parkId; first park null | 400 No parks available; no zone create | As expected in full safe suite | Pass |
| B2-RAPI-04 | Risk-zone HTTP API | Active risk-zone query | Integration/query | Public GET risk-zones | Success list; where active true, createdAt descending | As expected in full safe suite | Pass |
| B2-RAPI-05 | Risk-zone HTTP API | Missing risk-zone contract | Characterization/empty | GET missing ID; repository returns null | Current 200 success/data null; no invented 404 | As expected in full safe suite | Pass |
| B2-RAPI-06 | Risk-zone HTTP API | Editable risk-zone update | Integration/positive | PUT z name/CRITICAL/inactive | 200; exact route ID and supplied mutation data | As expected in full safe suite | Pass |
| B2-RAPI-07 | Risk-zone HTTP API | Related alert deletion order | Integration/positive | DELETE z with two related alert mocks | 200; deleteMany(z) before riskZone.delete(z) | As expected in full safe suite | Pass |
| B2-RAPI-08 | Risk-zone HTTP API | Related alert deletion failure | Integration/error | deleteMany rejects | 500; no riskZone.delete | As expected in full safe suite | Pass |
| B2-RAPI-09 | Risk-zone HTTP API | Risk-zone creation failure | Integration/error | POST valid zone; create rejects | 500 safe generic envelope | As expected in full safe suite | Pass |
| B2-RAPI-10 | Risk-zone HTTP API | Risk-zone list failure | Integration/error | GET list; findMany rejects | 500 safe generic envelope | As expected in full safe suite | Pass |
| B2-RAPI-11 | Risk-zone HTTP API | Risk-zone lookup failure | Integration/error | GET z; findUnique rejects | 500 safe generic envelope | As expected in full safe suite | Pass |
| B2-RAPI-12 | Risk-zone HTTP API | Risk-zone update failure | Integration/error | PUT z; update rejects | 500 safe generic envelope | As expected in full safe suite | Pass |
| B2-RAPI-13 | Risk-zone HTTP API | Risk-zone deletion failure | Integration/error | DELETE z; zone delete rejects after alert deletion | 500 safe envelope; existing non-transactional sequence characterized | As expected in full safe suite | Pass |
| B2-RAPI-14 | Risk-zone HTTP API | Fallback park query failure | Integration/error | POST missing parkId; first-park lookup rejects | 500; no zone create | As expected in full safe suite | Pass |
| B2-SUI-01 | Sensor dashboard UI | Latest and missing location cards | UI/positive/empty | Elephant latest fix; Leopard without locations | One formatted location; both cards remain usable | As expected in full safe suite | Pass |
| B2-SUI-02 | Sensor dashboard UI | Maximum matching generated code | UI/boundary | ELE009, ELE002, custom Elephant code and LEO002 | Elephant ELE010; Leopard LEO003 | As expected in full safe suite | Pass |
| B2-SUI-03 | Sensor dashboard UI | First code and empty species | UI/boundary | No animals; select Elephant then empty species | ELE001 then empty code | As expected in full safe suite | Pass |
| B2-SUI-04 | Sensor dashboard UI | Required registration fields | UI/negative | Empty form; click Register Animal | Native validity false; no API request | As expected in full safe suite | Pass |
| B2-SUI-05 | Sensor dashboard UI | Registration lifecycle | UI/positive/async | Elephant/New/tracked; deferred create | Exact ELE010 metadata; disabled pending; success, reset and reload | As expected in full safe suite | Pass |
| B2-SUI-06 | Sensor dashboard UI | Registration failure | UI/error | Duplicate-code server rejection | Display error; preserve ELE010; enable retry; no reload | As expected in full safe suite | Pass |
| B2-SUI-07 | Sensor dashboard UI | Species-dependent collar choices | UI/filtering | Select Elephant/collar then Leopard | Only selected species options; clear previous collar | As expected in full safe suite | Pass |
| B2-SUI-08 | Sensor dashboard UI | Map-selected telemetry submission | UI/positive | Map 7.5/80.7; BPM 60/temp37.5/WALKING/local fixed timestamp | Numeric payload and ISO timestamp; success; clear marker/form; reload | As expected in full safe suite | Pass |
| B2-SUI-09 | Sensor dashboard UI | Telemetry failure | UI/error | Filled telemetry; API offline | Visible error; retain marker/BPM; no reload | As expected in full safe suite | Pass |
| B2-SUI-10 | Sensor dashboard UI | Required telemetry fields | UI/negative | Valid collar/map but empty heart rate | Native invalid form; no submission | As expected in full safe suite | Pass |
| B2-SUI-11 | Sensor dashboard UI | Animal edit success | UI/positive | Open ELE009; change Nila to Updated | Code disabled; metadata-only update(a); close and reload | As expected in full safe suite | Pass |
| B2-SUI-12 | Sensor dashboard UI | Animal edit failure | UI/error | Update API offline | Error visible; modal remains open; no reload | As expected in full safe suite | Pass |
| B2-SUI-13 | Sensor dashboard UI | Cancelled animal edit | UI/negative | Open card then Cancel | Close modal without update request | As expected in full safe suite | Pass |
| B2-SUI-14 | Sensor dashboard UI | Cancelled deletion | UI/negative | Confirm dialog false | No delete request; no accidental edit modal | As expected in full safe suite | Pass |
| B2-SUI-15 | Sensor dashboard UI | Confirmed deletion and message expiry | UI/positive/boundary | Confirm true; advance timer 3000 ms | delete(a); reload; success then expired message | As expected in full safe suite | Pass |
| B2-SUI-16 | Sensor dashboard UI | Deletion error | UI/error | Confirm true; API constraint error | Visible error; keep card; no reload | As expected in full safe suite | Pass |
| B2-SUI-17 | Sensor dashboard UI | Malformed list payload | UI/regression/error | Response data is object instead of array | Visible load error; form usable; diagnostic retained | Failed before fix; passed after | Pass |
| B2-SUI-18 | Sensor dashboard UI | Animal list request failure | UI/regression/error | getAllAnimals rejects offline | Visible load error; no invented cards; exact diagnostic | Failed before fix; passed after | Pass |
| B2-SUI-19 | Sensor dashboard UI | Missing animal code in record | UI/regression/error | Animal with null animalCode | Reject malformed list; generation still works from safe empty state | Failed before fix; passed after | Pass |
| B2-SUI-20 | Sensor dashboard UI | Malformed location record | UI/regression/error | Location null latitude/string longitude | Load error; no toFixed crash; form usable | Failed before fix; passed after | Pass |
| B2-SAPI-01 | Sensor dashboard API adapter | Telemetry adapter | Unit/API | Valid telemetry DTO | POST /sensors with unchanged body; unwrap envelope | As expected in full safe suite | Pass |
| B2-SAPI-02 | Sensor dashboard API adapter | Animal registration adapter | Unit/API | ELE001/Elephant DTO | POST /sensors/animals; unchanged body; unwrap | As expected in full safe suite | Pass |
| B2-SAPI-03 | Sensor dashboard API adapter | Animal list adapter | Unit/API | getAllAnimals() | GET /sensors/animals; unwrap | As expected in full safe suite | Pass |
| B2-SAPI-04 | Sensor dashboard API adapter | Animal update adapter | Unit/API | a plus name Nila | PUT /sensors/animals/a; unchanged metadata; unwrap | As expected in full safe suite | Pass |
| B2-SAPI-05 | Sensor dashboard API adapter | Animal deletion adapter | Unit/API | Animal a | DELETE /sensors/animals/a; unwrap | As expected in full safe suite | Pass |
| B2-SAPI-06 | Sensor dashboard API adapter | Adapter request error | Unit/error | Telemetry POST timeout | Same error reaches caller; no invented success | As expected in full safe suite | Pass |
| B2-SAPI-07 | Sensor dashboard API adapter | Malformed adapter response | Unit/negative | Envelope data {} | Preserve malformed payload for UI validation | As expected in full safe suite | Pass |
| B2-WILD-01 | Web wildlife monitoring | Monitoring loading state | UI/async | Pending animal request | Loading visible until promise settles | As expected in full safe suite | Pass |
| B2-WILD-02 | Web wildlife monitoring | Statistics and density popup | UI/positive | 2 animals, 1 near-risk, 4 verified incidents, density count3 | Correct cards, radius300 and visible popup codes/count | As expected in full safe suite | Pass |
| B2-WILD-03 | Web wildlife monitoring | Empty monitoring datasets | UI/empty | Empty animals and density arrays | Empty density message; placeholder-only selector | As expected in full safe suite | Pass |
| B2-WILD-04 | Web wildlife monitoring | Deterministic history bounds | UI/query/boundary | Clock 4 January 2026 | Density requested 1–4 January UTC; radius300 | As expected in full safe suite | Pass |
| B2-WILD-05 | Web wildlife monitoring | Scoped route display | UI/positive | Animal a; two ordered recorded fixes | Polyline preserves positions; two point markers; ID/date request | As expected in full safe suite | Pass |
| B2-WILD-06 | Web wildlife monitoring | Missing animal history | UI/empty | Select b; history empty | Missing-location message; no route | As expected in full safe suite | Pass |
| B2-WILD-07 | Web wildlife monitoring | History request failure | UI/error | Selected history API rejects | Statistics remain; exact diagnostic; no aggregate load failure | As expected in full safe suite | Pass |
| B2-WILD-08 | Web wildlife monitoring | Partial initial API failure | UI/error | Density request fails; others succeed | Aggregate load error; no invented statistics | As expected in full safe suite | Pass |
| B2-WILD-09 | Web wildlife monitoring | Stale selected-animal response | UI/regression/async | a pending; b resolves with latitude8; a completes late | b route remains selected; old result ignored | Failed before fix; passed after | Pass |
| B2-WILD-10 | Web wildlife monitoring | Clearing animal selection | UI/regression | Loaded a route; select empty option | Remove previously displayed route | Failed before fix; passed after | Pass |
| B2-MAP-01 | Web Field Map | Latest wildlife markers and popup | UI/positive | One latest fix; one missing; lowercase elephant species | One marker at 7.5/80.7 with Elephant icon; open popup shows telemetry | As expected in full safe suite | Pass |
| B2-MAP-02 | Web Field Map | Risk geometry and styling | UI/positive | HIGH Waterhole center7.5/80.7 radius100 | Circle geometry and red style match data; name visible | As expected in full safe suite | Pass |
| B2-MAP-03 | Web Field Map | No animal fixes | UI/empty | Animal without locations | No markers; empty-location message | As expected in full safe suite | Pass |
| B2-MAP-04 | Web Field Map | Map load remains pending | UI/async | Risk API pending | Loading displayed; map withheld until completion | As expected in full safe suite | Pass |
| B2-MAP-05 | Web Field Map | Partial map API failure | UI/error | Risk API offline | Load error; no map; exact diagnostic | As expected in full safe suite | Pass |
| B2-MAP-06 | Web Field Map | Malformed animal envelope | UI/negative | Animal data {} | Safe load error; no fabricated markers; TypeError diagnosed | As expected in full safe suite | Pass |
| B2-ZONE-01 | Web ZoneAlertProvider | Inclusive zone entry | Unit/UI/boundary | Animal at zero-radius active HIGH center | Alert key a-z with HIGH level | As expected in full safe suite | Pass |
| B2-ZONE-02 | Web ZoneAlertProvider | Inactive and unavailable locations | Unit/negative | Active zone at origin; inactive zone at outside animal; missing and outside fixes | No outside/inactive alerts or missing-fix diagnostic | As expected in full safe suite | Pass |
| B2-ZONE-03 | Web ZoneAlertProvider | Overlapping alert identities | Unit/edge | One animal in HIGH z and CRITICAL other | Distinct a-z and a-other alerts | As expected in full safe suite | Pass |
| B2-ZONE-04 | Web ZoneAlertProvider | Polling timing and cleanup | Unit/boundary/cleanup | Advance 4999 then 1 ms; animal departs; unmount | No early poll; poll at5000 removes alert; no later calls/timers | As expected in full safe suite | Pass |
| B2-ZONE-05 | Web ZoneAlertProvider | Persistent dismissal | Unit/positive | Dismiss a-z then next poll | Dismissed alert remains absent | As expected in full safe suite | Pass |
| B2-ZONE-06 | Web ZoneAlertProvider | Partial poll failure | Unit/error | Risk query fails after existing alert | Preserve alert; exact error diagnostic | As expected in full safe suite | Pass |
| B2-ZONE-07 | Web ZoneAlertProvider | Dismissal versus pending poll | Unit/regression/async | Older poll pending while a-z dismissed | Late poll cannot restore dismissed alert | Failed before fix; passed after | Pass |
| B2-ZONE-08 | Web ZoneAlertProvider | Overlapping poll ordering | Unit/regression/async | Older poll pending; newer poll returns no animals | Older completion cannot restore departed-animal alert | Failed before fix; passed after | Pass |
| B2-ZONE-09 | Web ZoneAlertProvider | Missing provider contract | Unit/negative | Hook used outside provider | Throw documented provider-required error | As expected in full safe suite | Pass |
| B2-ZONE-10 | Web ZoneAlertProvider | Malformed polling array | Unit/error | Animal response data {} after existing alert | Preserve alert; report diagnostic instead of publishing false data | As expected in full safe suite | Pass |
| B2-REP-01 | Web risk-zone Reporting UI | Risk loading and populated list | UI/positive | Waterhole zone with center/radius | Loading then formatted coordinates/radius | As expected in full safe suite | Pass |
| B2-REP-02 | Web risk-zone Reporting UI | Required creation fields | UI/negative | Empty risk form | Native invalid; no create request | As expected in full safe suite | Pass |
| B2-REP-03 | Web risk-zone Reporting UI | Map-selected zone creation | UI/positive | New habitat/CRITICAL/radius250; map7.5/80.7 | Numeric geometry plus placeholder park; success, reset and reload | As expected in full safe suite | Pass |
| B2-REP-04 | Web risk-zone Reporting UI | Pending creation | UI/async | Deferred create request | Disable submit while pending; enable when resolved | As expected in full safe suite | Pass |
| B2-REP-05 | Web risk-zone Reporting UI | Creation failure | UI/error | Server Cannot save | Error visible; keep input; no reload | As expected in full safe suite | Pass |
| B2-REP-06 | Web risk-zone Reporting UI | Zone edit metadata contract | UI/positive | Change Waterhole name and active to false | ID-bound metadata update; geometry omitted; close modal | As expected in full safe suite | Pass |
| B2-REP-07 | Web risk-zone Reporting UI | Cancelled zone edit | UI/negative | Open editor then Cancel | Close without request | As expected in full safe suite | Pass |
| B2-REP-08 | Web risk-zone Reporting UI | Zone edit failure | UI/error | Update offline | Error visible; modal open; no reload | As expected in full safe suite | Pass |
| B2-REP-09 | Web risk-zone Reporting UI | Cancelled zone deletion | UI/negative | Confirm false | No delete or editor action | As expected in full safe suite | Pass |
| B2-REP-10 | Web risk-zone Reporting UI | Confirmed deletion and expiry | UI/positive/boundary | Confirm true; advance3000 ms | delete(z); reload; success expires | As expected in full safe suite | Pass |
| B2-REP-11 | Web risk-zone Reporting UI | Zone deletion failure | UI/error | Delete offline | Keep zone and show error; no reload | As expected in full safe suite | Pass |
| B2-REP-12 | Web risk-zone Reporting UI | Independent incident failure | UI/error/partial | Incident API fails; risk list succeeds | Risk zones usable; exact incident diagnostic | As expected in full safe suite | Pass |
| B2-WAPI-01 | Web wildlife/risk API adapters | Animal list endpoint | Unit/API | getAllAnimals() | GET /sensors/animals; unwrap envelope | As expected in full safe suite | Pass |
| B2-WAPI-02 | Web wildlife/risk API adapters | Latest animal endpoint | Unit/API | getAnimalsWithLatestLocations() | GET /sensors/animals/locations; unwrap | As expected in full safe suite | Pass |
| B2-WAPI-03 | Web wildlife/risk API adapters | Proximity count endpoint | Unit/API | getAnimalsNearHighRiskZones() | GET /sensors/animals/near-high-risk-zones; unwrap | As expected in full safe suite | Pass |
| B2-WAPI-04 | Web wildlife/risk API adapters | Risk list endpoint | Unit/API | getAllRiskZones() | GET /risk-zones; unwrap | As expected in full safe suite | Pass |
| B2-WAPI-05 | Web wildlife/risk API adapters | Animal history query params | Unit/API | a and literal from/to date arguments | Scoped history endpoint; both params forwarded unchanged | As expected in full safe suite | Pass |
| B2-WAPI-06 | Web wildlife/risk API adapters | Global history query params | Unit/API | Literal from/to date arguments | Global locations endpoint; both params forwarded unchanged | As expected in full safe suite | Pass |
| B2-WAPI-07 | Web wildlife/risk API adapters | Density radius defaults | Unit/boundary | from/to; radius omitted then500 | Same density endpoint with radius300 then500 | As expected in full safe suite | Pass |
| B2-WAPI-08 | Web wildlife/risk API adapters | Risk create endpoint | Unit/API | name Waterhole | POST risk-zones with unchanged payload; unwrap | As expected in full safe suite | Pass |
| B2-WAPI-09 | Web wildlife/risk API adapters | Risk update endpoint | Unit/API | z plus CRITICAL | PUT risk-zones/z with unchanged payload; unwrap | As expected in full safe suite | Pass |
| B2-WAPI-10 | Web wildlife/risk API adapters | Risk delete endpoint | Unit/API | Zone z | DELETE risk-zones/z; unwrap | As expected in full safe suite | Pass |
| B2-WAPI-11 | Web wildlife/risk API adapters | Risk write failure | Unit/error | POST rejects network denied | Same error propagates to form | As expected in full safe suite | Pass |
| B2-WAPI-12 | Web wildlife/risk API adapters | Wildlife query failure | Unit/error | GET rejects timeout | Same error propagates; no fabricated empty data | As expected in full safe suite | Pass |
| B2-REL-01 | Existing Ranger Tracking test | Await separate GPS-history readiness | Test setup/async | Patrol header resolves before history | Await two-point route before unchanged Available assertion | Failed in first full run; passed after test correction | Pass |

## Checkpoint B — Batch 3 implementation and evidence (13 October 2026)

Batch 3 adds **120 new web tests**, with unique B3 IDs in executed assertion names. It covers actual report requests/download resources, report page generation/filters/authorization, PDF adapter mapping, authentication lifecycle and Axios interceptors, user/park/patrol/incident/community contracts, health hooks and missing management-page states. No Batch 4, code coverage configuration, dependency installation or SOLID work was undertaken.

### Module inventory

| Module | New cases | Verified behaviour |
|---|---:|---|
| Conservation API/download | 20 | Allowed filters/types, signal forwarding, malformed envelopes, HTTP errors, authenticated fetch, encoded URLs, server/fallback filenames, blob errors, object URL/anchor lifecycle, Sri Lanka date boundaries |
| Conservation report page | 19 | Three implemented report types, approved-manager access, filter preservation/reset, equal/reversed dates, populated/empty/loading/error/retry states, PDF/CSV adapters, repeated submissions, cancellation, type/clear races and export consistency |
| PDF generator | 9 | Incident/patrol/conflict record mapping, zero/null/invalid date values, metrics, empty tables, A4 settings, metadata, footer pages, continuation callback, overflow, zero-count bar geometry, fallback and save error |
| Authentication lifecycle | 20 | Stored/no/failed sessions, login/logout, exact/already expired JWT boundaries, opaque token behaviour, response interceptors, timer/interceptor cleanup and overlapping restore/login transitions |
| Actual Axios client | 4 | Header/signal snapshot, pre-aborted requests, adapter rejection and delayed old-session 401 through the real interceptor chain |
| User/park/patrol/incident/community adapters | 27 | Whitelisted/default filters, encoded route IDs, conditional park assignment, mutation payloads, empty/malformed envelopes, conflict/error propagation, large/missing incident page safeguards, cancellation and mark-done contracts |
| API health hook | 6 | Checking/connected/unavailable, failed/malformed replies, network failure, unmount abort and ignored late completion |
| Community management page | 5 | Empty controls, retry, page/filter reset, cancelled/stale lists, reversed range |
| Incident review page | 3 | Sanitized detail failure/retry, selected-patrol ownership and unmount abort |
| Manager dashboard/analytics | 3 | Independent KPI failure/retry, old filter results ignored, all four requests aborted on unmount |
| Protected report navigation | 3 | Anonymous login redirect, Ranger profile redirect, JWT expiry returning a protected route to login |
| Patrol management page | 1 | Last-page Next/Previous boundary while preserving displayed patrol |

Existing manager, review, community, analytics and patrol positive/filter/retry scenarios were reused rather than duplicated. The new assertions extend their real suites. The seven new foundation files are discovered by the existing glob; no configuration or test script change was required.

### Demonstrated application defects and justified corrections

All source fixes follow failing regressions; only three production web files changed.

- **Download resource leak — B3-RAPI-14.** If the browser save action threw, the anchor and allocated object URL remained. `conservationReportApi.js` now removes the anchor and revokes the URL in `finally`, preserving the original error and successful filename/authentication behaviour.
- **Report-date validation — B3-RUI-12.** Date input min/max attributes did not prevent Generate: these controls are outside a native form. A reversed range reached the API. `ConservationReports.jsx` now rejects it with a visible error before requesting a report. Equal dates still produce the full inclusive Sri Lanka calendar day.
- **Report generation races — B3-RUI-13/14.** Switching type or clearing filters did not invalidate a pending result, so an old incident response could appear under the new selection. Those actions now abort the current request and reset loading; result/error/finally publication checks the signal, including mocks/adapters that resolve despite abort. Unmount cancellation remains implemented.
- **CSV/preview mismatch — B3-RUI-15.** Editing filters after generating a preview changed the CSV request while the PDF still used the displayed data. The page now retains the successful generation parameters and uses them for CSV export, so both export paths correspond to the preview. Generating again updates the saved parameters.
- **Authentication transition races — B3-AUTH-14/15/16.** Old restoration success could undo logout; unmounted restoration failure could clear another session; pending login success could undo logout. A session version ref invalidates prior work when login/logout/interceptor invalidation occurs. Restoration failure checks both active lifetime and version. Successful login still installs the returned user/token/header and failures propagate.
- **Stale authentication loading — B3-AUTH-19/20.** A completed new login or explicit logout remained in restoration loading until an old request settled. These explicit transitions now finish loading immediately. Their regressions failed 18-pass/2-fail before the two loading-state corrections.
- **Actual Axios stale-session invalidation — B3-CLIENT-04.** A request created under an old Authorization header could later return 401 and clear a newer login through the installed response interceptor. The interceptor now invalidates only a matching current header (or the existing no-header error contract); the old request still rejects. The regression uses actual Axios with a deterministic adapter and validates captured request headers. Current-session 401 and ACCOUNT_NOT_APPROVED behaviour, ordinary 403 preservation, and interceptor ejection remain verified.

No authorization role, backend API status, report type or server policy was invented. PDF remains client-generated with jsPDF from preview data; the existing API helper's direct PDF-format export fallback is HTML, characterized separately.

### Investigation and test-setup corrections

- Initial report/auth group: **29 passed, 6 failed**. Three were genuine restore/download defects. Three timer assertions incorrectly assumed every scheduled timer belonged to expiry. The checks now verify the exact two-second application timer and its cleanup, the exact expiry transition/session removal, and opaque-token persistence after advancing time. No application expiry assertion was removed to force success.
- Page/auth regression run: **21 passed, 10 failed** before corrections. It included the three timer-harness assumptions, three authentication races and four report date/race/consistency failures. These reports remain preserved.
- Initial page additions expected pagination buttons on an empty community list and an incident-specific filter during a loading panel. The implementation hides those controls in those states. The assertions were corrected to verify their absence and to use the available global area filter for the response race. A chart-label assertion was scoped to its span rather than an identically labelled filter option. These were incorrect new test expectations, not production defects.
- The first actual-Axios probe returned **4 passed**: the initial restoration request starts before the provider registers its response interceptor, so it did not exercise that chain. The proposed interceptor comparison was removed, then the corrected test launched a health request after registration. This produced **3 passed, 1 failed** with the newer user cleared. Only after that proof was the comparison applied and verified. Both probe reports are retained; the passing initial probe is not claimed as defect proof.

### Actual execution results

| Execution | Passed | Failed | Scope |
|---|---:|---:|---|
| Initial report/API/auth regressions | 29 | 6 | 2 files, before corrections |
| Page/auth regressions | 21 | 10 | 2 files, before corrections |
| Initial corrected report/auth group | 51 | 0 | 3 files |
| PDF/adapters/health group | 42 | 0 | 3 files |
| Expanded new foundation group | 99 | 0 | 6 files, before loading-boundary additions |
| Authentication loading proof | 18 | 2 | 1 file, before loading corrections |
| All affected suites before actual-client addition | 187 | 0 | 11 files, existing tests included |
| First complete safe web suite | 400 | 0 | 37 files, before actual-client addition |
| Corrected actual-Axios regression before source fix | 3 | 1 | 1 file |
| Final actual-client/auth/protected-route group | 50 | 0 | 3 files |
| Final complete safe web suite | **404** | **0** | **38 files; zero skipped/pending** |

Web increases from **284 to 404: exactly 120 added tests**. Targeted executions overlap the full suite and are not additive. All 284 previous passing assertion names are matched in the final passing report. Final logs contain no React act, unhandled-error or reported open-handle warnings; this is not an exhaustive open-handle audit. Backend **976**, sensor dashboard **30**, and mobile **531** remain their earlier verified results, not new executions here: only web-local source/tests changed, with no shared source/dependency changes. No line/branch coverage measurement or percentage is claimed.

Complete-suite and affected-group commands used the installed Vitest runner, unchanged network guard and test-mode environment isolation. Execution used the normal account outside the previously diagnosed managed-sandbox native-path EPERM restriction; no administrator access or deletion was needed.

```powershell
# From web: report/auth proof and affected group
node node_modules/vitest/vitest.mjs run tests/foundation/conservationReportApi.test.jsx tests/foundation/conservationReports.test.jsx tests/foundation/authLifecycle.test.jsx
# PDF/service/health group
node node_modules/vitest/vitest.mjs run tests/foundation/reportPdf.test.jsx tests/foundation/serviceContracts.test.jsx tests/foundation/apiHealth.test.jsx
# Management pages, routing and patrol boundaries
node node_modules/vitest/vitest.mjs run tests/integration/communityReportManagement.test.jsx tests/integration/incidentReview.test.jsx tests/integration/analyticsDashboard.test.jsx tests/integration/patrolList.test.jsx tests/foundation/app.test.jsx
# Actual Axios regression and affected authentication/routing
node node_modules/vitest/vitest.mjs run tests/foundation/apiClient.test.jsx tests/foundation/authLifecycle.test.jsx tests/foundation/app.test.jsx
# Final complete safe suite
node node_modules/vitest/vitest.mjs run --maxWorkers=2
```

Commands additionally wrote JSON reports and redirected logs into ignored `.cache`. JSON/log pairs: `batch3-first-before`, `batch3-page-auth-before`, `batch3-report-auth-targeted`, `batch3-adapters-targeted`, `batch3-pages-targeted`, `batch3-foundation-targeted`, `batch3-auth-loading-before`, `batch3-all-targeted`, `batch3-client-initial-probe`, `batch3-client-before`, `batch3-client-targeted`, `batch3-web-full-first`, `batch3-web-full`. Initial page-selection failures were superseded in `batch3-pages-targeted` by its later run; they are described above. `batch3-document.cjs` validates IDs/statuses and preservation of the prior 284 cases; `batch3-case-table.md` is its ignored generated table.

### Every repository file changed in Batch 3

1. `web/tests/foundation/conservationReportApi.test.jsx` — new, 20 cases.
2. `web/tests/foundation/conservationReports.test.jsx` — new, 19 cases.
3. `web/tests/foundation/authLifecycle.test.jsx` — new, 20 cases.
4. `web/tests/foundation/reportPdf.test.jsx` — new, 9 cases.
5. `web/tests/foundation/serviceContracts.test.jsx` — new, 27 cases.
6. `web/tests/foundation/apiHealth.test.jsx` — new, 6 cases.
7. `web/tests/foundation/apiClient.test.jsx` — new, 4 cases with actual Axios and deterministic adapter.
8. `web/tests/foundation/app.test.jsx` — 3 protected report/expiry navigation cases added.
9. `web/tests/integration/communityReportManagement.test.jsx` — 5 missing state/pagination/race cases added.
10. `web/tests/integration/incidentReview.test.jsx` — 3 detail retry/ownership/abort cases added.
11. `web/tests/integration/analyticsDashboard.test.jsx` — 3 independent-failure/race/cleanup cases added.
12. `web/tests/integration/patrolList.test.jsx` — 1 last-page boundary case added.
13. `web/src/hooks/useAuth.jsx` — only demonstrated stale-session/loading/interceptor corrections.
14. `web/src/services/conservationReportApi.js` — download cleanup in finally.
15. `web/src/pages/ConservationReports/ConservationReports.jsx` — date validation, generation invalidation and preview-aligned CSV parameters.
16. `docs/testing-and-refactoring/PHASE_3_TEST_EXPANSION.md` — this verified inventory, root causes, results, case table and gaps.

Earlier phase/batch changes remain uncommitted. No testing setup, isolation guard, environment file, package/dependency/lockfile, backend, mobile or sensor-dashboard file changed in Batch 3. Explicit HTTP/PDF/browser mocks and a deterministic Axios adapter prevented real transport/provider/download activity. The existing network/database safety tests remain in their safe discovery configurations. No real Neon connection, migration, seed, reset, unsafe standalone script, secret-value inspection, commit, push, merge or branch switch occurred.

### Remaining gaps and stop point

- Tests mock jsPDF/AutoTable drawing and save APIs to verify application mapping/callbacks. They do not claim visual PDF layout validation, actual browser download completion or real backend export bytes.
- A visible Cancel button is not implemented for report generation/downloads. Tests exercise implemented abort on unmount/type switch/Clear, cancellation errors and pending-button locking; no unsupported cancel control was introduced. Downloads have no abort signal contract.
- JWT UI tests cover finite expiration boundaries and opaque-token fallback; the backend remains authoritative. Very long expiry timers, tokens without numeric exp, revocation across tabs and pending login on provider teardown are not fully characterized. New scope/version guards prevent the demonstrated transitions without redesigning session policy.
- Full schema validation for every report summary/detail and permissive user/patrol mutation envelope remains incomplete. Tests preserve implemented response checks rather than invent fields or backend error/status contracts. Low-level untested browser allocation failures before anchor attachment and all PDF layout/font combinations remain gaps.
- Existing patrol request/polling races, manager incident pagination/evidence boundaries, analytics filters and community transitions remain covered by their earlier suites; this batch adds missing complementary cases only. Real database/provider concurrency and end-to-end hardware behaviour remain outside safe web tests.
- The Batch 2 public sensor/risk authorization decision, out-of-order telemetry, distinct-animal density semantics and validation/transaction gaps remain unresolved. No access restrictions or sensor policy changes were introduced here.
- Batch 4 mobile API/permissions/offline tests, later remaining validator/service work, measured coverage and SOLID refactoring remain unstarted.

**Stop after Batch 3 and await approval.**

### Batch 3 verified case table

All 120 IDs below are unique new tests found in the final executed JSON. Expected outcomes describe mocked, deterministic tests of implemented behaviour; real provider/browser/database operation is not claimed.

| Test Case ID | Module | Scenario | Test Type | Input | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|---|---|---|---|
| B3-RAPI-01 | Report API/download | report types preserve cancellation signal and unwrap validated list | Positive/cancellation | Success type list; AbortSignal | Unwrap types and forward signal | As expected in final full suite | Pass |
| B3-RAPI-02 | Report API/download | malformed report types null fail explicitly | Negative | Null type envelope | Report types unavailable | As expected in final full suite | Pass |
| B3-RAPI-03 | Report API/download | malformed report types {"success":false,"data":[]} fail explicitly | Negative | Types success false | Report types unavailable | As expected in final full suite | Pass |
| B3-RAPI-04 | Report API/download | malformed report types {"success":true,"data":{}} fail explicitly | Negative | Types data object | Report types unavailable | As expected in final full suite | Pass |
| B3-RAPI-05 | Report API/download | generation whitelists all implemented filters and preserves zero and signal | Positive/security | Frozen full filters, empty type, zero priority and unsupported field | Whitelist implemented fields; retain zero/signal; unwrap report | As expected in final full suite | Pass |
| B3-RAPI-06 | Report API/download | incomplete generation envelope is rejected | Negative | Generation missing reportType | Report data unavailable | As expected in final full suite | Pass |
| B3-RAPI-07 | Report API/download | HTTP generation rejection reaches caller unchanged | Authorization/error | Generation HTTP403 | Same rejection reaches caller | As expected in final full suite | Pass |
| B3-RAPI-08 | Report API/download | export URL encodes allowed filters and keeps token out of query | Security/encoding | CSV; Lake & Gate; fixture token | Encoded allowed query; token only returned separately | As expected in final full suite | Pass |
| B3-RAPI-09 | Report API/download | authenticated CSV download uses server filename and releases URL/anchor | Positive/cleanup | CSV blob; park.csv header; fixture token | Authenticated fetch; attached clicked anchor; server filename; URL/anchor cleanup | As expected in final full suite | Pass |
| B3-RAPI-10 | Report API/download | missing filename uses deterministic CSV export fallback | Boundary | CSV; no filename; clock1000 | conservation_report_1000.csv | As expected in final full suite | Pass |
| B3-RAPI-11 | Report API/download | missing filename uses deterministic PDF export fallback | Characterization | PDF export endpoint; no filename; clock1000 | Existing server-format fallback .html; page PDF uses client adapter | As expected in final full suite | Pass |
| B3-RAPI-12 | Report API/download | HTTP export failure does not create download resources | Authorization/error | Export401 | Reject before creating URL/anchor | As expected in final full suite | Pass |
| B3-RAPI-13 | Report API/download | failed blob decoding does not create resources | Error | Blob decoder rejects | No download resources created | As expected in final full suite | Pass |
| B3-RAPI-14 | Report API/download | failed browser save still removes anchor and revokes URL | Regression/cleanup | Browser click throws after URL allocation | Same error; anchor removed and URL revoked | Failed before source fix; passed after | Pass |
| B3-RAPI-15 | Report API/download | status 401 maps to actionable report error | Authorization | HTTP401 | Session-expired guidance | As expected in final full suite | Pass |
| B3-RAPI-16 | Report API/download | status 403 maps to actionable report error | Authorization | HTTP403 | Approved-manager guidance | As expected in final full suite | Pass |
| B3-RAPI-17 | Report API/download | status 400 maps to actionable report error | Validation | HTTP400 | Filter/date guidance | As expected in final full suite | Pass |
| B3-RAPI-18 | Report API/download | status 500 maps to actionable report error | Error | HTTP500 | Retry guidance | As expected in final full suite | Pass |
| B3-RAPI-19 | Report API/download | meaningful server message takes precedence but blank message does not | Error/edge | Meaningful server message then blank message | Prefer meaningful text; otherwise status fallback | As expected in final full suite | Pass |
| B3-RAPI-20 | Report API/download | Sri Lanka date boundaries cover the entire exact calendar day | Boundary | 1 January2026 and empty dates | Sri Lanka midnight through23:59:59.999; empty undefined | As expected in final full suite | Pass |
| B3-AUTH-01 | Authentication lifecycle | no stored session finishes loading without restoration request | Empty | No stored token | Finish loading; no restoration HTTP | As expected in final full suite | Pass |
| B3-AUTH-02 | Authentication lifecycle | restores stored session and applies Authorization before profile request | Positive | Opaque saved token; valid server user | Authorization set before /auth/me; restore user | As expected in final full suite | Pass |
| B3-AUTH-03 | Authentication lifecycle | failed restoration clears unusable session | Authorization/error | Restoration401 | Clear token/header and finish loading | As expected in final full suite | Pass |
| B3-AUTH-04 | Authentication lifecycle | failed restoration clears unusable session | Error | Restoration network failure | Clear unusable session and finish loading | As expected in final full suite | Pass |
| B3-AUTH-05 | Authentication lifecycle | successful login sets profile, token and header; logout clears all three | Positive | Valid login then explicit logout | Publish token/header/user then clear all three | As expected in final full suite | Pass |
| B3-AUTH-06 | Authentication lifecycle | login error propagates without publishing a session | Error | Login rejects | Propagate original error; no session publication | As expected in final full suite | Pass |
| B3-AUTH-07 | Authentication lifecycle | interceptor invalidates expired or unapproved session | Authorization | Interceptor401 | Clear session and reject same error | As expected in final full suite | Pass |
| B3-AUTH-08 | Authentication lifecycle | interceptor invalidates expired or unapproved session | Authorization | Interceptor ACCOUNT_NOT_APPROVED403 | Clear session and reject same error | As expected in final full suite | Pass |
| B3-AUTH-09 | Authentication lifecycle | ordinary 403 preserves session and successful interceptor preserves response | Authorization/edge | Ordinary403 and success200 response | Keep session for ordinary403; response interceptor identity | As expected in final full suite | Pass |
| B3-AUTH-10 | Authentication lifecycle | JWT expires exactly at its boundary and cancels timer on logout | Boundary | Clock1000000; exp1002; advance1999 then1ms | Authenticated before exact boundary; logged out at boundary | As expected in final full suite | Pass |
| B3-AUTH-11 | Authentication lifecycle | already expired JWT logs out immediately after server-authorized login | Boundary | Already expired exp999 | Immediate UI logout after server-authorized login | As expected in final full suite | Pass |
| B3-AUTH-12 | Authentication lifecycle | unmount ejects interceptor and clears expiry timer | Cleanup | JWT2s expiry then unmount | Clear exact application timer; eject interceptor17 | As expected in final full suite | Pass |
| B3-AUTH-13 | Authentication lifecycle | malformed opaque token defers validity to server rather than decoding logout | Characterization | Opaque non-JWT token; advance1hour | Server-authorized session remains; decoder does not invent expiry | As expected in final full suite | Pass |
| B3-AUTH-14 | Authentication lifecycle | delayed restoration cannot undo explicit logout | Regression/async | Pending restoration; logout; old success completes | Old response cannot restore user | Failed before source fix; passed after | Pass |
| B3-AUTH-15 | Authentication lifecycle | unmounted restoration failure cannot clear a newer session | Regression/cleanup | Unmount old restoration; new stored session; old rejection | New token/header preserved | Failed before source fix; passed after | Pass |
| B3-AUTH-16 | Authentication lifecycle | pending login completion cannot undo explicit logout | Regression/async | Login pending; explicit logout; login finishes | Do not restore session after logout | Failed before source fix; passed after | Pass |
| B3-AUTH-17 | Authentication lifecycle | older restoration rejection cannot erase a completed new login | Async/security | New login completes; old restoration rejects | New user/token/header retained | As expected in final full suite | Pass |
| B3-AUTH-18 | Authentication lifecycle | later login wins when earlier login resolves last | Async/security | Two logins; old finishes last | Latest login wins | As expected in final full suite | Pass |
| B3-AUTH-19 | Authentication lifecycle | new successful login finishes loading without waiting for old restoration | Regression/async | New login succeeds while old restoration remains pending | Loading false without waiting for old request | Failed before source fix; passed after | Pass |
| B3-AUTH-20 | Authentication lifecycle | explicit logout finishes pending session-restoration loading | Regression/async | Logout while restoration pending | Loading false and unauthenticated | Failed before source fix; passed after | Pass |
| B3-RUI-01 | Conservation report page | unsupported account null cannot generate or export | Authorization | No user | No generation/export controls or requests | As expected in final full suite | Pass |
| B3-RUI-02 | Conservation report page | unsupported account {"role":"RANGER","approvalStatus":"APPROVED"} cannot generate or export | Authorization | Approved Ranger | Manager-only notice; no requests | As expected in final full suite | Pass |
| B3-RUI-03 | Conservation report page | unsupported account {"role":"PARK_MANAGER","approvalStatus":"PENDING"} cannot generate or export | Authorization | Pending Park Manager | Manager-only notice; no requests | As expected in final full suite | Pass |
| B3-RUI-04 | Conservation report page | successful filtered report maps full Sri Lanka day and displayed records | Positive/boundary | Incident; equal1Jan dates; Lake; PENDING | Full Sri Lanka day params; one record and matching count | As expected in final full suite | Pass |
| B3-RUI-05 | Conservation report page | report type switch retains date/area and resets incompatible type/status/priority | State/filtering | Patrol filters then switch to Incident | Retain dates/area; clear incompatible type/status/priority | As expected in final full suite | Pass |
| B3-RUI-06 | Conservation report page | pending generation disables repeat submission and shows loading | Async | Deferred generation | Loading visible; repeated submit disabled; success renders | As expected in final full suite | Pass |
| B3-RUI-07 | Conservation report page | empty report presents zero counts and explicit empty records | Empty | Zero incidents and empty summary | Zero metrics; explicit empty records | As expected in final full suite | Pass |
| B3-RUI-08 | Conservation report page | failed generation shows authorization error and successful retry clears it | Authorization/retry | Generation403 then success | Guidance visible; retry clears error | As expected in final full suite | Pass |
| B3-RUI-09 | Conservation report page | PDF uses generated data without HTTP and exposes generation error | Positive/error | PDF click then PDF adapter failure | Generated data passed without HTTP; CSV alternative message on failure | As expected in final full suite | Pass |
| B3-RUI-10 | Conservation report page | CSV pending disables both exports and restores retry after error | Async/error | Deferred CSV export rejects | Both exports disabled while pending; error and retry controls restored | As expected in final full suite | Pass |
| B3-RUI-11 | Conservation report page | unmount aborts pending report request | Cleanup | Unmount pending generation | Abort exact request signal | As expected in final full suite | Pass |
| B3-RUI-12 | Conservation report page | reversed range is rejected before any report API request | Regression/validation | From2Jan greater than To1Jan | Visible range error before HTTP | Failed before source fix; passed after | Pass |
| B3-RUI-13 | Conservation report page | switching report type invalidates a late previous report | Regression/async | Pending Incident then switch to Patrol; old success | Abort old request; ignore result; new generate enabled | Failed before source fix; passed after | Pass |
| B3-RUI-14 | Conservation report page | clearing filters invalidates pending result | Regression/async | Pending report with area; Clear; old success | Empty filters; no stale preview | Failed before source fix; passed after | Pass |
| B3-RUI-15 | Conservation report page | CSV exports the preview filters even after unsent form edits | Regression/consistency | Preview generated then unsent area edit; CSV click | Export uses successful preview query, matching PDF/data | Failed before source fix; passed after | Pass |
| B3-RUI-16 | Conservation report page | implemented Patrol Operations report renders its own record shape | Positive | Patrol operations fixture | PATROL query; own record shape and count | As expected in final full suite | Pass |
| B3-RUI-17 | Conservation report page | implemented Human-Wildlife Conflict Trend report renders its own record shape | Positive | Conflict trend fixture | CONFLICT_TREND query; own record shape and count | As expected in final full suite | Pass |
| B3-RUI-18 | Conservation report page | cancellation rejection leaves no error and permits retry | Cancellation/retry | CanceledError then retry success | No cancellation error; retry enabled | As expected in final full suite | Pass |
| B3-RUI-19 | Conservation report page | repeated completed submissions replace preview without accumulating rows | State/positive | Two completed generation submissions | Second replaces first; no accumulated rows | As expected in final full suite | Pass |
| B3-PDF-01 | PDF adapter/data mapping | incident PDF maps dates, nulls, human labels and reporter data | Positive/boundary | Incident with underscores, invalid date and null location | Human labels, date/null dash, reporter and deterministic filename | As expected in final full suite | Pass |
| B3-PDF-02 | PDF adapter/data mapping | patrol PDF retains numeric zero waypoints and incident counts | Positive/boundary | Patrol with zero waypoints and2incidents | Preserve zero/counts, row ordering and filename | As expected in final full suite | Pass |
| B3-PDF-03 | PDF adapter/data mapping | conflict PDF maps anonymous records without exposing identity | Positive/privacy | Anonymous conflict record | Correct species/status/date/location/Yes fields; no identity column | As expected in final full suite | Pass |
| B3-PDF-04 | PDF adapter/data mapping | empty incident report renders metrics and footer without empty tables | Empty | Zero incident summary, no records | Metrics/footer drawn; no empty tables | As expected in final full suite | Pass |
| B3-PDF-05 | PDF adapter/data mapping | header filters and every page footer map supplied metadata | Positive | Manager/filter metadata;2pages | A4 portrait options; filter/header text; numbered footers on both pages | As expected in final full suite | Pass |
| B3-PDF-06 | PDF adapter/data mapping | page overflow adds page and continuation heading | Boundary | Page height100mm and populated records | Add page for overflow; continuation heading callback | As expected in final full suite | Pass |
| B3-PDF-07 | PDF adapter/data mapping | zero-count breakdown avoids non-finite bar geometry | Boundary | Zero count breakdown; draw-cell callback | No non-finite bar geometry | As expected in final full suite | Pass |
| B3-PDF-08 | PDF adapter/data mapping | unsupported report type uses explicit fallback content | Negative/characterization | UNKNOWN report type | Explicit fallback body and deterministic filename | As expected in final full suite | Pass |
| B3-PDF-09 | PDF adapter/data mapping | PDF adapter save failure propagates rather than fabricating download | Error | PDF save throws | Original error propagates | As expected in final full suite | Pass |
| B3-API-01 | Web service adapters | pending user selection removes only pending flag and preserves filters | Positive/filtering | pending true; RANGER; page2 | Pending endpoint; omit pending query key; keep filters | As expected in final full suite | Pass |
| B3-API-02 | Web service adapters | ordinary user list defaults to empty params | Positive | Default user list | Users endpoint with empty params | As expected in final full suite | Pass |
| B3-API-03 | Web service adapters | user approval encodes ID and includes assigned park only when supplied | Security/encoding | u/a approval then rejection without park | Encoded ID; include park only when supplied | As expected in final full suite | Pass |
| B3-API-04 | Web service adapters | user review HTTP rejection propagates unchanged | Authorization/error | User review403 | Same error propagated | As expected in final full suite | Pass |
| B3-API-05 | Web service adapters | park listing unwraps empty successful list | Empty | Successful empty park list | Return empty array at parks endpoint | As expected in final full suite | Pass |
| B3-API-06 | Web service adapters | malformed park envelope {"success":false,"parks":[]} fails explicitly | Negative | Park success false | Explicit Park list unavailable | As expected in final full suite | Pass |
| B3-API-07 | Web service adapters | malformed park envelope {"success":true,"parks":{}} fails explicitly | Negative | Park data object | Explicit Park list unavailable | As expected in final full suite | Pass |
| B3-API-08 | Web service adapters | patrol creation preserves payload and response envelope | Positive/immutability | Frozen patrol create DTO | Unchanged POST payload and response envelope | As expected in final full suite | Pass |
| B3-API-09 | Web service adapters | patrol list preserves pagination, filtering and empty result metadata | Positive/filtering | Patrol page2/COMPLETED with empty result | Exact filters and result metadata retained | As expected in final full suite | Pass |
| B3-API-10 | Web service adapters | patrol detail encodes identity and unwraps patrol | Security/encoding | Patrol p/a | Encoded detail endpoint and unwrapped patrol | As expected in final full suite | Pass |
| B3-API-11 | Web service adapters | update and cancellation use distinct encoded mutation endpoints | Positive/encoding | Update p/a HIGH then cancel | Distinct PATCH and cancellation POST routes | As expected in final full suite | Pass |
| B3-API-12 | Web service adapters | listAssignableRangers rejects malformed response | Negative | Assignable ranger response null array | Explicit ranger-list error | As expected in final full suite | Pass |
| B3-API-13 | Web service adapters | listPatrols rejects malformed response | Negative | Patrol response object instead of array | Explicit patrol-list error | As expected in final full suite | Pass |
| B3-API-14 | Web service adapters | getPatrol rejects malformed response | Negative | Missing patrol detail | Explicit detail error | As expected in final full suite | Pass |
| B3-API-15 | Web service adapters | listLiveRangers rejects malformed response | Negative | Live response success false | Explicit live-list error | As expected in final full suite | Pass |
| B3-API-16 | Web service adapters | getPatrolTrail rejects malformed response | Negative | Trail locations object | Explicit trail error | As expected in final full suite | Pass |
| B3-API-17 | Web service adapters | recorded trail unwraps ordered history and encoded ID | Positive/encoding | p/a and ordered history | Encoded locations endpoint and same array | As expected in final full suite | Pass |
| B3-API-18 | Web service adapters | patrol conflict propagates without retrying mutation | Conflict/error | Patrol update409 | Propagate original failure; no retry mutation | As expected in final full suite | Pass |
| B3-API-19 | Web service adapters | aborted complete incident collection stops before second page | Cancellation | Abort during first incident page of2 | Do not fetch second page; cancelled error | As expected in final full suite | Pass |
| B3-API-20 | Web service adapters | incident collection rejects unreasonable page count before further requests | Boundary/security | Incident total100001 with pageSize1 | Reject unreasonable page count before more HTTP | As expected in final full suite | Pass |
| B3-API-21 | Web service adapters | incident collection refuses record without identity | Negative | Incident row without id | Reject incomplete collection | As expected in final full suite | Pass |
| B3-API-22 | Web service adapters | incident mutation keeps encoded ID and cancellation signal | Positive/cancellation | i/a; markAsDone true; signal | Encoded status PATCH with unchanged data/signal | As expected in final full suite | Pass |
| B3-API-23 | Web service adapters | failed mark-done acknowledgement is rejected | Negative | Incident mark-done success false | Explicit failure; no fabricated success | As expected in final full suite | Pass |
| B3-API-24 | Web service adapters | zero verified-incident count is accepted while string count is rejected | Boundary/negative | Verified count0 then string0 | Accept numeric zero; reject string | As expected in final full suite | Pass |
| B3-API-25 | Web service adapters | community mark-done binds encoded ID and signal | Positive/cancellation | c/a; mark-done signal | Encoded mark-done PATCH and signal | As expected in final full suite | Pass |
| B3-API-26 | Web service adapters | community mark-done failure propagates safe adapter error | Negative | Community mark-done success false | Explicit adapter failure | As expected in final full suite | Pass |
| B3-API-27 | Web service adapters | community cancelled HTTP request propagates original cancellation | Cancellation | Community detail HTTP CanceledError | Same cancellation and signal reach caller | As expected in final full suite | Pass |
| B3-HEALTH-01 | API health hook | health starts checking and resolves connected only with both flags | Positive/async | success true and database connected | Checking then connected; pass AbortSignal | As expected in final full suite | Pass |
| B3-HEALTH-02 | API health hook | unhealthy or malformed {"success":false,"database":"connected"} becomes unavailable | Negative | success false despite connected database | Unavailable | As expected in final full suite | Pass |
| B3-HEALTH-03 | API health hook | unhealthy or malformed {"success":true,"database":"disconnected"} becomes unavailable | Negative | success true but disconnected database | Unavailable | As expected in final full suite | Pass |
| B3-HEALTH-04 | API health hook | unhealthy or malformed null becomes unavailable | Negative | Null health data | Unavailable without uncaught error | As expected in final full suite | Pass |
| B3-HEALTH-05 | API health hook | network rejection becomes unavailable without unhandled error | Error | Network rejection | Unavailable without unhandled rejection | As expected in final full suite | Pass |
| B3-HEALTH-06 | API health hook | unmount aborts pending request and late result cannot change hook snapshot | Cleanup/async | Unmount pending request then late success | Abort signal; hook snapshot unchanged | As expected in final full suite | Pass |
| B3-COM-01 | Community management page | empty result hides pagination and offers no detail actions | Empty | Empty list | Explicit empty message; hide pagination/detail actions | As expected in final full suite | Pass |
| B3-COM-02 | Community management page | failed initial list retries and clears prior error | Error/retry | Offline initial list then success | Retry recovers and clears error | As expected in final full suite | Pass |
| B3-COM-03 | Community management page | pagination selects second page and filter change returns to first | Pagination/filtering | 26reports; Next then PENDING filter | Second page then reset page1 with filter | As expected in final full suite | Pass |
| B3-COM-04 | Community management page | replaced filter request is aborted and late result cannot replace current rows | Async/cancellation | Old list pending; new status result; old resolves last | Old signal aborted; current rows retained | As expected in final full suite | Pass |
| B3-COM-05 | Community management page | reversed calendar range fails before HTTP request | Validation | Reversed calendar dates in URL | Reject before HTTP | As expected in final full suite | Pass |
| B3-INC-01 | Incident review page | incident load failure retries without exposing raw provider error | Error/retry | Private fixture error then retry | Safe message; recover real detail; clear error | As expected in final full suite | Pass |
| B3-INC-02 | Incident review page | incident from another patrol cannot expose details or review control | Authorization/ownership | Incident patrolId other instead of selectedp1 | Withhold details and review controls | As expected in final full suite | Pass |
| B3-INC-03 | Incident review page | unmount aborts pending incident details lookup | Cleanup | Unmount pending detail | Abort signal | As expected in final full suite | Pass |
| B3-DASH-01 | Manager dashboard/analytics | KPI failure leaves independent chart panels usable and retry recovers | Partial failure/retry | KPI failure; other panels succeed | Charts usable; metrics retry recovers | As expected in final full suite | Pass |
| B3-DASH-02 | Manager dashboard/analytics | older incident analytics cannot replace newer filter result | Async/cancellation | Old incident analytics pending; change area; old completes | Abort and ignore old result; show current chart labels | As expected in final full suite | Pass |
| B3-DASH-03 | Manager dashboard/analytics | dashboard unmount aborts all four independent pending queries | Cleanup | All4queries pending; unmount | Abort all4signals | As expected in final full suite | Pass |
| B3-ROUTE-01 | Protected report routes | unauthenticated conservation report route requires login | Authorization | Anonymous conservation route | Redirect to login; no report heading | As expected in final full suite | Pass |
| B3-ROUTE-02 | Protected report routes | non-manager conservation report access redirects to profile | Authorization/navigation | Ranger visits conservation route | Redirect to profile; no report heading | As expected in final full suite | Pass |
| B3-ROUTE-03 | Protected report routes | JWT expiry transitions protected profile back to login | Boundary/navigation | Protected profile; JWT expires at2seconds | Transition to login and clear session | As expected in final full suite | Pass |
| B3-PAT-01 | Patrol management page | last page boundary disables further pagination without hiding existing patrol | Pagination/boundary | 26patrols; pageSize25; Next | Page2 retains row; Next disabled; Previous enabled | As expected in final full suite | Pass |
| B3-CLIENT-01 | Actual Axios client/interceptors | actual Axios health request preserves signal and Authorization header | Positive/security | Actual Axios health request with fixture token and signal | Adapter receives health endpoint, snapshot Authorization and signal | As expected in final full suite | Pass |
| B3-CLIENT-02 | Actual Axios client/interceptors | already aborted Axios request never reaches mock transport | Cancellation | Already aborted signal | Axios cancels before adapter runs | As expected in final full suite | Pass |
| B3-CLIENT-03 | Actual Axios client/interceptors | actual Axios adapter rejection propagates without invented health success | Error | Deterministic adapter rejection | Original transport error propagates | As expected in final full suite | Pass |
| B3-CLIENT-04 | Actual Axios client/interceptors | delayed old-session 401 cannot clear newer login through actual interceptors | Regression/security/async | Old authorized health request pending; new login; old401 | Actual interceptor rejects old request but retains newer session | Failed before source fix; passed after | Pass |

## Checkpoint B — Batch 4 implementation and evidence (13 October 2026)

Batch 4 adds **101 meaningful mobile tests** for implemented alert/API contracts, health/incident resource hooks, GPS services/watchers, incident evidence failures, browser storage rejection and native SQLite retry/storage failure branches. Six new foundation files use the unchanged guarded Jest discovery. No empty service/storage/hook scaffold was treated as implemented functionality. Existing scenarios for role authentication, permission denial, background watcher cleanup, duplicate-worker prevention, interrupted draft recovery and partial evidence sync remain preserved and executed rather than duplicated.

### Module inventory

| Module | New tests | Positive, negative, boundary and error scenarios |
|---|---:|---|
| Alert API | 18 | All 12 implemented operation routes/payloads/signals/results, default query, unread zero, server-declared error/fallback, 401/503 propagation and cancellation |
| One-shot location service | 21 | Permission responses/exceptions, disabled-service/denial short circuits, native failure fallback, six-decimal coordinates, rounded accuracy, exact coordinate limits, absent/invalid readings, timeout boundary/cleanup and zero/invalid accuracy |
| API health hook | 6 | Checking/connected/unavailable, malformed reply, network failure and late response after abort/unmount |
| Incident resource hook | 5 | Focus-scoped load, refresh, ignored late success/failure, synchronous-loader error recovery, unmount abort |
| Actual mobile Axios client | 3 | Mock adapter with actual header/signal/baseURL handling, pre-aborted request and transport error propagation |
| Incident API extensions | 10 | Malformed detail/page envelopes, missing context, stable idempotency options, server conflict, exact cancellation signal/error |
| Foreground GPS watcher extensions | 5 | Subscription error/retry, native callback failure, old callback after resubscription, precision/timestamp retention, invalid timestamp/coordinates and inclusive age/accuracy limits |
| Browser offline storage | 6 | Explicit native-only failures for implemented unavailable exports; actual trail ordering/deduplication/server precedence transform |
| Incident evidence failure branches | 13 | Preparation failure, malformed confirmations, invalid/expired receipt, network interruption, stable-key retry, expired ticket boundary, abortable receipt wait, retained local files, safe diagnostics and processing deadline |
| Native offline cooldown | 10 | HTTP-date header, numeric/string response-body delay, invalid/negative/non-finite values, milliseconds conversion overflow, header/body precedence, persisted restart cooldown and exact retry boundary |
| Native storage failures | 4 | Observable read/write failure, retained data, transaction rollback and coordinator recovery after a storage error |

The SQLite extensions reuse the existing temporary `wildguard-isolated-sqlite-*` harness with `node:sqlite`, including owner scoping, close/reopen and checked cleanup. They operate solely on that test-created database. Mocked native/file/network providers prevent access to device/user files, GPS, permissions or a real backend. The actual Axios tests explicitly install a deterministic adapter and use a dummy local-browser public API origin; no native/browser transport runs.

### Reproduced defects and smallest production changes

Only three production mobile files changed. Every correction has failed-before/passed-after assertion evidence.

1. **GPS accuracy normalization — B4-GPS-19/20/21.** The one-shot service used a truthiness check: legitimate accuracy zero became null; an invalid string became NaN; negative accuracy remained negative. Before correction the suite passed 18 and failed these 3. `locationService.js` now rounds only finite non-negative accuracy, preserving zero and returning null for unavailable metadata. Valid coordinate results, six-decimal precision, permission/timeout contracts and the existing optional-accuracy shape remain unchanged.
2. **Expired private media tickets — B4-EVID-09/10.** `getEvidenceAccess` only checked that expiration parsed, so a ticket before or exactly at now was returned as usable. `incidentEvidenceApi.js` now also requires expiration strictly in the future, retaining existing ID-bound private-path checks. Both boundary regressions failed before the check.
3. **Receipt-wait cancellation — B4-EVID-11.** Abort was forwarded to Axios but did not interrupt the preceding one-second receipt wait. A cancelled/unmounted upload stayed pending until another poll. An abort-aware wait now rejects with the existing cancellation shape, clears its timer and removes its listener; normal polling remains once per second with the same four-minute deadline. Confirmed success is still required before local deletion. The test drains zero-time asynchronous work before asserting prompt settlement, makes no status request after abort, and retains the local item.
4. **Malformed/non-finite offline delays — B4-SYNC-05/06/10.** Invalid `retryAfterSeconds` produced NaN, making finalization fail and leaving GPS `SYNCING`; Infinity was persisted as an infinite `next_at`. Initial SQLite proof: 31 passed, 2 failed. The first finite-seconds check still allowed `1e308` to overflow when multiplied by 1000; its separate regression passed 33 and failed 1 before the final correction. `offlineSync.js` now validates finite, non-negative converted millisecond delays. Invalid values use the existing exponential fallback (5 seconds on the first failure), while valid server header/body delays still take precedence when longer. No server-delay cap, synchronization policy or automatic data deletion was introduced.

No other production behaviour or API contract was redesigned. The alert adapter's existing server-message error contract and location service's attempt-GPS fallback after a failed service check are characterized without inventing new policies. Focus lifecycle is simulated by a cleanup-aware React effect for the direct incident-resource tests; real navigation stacks remain covered by earlier screen tests.

### Actual runs and before/after totals

| Run | Passed | Failed | Scope |
|---|---:|---:|---|
| Alert/location/resource group | 47 | 0 | 3 new files |
| Actual client/incident/watcher/browser group | 52 | 0 | 4 files, existing assertions included |
| Evidence failure proof | 9 | 3 | Expired ticket and receipt cancellation regressions |
| SQLite retry/storage proof | 31 | 2 | Malformed/infinite delay regressions |
| GPS accuracy proof | 18 | 3 | Zero/string/negative metadata regressions |
| Initial affected fix group | 86 | 0 | 4 files; existing evidence tests included |
| All affected groups before conversion-overflow addition | 169 | 0 | 10 files, including 100 new tests |
| First complete safe mobile run | 631 | 0 | 53 files; detectOpenHandles returned none |
| Conversion-overflow proof | 33 | 1 | New finite-seconds-to-infinite-ms regression |
| Final SQLite affected suite | 34 | 0 | All old/new SQL scenarios after final correction |
| Final complete safe mobile run | **632** | **0** | **53 files; no skipped/pending tests; zero detected open handles** |

Mobile increases from **531 to 632: exactly 101 tests added**. The final report contains every prior 531 passing assertion name. Targeted runs overlap the full run and must not be added to it. Backend **976**, web **404**, sensor dashboard **30** remain their latest earlier verified results; they were not rerun because shared code and dependencies were unchanged. Reading the existing shared navigation constants from a mobile test did not change shared source. No coverage percentage is inferred and no coverage tooling was configured.

Final verification used `--detectOpenHandles` without `--forceExit`. There were no React act warnings, unhandled rejections, unexpected console errors or Jest non-exit warnings. Existing structured `console.info` evidence diagnostics remain visible. The **Node experimental SQLite warning remains** because the existing test-only harness uses `node:sqlite`; it was not suppressed. Test execution used the normal account outside the previously diagnosed managed-sandbox native-path EPERM restriction, with no administrator access or unrelated-file cleanup.

```powershell
# From mobile: initial API/location/resource group
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/foundation/alertApi.test.js tests/foundation/locationService.test.js tests/foundation/mobileResources.test.js
# Client/incident/watcher/browser group
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/foundation/mobileApiClient.test.js tests/foundation/incidentApi.test.js tests/foundation/foregroundLocation.test.js tests/foundation/browserOfflineStorage.test.js
# Failure proofs, separately before their respective source fixes
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/foundation/evidenceFailures.test.js
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/foundation/offlineStorage.test.js
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/foundation/locationService.test.js
# All affected suites
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/foundation/alertApi.test.js tests/foundation/locationService.test.js tests/foundation/mobileResources.test.js tests/foundation/mobileApiClient.test.js tests/foundation/incidentApi.test.js tests/foundation/foregroundLocation.test.js tests/foundation/browserOfflineStorage.test.js tests/foundation/evidenceFailures.test.js tests/foundation/incidentEvidenceApi.test.js tests/foundation/offlineStorage.test.js
# Final complete guarded mobile suite with handle diagnostics
node node_modules/jest/bin/jest.js --runInBand --detectOpenHandles
```

Commands also used JSON reporters and redirected logs into ignored `.cache`. Preserved JSON/log pairs: `batch4-first-targeted`, `batch4-second-targeted`, `batch4-evidence-before`, `batch4-offline-before`, `batch4-gps-before`, `batch4-fixes-targeted`, `batch4-all-targeted`, `batch4-mobile-full-first`, `batch4-overflow-before`, `batch4-overflow-targeted`, `batch4-mobile-full`. `batch4-document.cjs` verifies all unique B4 IDs/statuses and preservation of prior cases; `batch4-case-table.md` is the ignored generated case table. The failed original proofs remain available alongside final results.

### Every repository file changed in Batch 4

1. `mobile/tests/foundation/alertApi.test.js` — new, 18 operation/error/cancellation cases.
2. `mobile/tests/foundation/locationService.test.js` — new, 21 native permission/GPS/metadata/timeout cases.
3. `mobile/tests/foundation/mobileResources.test.js` — new, 6 health and 5 incident-resource cases.
4. `mobile/tests/foundation/mobileApiClient.test.js` — new, 3 actual Axios adapter cases.
5. `mobile/tests/foundation/browserOfflineStorage.test.js` — new, 6 implemented browser storage/transform cases.
6. `mobile/tests/foundation/evidenceFailures.test.js` — new, 13 upload/receipt/ticket/retention/deadline cases.
7. `mobile/tests/foundation/incidentApi.test.js` — 10 malformed/context/error/cancellation cases added.
8. `mobile/tests/foundation/foregroundLocation.test.js` — 5 missing watcher/precision/time/cleanup cases added.
9. `mobile/tests/foundation/offlineStorage.test.js` — 10 durable retry-delay and 4 storage failure cases added, reusing existing isolated SQLite harness.
10. `mobile/src/services/locationService.js` — demonstrated accuracy normalization correction.
11. `mobile/src/services/incidentEvidenceApi.js` — demonstrated expired-ticket and abortable receipt-wait corrections.
12. `mobile/src/services/offlineSync.js` — demonstrated safe millisecond retry-delay normalization.
13. `docs/testing-and-refactoring/PHASE_3_TEST_EXPANSION.md` — verified Batch 4 inventory, defects, results, cases, changes and gaps.

Earlier changes remain uncommitted and are not additional Batch 4 edits. No test config, setup/network guard, package/dependency/lockfile, production `.env`, backend, web, sensor-dashboard or shared file changed. No real Neon/PostgreSQL connection, migration/seed/reset against application data, unsafe script, device/user data access, secret-value inspection, commit, push, merge or branch switch occurred. SQLite schema creation/row cleanup was confined to the approved existing temporary test fixture, whose checked cleanup deletes only its own test-created directory.

### Remaining gaps and stop point

- Physical GPS, native permission dialogs, camera/provider uploads, real device files and interrupted operating-system processes remain outside these mocked/native-fixture suites. Watcher lifetime is verified through explicit mocks; this is not device end-to-end testing.
- One-shot location results expose coordinates/accuracy, not timestamps, by their current contract; the foreground watcher preserves delivered timestamps and is tested at its implemented age boundary. No unsupported timestamp field was added.
- Browser durable offline storage remains explicitly unsupported. The tested trail transformer is implemented; tests do not fabricate persistence. Invalid/native selection metadata cases already covered by evidence preparation suites were preserved and rerun.
- New receipt cancellation covers the processing wait, transport signal forwarding and file retention. Immediate native transfer cancellation relies on Axios/native adapter behaviour; no real provider request is performed. Browser evidence blob fetch has no added abort contract in this batch.
- Very long but finite server delays beyond native timer limits, corrupted SQL payload/schema variants beyond existing checks, all platform-specific listener/settings failures and recovery from real filesystem damage remain gaps. Finite millisecond checks do not introduce a policy cap on valid server delays.
- Alert adapters retain their implemented success/message checks; exhaustive alert record schemas and all incident pagination bounds are not validated here. These tests preserve existing contracts rather than inventing server fields or access policies.
- The existing duplicate-worker, claim/recovery, old-account response, authorization-pause, manual cooldown and interrupted-draft assertions remain in the full safe suite. No tests were deleted, weakened, disabled or skipped to force passing totals.
- Earlier public sensor/risk access policy, out-of-order telemetry, distinct-animal density, validation/transaction decisions and later validator/service gaps remain unresolved. Batch 5, measured coverage and SOLID work are unstarted.

**Stop after Batch 4 and await approval.**

### Batch 4 verified case table

All 101 new IDs below were matched to unique passed assertions in the final mobile JSON report. Native/network/file providers are mocked; SQLite operations use the existing isolated test database only.

| Test Case ID | Module | Scenario | Test Type | Input | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|---|---|---|---|
| B4-ALERT-01 | Alert API | listAlerts preserves implemented endpoint, payload, signal and result | Positive/filtering | Page2 ACTIVE list and signal | GET alerts with same query/signal; unwrap envelope | As expected in final full suite | Pass |
| B4-ALERT-02 | Alert API | getAlertById preserves implemented endpoint, payload, signal and result | Positive | Alert a and signal | GET detail; return alert record | As expected in final full suite | Pass |
| B4-ALERT-03 | Alert API | getUnreadAlertsCount preserves implemented endpoint, payload, signal and result | Boundary | Unread count0 and signal | GET unread-count; preserve zero | As expected in final full suite | Pass |
| B4-ALERT-04 | Alert API | markAlertAsRead preserves implemented endpoint, payload, signal and result | Positive | Read a and signal | POST read with empty body; same result | As expected in final full suite | Pass |
| B4-ALERT-05 | Alert API | markAllAlertsAsRead preserves implemented endpoint, payload, signal and result | Positive | Read-all and signal | POST read-all with empty body; same result | As expected in final full suite | Pass |
| B4-ALERT-06 | Alert API | acknowledgeAlert preserves implemented endpoint, payload, signal and result | Positive | Acknowledge a and signal | POST acknowledge; same result | As expected in final full suite | Pass |
| B4-ALERT-07 | Alert API | updateAlertStatus preserves implemented endpoint, payload, signal and result | Positive | Resolve a and signal | PATCH status with RESOLVED body; same result | As expected in final full suite | Pass |
| B4-ALERT-08 | Alert API | getAlertsRequiringAttention preserves implemented endpoint, payload, signal and result | Positive/filtering | Attention page1 and signal | GET attention with query; same result | As expected in final full suite | Pass |
| B4-ALERT-09 | Alert API | respondToAlert preserves implemented endpoint, payload, signal and result | Positive | Respond a with Checked note | POST respond preserves payload/signal | As expected in final full suite | Pass |
| B4-ALERT-10 | Alert API | forwardAlert preserves implemented endpoint, payload, signal and result | Positive | Forward a to r | POST forward preserves payload/signal | As expected in final full suite | Pass |
| B4-ALERT-11 | Alert API | escalateAlert preserves implemented endpoint, payload, signal and result | Positive | Escalate a with Critical reason | POST escalate preserves payload/signal | As expected in final full suite | Pass |
| B4-ALERT-12 | Alert API | getAlertEscalations preserves implemented endpoint, payload, signal and result | Positive | Escalations for a | GET escalations with signal; same result | As expected in final full suite | Pass |
| B4-ALERT-13 | Alert API | omitted list arguments use default query and no signal | Default/empty | No list arguments | Empty params and undefined signal | As expected in final full suite | Pass |
| B4-ALERT-14 | Alert API | server-declared failure preserves current meaningful error contract | Negative | Server false/Alert locked | Current meaningful error message | As expected in final full suite | Pass |
| B4-ALERT-15 | Alert API | missing server message falls back to actionable error | Error | Server false/no message | Actionable fallback | As expected in final full suite | Pass |
| B4-ALERT-16 | Alert API | HTTP 401 rejection is propagated without retries | Authorization/error | HTTP401 on status write | Original error; no retry | As expected in final full suite | Pass |
| B4-ALERT-17 | Alert API | HTTP 503 rejection is propagated without retries | Error | HTTP503 on status write | Original error; no retry | As expected in final full suite | Pass |
| B4-ALERT-18 | Alert API | cancelled request propagates original cancellation | Cancellation | Cancelled detail request | Same cancellation error propagated | As expected in final full suite | Pass |
| B4-GPS-01 | One-shot location service | permission response normalizes grant and canAskAgain | Permission | Granted then denied native responses | Normalize grant/canAskAgain boolean fields | As expected in final full suite | Pass |
| B4-GPS-02 | One-shot location service | native permission exception returns denied recovery information | Error/permission | Permission API exception | Denied and cannot ask again; error information retained | As expected in final full suite | Pass |
| B4-GPS-03 | One-shot location service | service-check exception preserves attempt-location fallback | Characterization/error | Service-enabled check throws | Attempt-location fallback true | As expected in final full suite | Pass |
| B4-GPS-04 | One-shot location service | disabled GPS stops before requesting permissions or position | Negative | Location services disabled | GPS_DISABLED; no permission or position call | As expected in final full suite | Pass |
| B4-GPS-05 | One-shot location service | denied permission stops before reading position | Permission/negative | Native permission denied | PERMISSION_DENIED; no position call | As expected in final full suite | Pass |
| B4-GPS-06 | One-shot location service | GPS coordinates preserve six decimals and round accuracy | Precision | 7.51234567/80.71234567; accuracy10.6 | Six decimal coordinates; accuracy11; Balanced request | As expected in final full suite | Pass |
| B4-GPS-07 | One-shot location service | exact latitude -90 longitude -180 boundaries are valid | Boundary | Latitude-90 longitude-180 | Accepted inclusive minima | As expected in final full suite | Pass |
| B4-GPS-08 | One-shot location service | exact latitude 90 longitude 180 boundaries are valid | Boundary | Latitude90 longitude180 | Accepted inclusive maxima | As expected in final full suite | Pass |
| B4-GPS-09 | One-shot location service | exact latitude 0 longitude 0 boundaries are valid | Boundary | Origin0/0 | Accepted; absent accuracy null | As expected in final full suite | Pass |
| B4-GPS-10 | One-shot location service | invalid GPS reading null is unavailable | Negative | Null native position | UNAVAILABLE | As expected in final full suite | Pass |
| B4-GPS-11 | One-shot location service | invalid GPS reading {} is unavailable | Negative | Missing coords | UNAVAILABLE | As expected in final full suite | Pass |
| B4-GPS-12 | One-shot location service | invalid GPS reading {"coords":{"latitude":"7","longitude":80}} is unavailable | Negative | String latitude | UNAVAILABLE | As expected in final full suite | Pass |
| B4-GPS-13 | One-shot location service | invalid GPS reading {"coords":{"latitude":null,"longitude":80}} is unavailable | Negative | NaN latitude | UNAVAILABLE | As expected in final full suite | Pass |
| B4-GPS-14 | One-shot location service | invalid GPS reading {"coords":{"latitude":90.000001,"longitude":80}} is unavailable | Boundary/negative | Latitude90.000001 | UNAVAILABLE | As expected in final full suite | Pass |
| B4-GPS-15 | One-shot location service | invalid GPS reading {"coords":{"latitude":7,"longitude":-180.000001}} is unavailable | Boundary/negative | Longitude-180.000001 | UNAVAILABLE | As expected in final full suite | Pass |
| B4-GPS-16 | One-shot location service | native timeout error maps safely and releases timer | Timeout/cleanup | Native timed-out error | TIMEOUT; timeout timer cleared | As expected in final full suite | Pass |
| B4-GPS-17 | One-shot location service | native exception returns generic unavailable without private native detail | Error/privacy | Private native position error | Generic UNAVAILABLE; no raw detail | As expected in final full suite | Pass |
| B4-GPS-18 | One-shot location service | pending GPS times out exactly at configured boundary and clears timer | Boundary/timeout | Pending fix; timeout1000; advance999 then1ms | Pending before boundary; TIMEOUT at boundary; no timer left | As expected in final full suite | Pass |
| B4-GPS-19 | One-shot location service | accuracy 0 preserves valid zero or safely drops invalid metadata | Regression/boundary | Accuracy0 with valid coordinates | Preserve zero accuracy | Failed before fix; passed after | Pass |
| B4-GPS-20 | One-shot location service | accuracy "invalid" preserves valid zero or safely drops invalid metadata | Regression/negative | Accuracy invalid string with valid coordinates | Keep position; unknown accuracy null | Failed before fix; passed after | Pass |
| B4-GPS-21 | One-shot location service | accuracy -1 preserves valid zero or safely drops invalid metadata | Regression/negative | Accuracy-1 with valid coordinates | Keep position; unknown accuracy null | Failed before fix; passed after | Pass |
| B4-HEALTH-01 | Mobile API health hook | healthy API transitions Checking to connected with signal | Positive/async | Successful connected health reply | Checking then connected; AbortSignal forwarded | As expected in final full suite | Pass |
| B4-HEALTH-02 | Mobile API health hook | malformed or unhealthy {"success":false,"database":"connected"} returns safe state | Negative | success false/database connected | API unavailable | As expected in final full suite | Pass |
| B4-HEALTH-03 | Mobile API health hook | malformed or unhealthy {"success":true,"database":"disconnected"} returns safe state | Negative | success true/database disconnected | API unavailable | As expected in final full suite | Pass |
| B4-HEALTH-04 | Mobile API health hook | malformed or unhealthy null returns safe state | Malformed/error | Null health data | Unavailable or not configured | As expected in final full suite | Pass |
| B4-HEALTH-05 | Mobile API health hook | health transport error gives recoverable unavailable state | Network/error | Health API rejects | Recoverable unavailable/not configured state | As expected in final full suite | Pass |
| B4-HEALTH-06 | Mobile API health hook | unmount aborts request and ignores late health success | Cancellation/cleanup | Unmount pending health; late success | Abort signal; no late state change | As expected in final full suite | Pass |
| B4-RES-01 | Incident resource hook | focus resource publishes confirmed data and finishes loading | Positive | Focused loader resolves id i | Data published; loading false; signal passed | As expected in final full suite | Pass |
| B4-RES-02 | Incident resource hook | refresh aborts previous request and ignores its late success | Async/cancellation | Refresh pending old request; current success then old success | Abort old request; keep new data | As expected in final full suite | Pass |
| B4-RES-03 | Incident resource hook | old failure after refresh cannot overwrite successful current data | Async/error | Refresh pending old request; current success then old rejection | Keep new data; no stale error | As expected in final full suite | Pass |
| B4-RES-04 | Incident resource hook | synchronous loader exception is sanitized and refresh recovers | Error/retry | Synchronous private loader exception then refresh success | Safe error; recovery clears it | As expected in final full suite | Pass |
| B4-RES-05 | Incident resource hook | unmount aborts pending focus resource and late failure stays ignored | Cleanup | Unmount pending focus resource then late failure | Abort signal; ignored error | As expected in final full suite | Pass |
| B4-CLIENT-01 | Actual mobile Axios client | actual health client carries bearer auth and cancellation signal | Positive/authentication | Fixture bearer token; signal; deterministic adapter | Health path/baseURL/header/signal preserved; response unwrapped | As expected in final full suite | Pass |
| B4-CLIENT-02 | Actual mobile Axios client | pre-aborted actual Axios request never reaches transport | Cancellation | Pre-aborted signal | Axios cancels before transport adapter | As expected in final full suite | Pass |
| B4-CLIENT-03 | Actual mobile Axios client | actual client transport rejection reaches caller unchanged | Error | Adapter rejects fixture offline | Original error propagated | As expected in final full suite | Pass |
| B4-INC-01 | Incident API extensions | malformed incident detail null cannot confirm a record | Malformed | Null detail response | No confirmed incident | As expected in final full suite | Pass |
| B4-INC-02 | Incident API extensions | malformed incident detail {"success":false,"incident":{"id":"i"}} cannot confirm a record | Malformed | success false with incident ID | No confirmed incident | As expected in final full suite | Pass |
| B4-INC-03 | Incident API extensions | malformed incident detail {"success":true,"incident":{}} cannot confirm a record | Malformed | success true but missing incident ID | No confirmed incident | As expected in final full suite | Pass |
| B4-INC-04 | Incident API extensions | malformed incident pagination {"success":true,"incidents":[],"total":"0","page":1,"pageSize":25} is rejected | Malformed | String total in list | Reject pagination envelope | As expected in final full suite | Pass |
| B4-INC-05 | Incident API extensions | malformed incident pagination {"success":true,"incidents":{},"total":0,"page":1,"pageSize":25} is rejected | Malformed | Object incidents instead of array | Reject list envelope | As expected in final full suite | Pass |
| B4-INC-06 | Incident API extensions | malformed incident pagination {"success":true,"incidents":[],"total":0,"page":1.5,"pageSize":25} is rejected | Boundary/negative | Fractional page1.5 | Reject pagination envelope | As expected in final full suite | Pass |
| B4-INC-07 | Incident API extensions | create forwards cancellation and stable idempotency options | Positive/cancellation | Create with signal and stable idempotency header | Exact options forwarded unchanged | As expected in final full suite | Pass |
| B4-INC-08 | Incident API extensions | malformed context fails before any HTTP write | Authorization/context | Blank patrol context | Fail before HTTP write | As expected in final full suite | Pass |
| B4-INC-09 | Incident API extensions | failed edit retains original server rejection without retry | Conflict/error | Edit409 INCIDENT_LOCKED | Original rejection; no automatic retry | As expected in final full suite | Pass |
| B4-INC-10 | Incident API extensions | cancelled detail fetch preserves cancellation error and exact signal | Cancellation | Cancelled detail and signal | Same error and exact request signal | As expected in final full suite | Pass |
| B4-WATCH-01 | Foreground GPS watcher | native subscription rejection shows recovery state and retry establishes new watcher | Error/retry/precision | Watcher rejects once then succeeds; precise fix/timestamp | Recovery state; new watcher; preserve precision/time; remove subscription | As expected in final full suite | Pass |
| B4-WATCH-02 | Foreground GPS watcher | native watcher error callback clears position without leaking subscription | Native error/cleanup | Watch error callback with private detail | Clear position; safe recovery message; cleanup subscription | As expected in final full suite | Pass |
| B4-WATCH-03 | Foreground GPS watcher | retry removes old watcher and late old callback cannot update new subscription | Subscription/async | Retry current watcher; old callback then current fix | Remove old subscription; ignore old callback; accept current one | As expected in final full suite | Pass |
| B4-WATCH-04 | Foreground GPS watcher | missing timestamp and out-of-range coordinates cannot become navigation positions | Negative | Missing timestamp then out-of-range coordinates | No navigation position; GPS_UNAVAILABLE | As expected in final full suite | Pass |
| B4-WATCH-05 | Foreground GPS watcher | exact fix age and accuracy limits are inclusive, one extra millisecond rejects | Boundary | Exact maximum accuracy/fix age then one extra millisecond | Inclusive valid boundary; older fix rejected | As expected in final full suite | Pass |
| B4-WEB-01 | Browser offline storage | browser database explicitly rejects unsupported durable storage | Unsupported/negative | Browser database call | Explicit native-app-only rejection | As expected in final full suite | Pass |
| B4-WEB-02 | Browser offline storage | browser enqueueGps explicitly rejects unsupported durable storage | Unsupported/negative | Browser enqueueGps call | Explicit native-app-only rejection | As expected in final full suite | Pass |
| B4-WEB-03 | Browser offline storage | browser saveDraft explicitly rejects unsupported durable storage | Unsupported/negative | Browser saveDraft call | Explicit native-app-only rejection | As expected in final full suite | Pass |
| B4-WEB-04 | Browser offline storage | browser pending explicitly rejects unsupported durable storage | Unsupported/negative | Browser pending query | Explicit native-app-only rejection | As expected in final full suite | Pass |
| B4-WEB-05 | Browser offline storage | browser retryAfter explicitly rejects unsupported durable storage | Unsupported/negative | Browser retryAfter query | Explicit native-app-only rejection | As expected in final full suite | Pass |
| B4-WEB-06 | Browser offline storage | browser trail transform deduplicates equivalent timestamps and lets server replace local | Transform/boundary | Timezone-equivalent local/server point plus earlier fix | Deduplicate; server replaces local; ascending time; local unchanged | As expected in final full suite | Pass |
| B4-EVID-01 | Incident evidence failures | missing local file fails preparation before any HTTP and retains local metadata | Local metadata/error | Preparation LOCAL_MEDIA_UNAVAILABLE | No HTTP; retain item; reselection guidance | As expected in final full suite | Pass |
| B4-EVID-02 | Incident evidence failures | malformed confirmation null never discards local evidence | Malformed | Null upload confirmation | Reject without local discard | As expected in final full suite | Pass |
| B4-EVID-03 | Incident evidence failures | malformed confirmation {"success":true,"evidence":{}} never discards local evidence | Malformed | Missing evidence ID | Reject without local discard | As expected in final full suite | Pass |
| B4-EVID-04 | Incident evidence failures | malformed confirmation {"success":false,"evidence":{"id":"e"}} never discards local evidence | Malformed | success false despite evidence ID | Reject without local discard | As expected in final full suite | Pass |
| B4-EVID-05 | Incident evidence failures | invalid receipt identifier fails before status polling | Security/negative | Processing receipt id ../other | Reject before status polling | As expected in final full suite | Pass |
| B4-EVID-06 | Incident evidence failures | expired receipt rejection retains item and supports stable-key retry | Receipt expiry/retry | 404 UPLOAD_RECEIPT_UNAVAILABLE then confirmed retry | Retain item; same upload key; discard only after success | As expected in final full suite | Pass |
| B4-EVID-07 | Incident evidence failures | status network interruption rejects once and preserves item for retry | Network/error | Receipt-status transport interrupted | Reject once with client diagnostic; retain file | As expected in final full suite | Pass |
| B4-EVID-08 | Incident evidence failures | malformed polling response rejects without invented evidence ID | Malformed | COMPLETE status without evidence ID | No invented success or discard | As expected in final full suite | Pass |
| B4-EVID-09 | Incident evidence failures | expired ticket at 2025-12-31T23:59:59.999Z cannot be returned as accessible | Regression/expiry | Media ticket1ms before fixed clock | Reject inaccessible ticket | Failed before fix; passed after | Pass |
| B4-EVID-10 | Incident evidence failures | expired ticket at 2026-01-01T00:00:00.000Z cannot be returned as accessible | Regression/boundary | Media ticket exactly at fixed clock | Reject expired ticket | Failed before fix; passed after | Pass |
| B4-EVID-11 | Incident evidence failures | abort during receipt wait settles promptly without polling or discarding | Regression/cancellation | Abort signal during1s receipt wait | Settle without waiting/polling; retain file | Failed before fix; passed after | Pass |
| B4-EVID-12 | Incident evidence failures | retainLocal success keeps queued media and safe diagnostics exclude raw provider text | Positive/privacy | retainLocal confirmed upload; unknown provider/private diagnostic | Keep file; no raw provider/error reference leakage | As expected in final full suite | Pass |
| B4-EVID-13 | Incident evidence failures | processing deadline stops polling with timeout and retains local file | Boundary/timeout | PROCESSING throughout240000ms | ETIMEDOUT; no file discard; no polling timer left | As expected in final full suite | Pass |
| B4-SYNC-01 | Offline synchronization cooldown | retry delay {"headers":{"retry-after":"Thu, 01 Jan 2026 00:01:00 GMT"}} persists finite boundary 60000 ms | HTTP date/persistence | 429 Retry-After 1Jan2026 00:01GMT; fixed clock00:00 | Persist60s; restart/manual retry blocked until exact boundary | As expected in final full suite | Pass |
| B4-SYNC-02 | Offline synchronization cooldown | retry delay {"data":{"retryAfterSeconds":7}} persists finite boundary 7000 ms | Body/persistence | retryAfterSeconds numeric7 | Persist7s; recover at exact boundary | As expected in final full suite | Pass |
| B4-SYNC-03 | Offline synchronization cooldown | retry delay {"data":{"retryAfterSeconds":"12"}} persists finite boundary 12000 ms | Body/persistence | retryAfterSeconds string12 | Persist12s; recover at exact boundary | As expected in final full suite | Pass |
| B4-SYNC-04 | Offline synchronization cooldown | retry delay {"data":{"retryAfterSeconds":-3}} persists finite boundary 5000 ms | Negative/persistence | retryAfterSeconds-3 | Existing5s fallback; no early retry | As expected in final full suite | Pass |
| B4-SYNC-05 | Offline synchronization cooldown | retry delay {"data":{"retryAfterSeconds":"invalid"}} persists finite boundary 5000 ms | Regression/error | retryAfterSeconds invalid string | Finite5s fallback; no stuck SYNCING or storage error | Failed before fix; passed after | Pass |
| B4-SYNC-06 | Offline synchronization cooldown | retry delay {"data":{"retryAfterSeconds":"Infinity"}} persists finite boundary 5000 ms | Regression/error | retryAfterSeconds Infinity string | Finite5s fallback; no infinite cooldown | Failed before fix; passed after | Pass |
| B4-SYNC-07 | Offline synchronization cooldown | retry delay {"headers":{"retry-after":"-4"}} persists finite boundary 5000 ms | Negative/persistence | Retry-After-4 | Existing5s fallback | As expected in final full suite | Pass |
| B4-SYNC-08 | Offline synchronization cooldown | retry delay {"headers":{"retry-after":"invalid"}} persists finite boundary 5000 ms | Negative/persistence | Retry-After invalid | Existing5s fallback | As expected in final full suite | Pass |
| B4-SYNC-09 | Offline synchronization cooldown | retry delay {"headers":{"retry-after":"10"},"data":{"retryAfterSeconds":20}} persists finite boundary 20000 ms | Precedence/persistence | Header10s plus body20s | Respect larger20s delay | As expected in final full suite | Pass |
| B4-SYNC-10 | Offline synchronization cooldown | retry delay {"data":{"retryAfterSeconds":"1e308"}} persists finite boundary 5000 ms | Regression/boundary | Finite seconds1e308 overflow after conversion | Finite5s fallback; no infinite stored cooldown | Failed before fix; passed after | Pass |
| B4-STORE-01 | Native isolated SQLite failures | GPS write failure is observable and does not invent saved data | Write/error | GPS runAsync disk-full rejection | Propagate; no invented saved row | As expected in final full suite | Pass |
| B4-STORE-02 | Native isolated SQLite failures | trail read failure propagates and existing row survives recovery | Read/recovery | Read rejection after stored GPS | Propagate; original row readable after recovery | As expected in final full suite | Pass |
| B4-STORE-03 | Native isolated SQLite failures | failed cache replacement rolls back deletion and partial inserts | Transaction/regression | Cache replacement fails on second insert | Rollback deletion/partial inserts; old cache remains | As expected in final full suite | Pass |
| B4-STORE-04 | Native isolated SQLite failures | coordinator storage query failure retains queued GPS and manual retry recovers | Sync storage/recovery | Pending query fails then storage recovers | Safe storage state; retain GPS; manual retry syncs once | As expected in final full suite | Pass |

## Phase 3 Checkpoint B — Batch 5 completed (14 October 2026)

### Remaining-gap review and implemented scope

Compared the existing source modules, audit inventory and Batches 1–4 with their implemented assertions. Batch 5 adds **71 backend tests**, with unique executed B5 IDs. It adds no tests for empty scaffolds and no coverage tooling or SOLID changes. Direct service failures supplement successful HTTP flows; they do not replace existing role/ownership or API tests.

| Reviewed module | Prior coverage and remaining seam | Batch 5 addition |
|---|---|---|
| Authentication/registration | Existing login/registration/approval API contracts; direct byte/field boundaries missing | 12 validator cases: exact UTF-8/name/park limits, normalized whitelisted output, public role restrictions, login compatibility |
| Community reporting | Existing populated API, anonymous/liaison/status/SMS flows; direct validator/failure and zero-coordinate handoff gaps | 12 validator and 8 service cases: coordinates, description/evidence/page/search limits, immutable privacy, transition failure ordering, repository errors and forwarding authorization |
| Alert service | Existing 62 HTTP scenarios; direct exact expiry/write-failure seams missing | 8 cases: exact 72h and +1ms, missing user before access, acknowledgement/list/count/read/batch failures |
| SMS service | Existing parser/HTTP/deduplication flows; capacity/failure recovery missing | 5 cases: sender-lookup fallback, uncached failed creation, normalized replay, exact5000 and overflow5001 cache entries |
| Conservation reports/exports | Batch1 populated inclusive date filtering and Batch3 web PDF/download contracts already exist | 7 export, 6 request validator and 2 populated generation cases: HTML/CSV escaping, privacy, 50/51 row boundary, equal/reversed/malformed dates, zero-coordinate summary/detail agreement |
| Analytics | Existing aggregation/bucketing/scope/filter unit and API cases | 3 repository rejection cases; no fabricated zero totals after errors |
| Centralized error middleware | Existing API error envelopes but direct whitelist/trace/header branches insufficient | 8 cases: SQL/payload privacy, safe400/413/500, headers-sent delegation, evidence no-store, navigation retry, approval metadata and registration diagnostics |
| Ranger patrol/incident authorization | Existing wrong-Ranger/manager/read-only/review/ownership API matrices plus Batch1 service, lifecycle, navigation, idempotency and receipt cases | Preserved and rerun; no duplicated matrix or invented service-layer policy |
| Web, mobile, sensor dashboard and shared | Existing functional expansion from Batches1–4 and shared lifecycle/geometry tests | No source/config/dependency changes here; all four complete guarded suites rerun |

### Defects demonstrated before production changes

The corrected affected pre-fix run was **84 passed / 7 failed across 10 suites** (`.cache/batch5-regression-before.json`). After minimal corrections, the identical affected set was **91 passed / 0 failed across 10 suites** (`.cache/batch5-affected-after.json`). Seven regression IDs then passed again in the full backend suite:

1. **B5-COM-01: zero GPS coordinates lost in community handoff.** `latitude || null` / `longitude || null` converted valid zero to null in both delegated incident data and returned handoff. Replace four expressions with nullish coalescing. No new coordinates, authorization or dispatch policy introduced.
2. **B5-RPT-01/02: zero GPS coordinates displayed as Unknown.** Incident and community detail mapping used a truthy pair check. Check both coordinates for null/undefined instead. Deterministic one-record fixtures now display `0, 0`, and summary totals equal detail-row counts.
3. **B5-EXPORT-01/02: executable HTML in report names/filters.** Generated-by name, area/filter values and incident/ranger names bypassed the existing HTML escaping helper. Apply that helper to those fields. Text, report structure, dates and API contracts are retained; script/image/SVG test payloads render as escaped text.
4. **B5-EXPORT-03: malformed CSV for metadata and free-text names.** Metadata/filter values and incident/patrol names were inserted without CSV quoting, so commas, quotes and newlines created extra cells/rows. A small cell formatter quotes delimiter-bearing free text and doubles quotes. Ordinary cells retain their output; existing explicitly quoted title/location/species fields are preserved. This correction addresses CSV syntax, not spreadsheet formula neutralization.
5. **B5-SMS-05: deduplication cache capacity off by one.** Eviction used `size > 5000` before insertion. Change to `>= 5000` so exactly5000 remain retained and insertion5001 evicts the oldest. Existing successful-replay and failed-retry behavior is unchanged. This is the source's existing documented cache capacity, not a new retention policy.

The initial draft run (`.cache/batch5-before.json`) had 61 passed / 8 failed: five genuine regressions plus three mistakes in the new report-validator tests. Those tests initially supplied `dateFrom/dateTo` and `incident_report`, while the implemented request contract is `from/to` and `INCIDENT`. Corrected the tests, strengthened the equal-date assertion to check an actual Date, and added the two populated report regressions **before** applying production fixes. The corrected84/7 evidence above is the application-defect baseline; initial harness mistakes are not claimed as bugs.

### Unresolved security and behavior decisions

- **Sensor/risk-zone authorization:** `sensor.routes.js` and `riskZone.routes.js` attach controllers directly without authentication middleware. Existing Batch2 API tests characterize public reads and mutations. Confirm caller identities, roles, park scope and any trusted collar/webhook mechanism before restricting access. No policy added in Batch5.
- **Telemetry ordering:** `sensor.service.addSensorData` updates the latest row whenever `incomingTime - latestTime < oneHour`; negative differences therefore let an older fix replace a newer timestamp and position. Existing B2 cases demonstrate this. Confirm whether to reject, preserve as history or reorder delayed telemetry before changing behavior.
- **Wildlife density:** `sensor.repository.calculateDensityZones` groups same-species location rows within an inclusive radius and uses their count for the minimum-three rule. Multiple records from one animal can count repeatedly and repeat its code. Confirm distinct-animal/latest-fix semantics and the observation window; no count change made.
- **Transactional deletion/retention:** `riskZone.repository.deleteRiskZone` deletes related alerts, then deletes the zone without `$transaction`. A zone-delete failure can leave the zone while losing alert records; Batch2 already characterizes this failure sequence. Confirm atomic deletion and audit/retention expectations before changing it. Animal deletion still delegates to the ORM; real foreign-key/cascade behavior is not verified by mocks.
- **Community handoff ordering:** the service's PENDING-to-UNDER_REVIEW write precedes the forwarding repository transaction. A later forwarding failure can leave the review transition recorded; new tests verify failed review prevents forwarding and repository failure propagates. Confirm rollback expectations before moving this transition into a transaction.

### Batch 5 files modified

Production, limited to demonstrated corrections:

1. `backend/src/services/communityReport.service.js`
2. `backend/src/services/report.service.js` (retains Batch1 date fix)
3. `backend/src/services/sms/smsGateway.service.js`
4. `backend/src/utils/export.util.js`

Tests:

5. `backend/tests/report.service.test.js` — two added populated coordinate regressions; existing assertions retained.
6. `backend/tests/unit/auth/auth.validator.test.js` — new.
7. `backend/tests/unit/communityReport/communityReport.validator.test.js` — new.
8. `backend/tests/unit/communityReport/communityReport.failures.test.js` — new.
9. `backend/tests/unit/communityReport/sms.failures.test.js` — new.
10. `backend/tests/unit/monitoring/alert.failures.test.js` — new.
11. `backend/tests/unit/reports/export.contracts.test.js` — new.
12. `backend/tests/unit/reports/report.validator.test.js` — new.
13. `backend/tests/unit/error.middleware.test.js` — new.
14. `backend/tests/unit/analytics/analytics.failures.test.js` — new.

Documentation:

15. `docs/testing-and-refactoring/PHASE_3_TEST_EXPANSION.md` — this Batch5 inventory, review, fixes, evidence, results and all71 verified rows.

Ignored test-only evidence and documentation helpers are under `.cache/batch5-*`; they are listed below separately from the15 repository files. Older uncommitted changes from Phases2A/2B and Batches1–4 were retained, not attributed to this batch.

### Safety and limits

Phase2A configs/resolver/setup/transport guards were inspected and retained unchanged. Backend imports of the real database/environment/drivers remain blocked; explicit mock factories are deterministic. Dummy database settings and blocked Prisma constructors prevent environment-loading bypass. External fetch/HTTP/socket/DNS/provider requests remain blocked; existing authorized in-process Supertest loopback remains available only to designated API suites. Frontend/network isolation tests are included in full verification. The existing native mobile SQLite fixture uses test-only temporary files and cleanup, never device/user storage. No `.env` files or secret values were read or modified. No live database, provider, migration, seed, reset or unsafe standalone script was run. No commit, push, merge or branch switch was performed.

No claim of100% coverage is made. Passing test counts are execution evidence, not measured line/branch/function coverage. Empty scaffolds, real PostgreSQL query/foreign-key behavior, real providers, browser/native end-to-end, map tiles/hardware GPS/camera and deployment integration remain outside this isolated plan. Additional validation questions include calendar-rollover date normalization, schema-driven strict sensor/risk input validation and spreadsheet formula handling; these were reviewed but are not claimed fixed or fully tested. Existing populated filter/bucket matrices remain intact; this batch supplements them rather than claiming exhaustive combinations.

Batch5 ends after final four-application verification. Coverage tooling, SOLID analysis/refactoring and new policy changes await approval.

### Final execution evidence

| Application | Before | New Batch5 cases | Final passed | Suites/test files | Failed | Skipped/pending | Todo |
|---|---:|---:|---:|---:|---:|---:|---:|
| Backend | 976 | 71 | **1047** | **58 Jest suites** | 0 | 0 | 0 |
| Web | 404 | 0 | **404** | **38 Vitest files** | 0 | 0 | 0 |
| Mobile | 632 | 0 | **632** | **53 Jest suites** | 0 | 0 | 0 |
| Sensor dashboard | 30 | 0 | **30** | **3 Vitest files** | 0 | 0 | 0 |
| Total | 2042 | **71** | **2113** | **152** | **0** | **0** | **0** |

All four final commands exited0. `.cache/batch5-document.cjs` compares passed full assertion names to `.cache/batch2-backend-full.json`, `.cache/batch3-web-full.json`, `.cache/batch4-mobile-full.json` and `.cache/batch2-sensor-full.json`. All2042 prior assertions remain present/passing; the only name normalization is the existing incident-evidence title's runtime `withdrawnAt` value. It also matches all71 unique B5 IDs, their passed statuses, and the seven pre-fix failures. `.cache/batch5-verification.json` records these checks. Counts are not measured coverage.

**Warnings and handles:** Backend and mobile full runs used `--detectOpenHandles`; each reports an empty `openHandles` array. No backend/mobile React act warning, unhandled rejection or unexpected console error was found. Mobile retains one Node `ExperimentalWarning` for the existing isolated SQLite fixture; it was not suppressed. Sensor final output has expected fixture/code-generation stdout, no warning/error diagnostic, and exits normally. Vitest does not expose Jest's open-handle array, so no equivalent formal zero-handle claim is made for web/sensor.

The final web default reporter captured **27 React act warnings**, originating from the unknown-page ZoneAlertProvider, pending patrol list, CSV download completion, authenticated landing FieldMap and live-monitoring/ranger-tracking polling tests (including Leaflet MapContainer updates). It also captured **one `Error loading data: TEST_NETWORK_BLOCKED`** in the authenticated landing FieldMap test: that test mounts the real map without an explicit sensor API mock. The guard prevents the actual request; this is an incomplete test mock/async-settlement gap, not a live-provider call or assertion failure. No global warning/error suppression was added, and no production behavior was changed for these diagnostics. They remain reliability cleanup work requiring a later approved scope. Web/sensor final runners exited normally; no timeout/open-handle message appeared, but act warnings mean the suite is not warning-clean.

**Incomplete first attempts:** The initial simultaneous four-application verification completed backend/mobile, but web/sensor processes exited1 with truncated JSON inventories (web378 tests/36 files; sensor7 tests/1 file). Their partial JSON nevertheless contained `success:true` and no assertion failures; they were rejected as complete evidence because prior cases were missing. No definitive worker-termination cause was exposed by the JSON-only reporter. Preserve these as `batch5-web-full-first.{json,log}` and `batch5-sensor-full-first.{json,log}`. Web then sensor were rerun alone with one worker plus default and JSON reporters. All404/38 and30/3 finished with exit0. No implemented test in the guarded configurations remains unable to execute in the final runs. Empty scaffolds and unsafe standalone scripts are deliberately outside discovery, as before.

### Exact commands and evidence files

Commands use the ordinary user account outside the managed Node sandbox because of the previously diagnosed Windows Node realpath EPERM. No administrator elevation, cache cleanup, package installation, production environment change or unrelated deletion was required. Every application retains its guarded configuration. Paths below are relative to `C:\Users\Lihini\Desktop\WildGuard LK\wildguard-lk`.

Affected run, cwd `backend` (run before source corrections using `batch5-regression-before`, and after corrections using `batch5-affected-after`):

```powershell
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/unit/auth/auth.validator.test.js tests/unit/communityReport/communityReport.validator.test.js tests/unit/communityReport/communityReport.failures.test.js tests/unit/communityReport/sms.failures.test.js tests/unit/monitoring/alert.failures.test.js tests/unit/reports/export.contracts.test.js tests/unit/reports/report.validator.test.js tests/unit/error.middleware.test.js tests/unit/analytics/analytics.failures.test.js tests/report.service.test.js --json --outputFile=../.cache/batch5-regression-before.json *> ../.cache/batch5-regression-before.log
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/unit/auth/auth.validator.test.js tests/unit/communityReport/communityReport.validator.test.js tests/unit/communityReport/communityReport.failures.test.js tests/unit/communityReport/sms.failures.test.js tests/unit/monitoring/alert.failures.test.js tests/unit/reports/export.contracts.test.js tests/unit/reports/report.validator.test.js tests/unit/error.middleware.test.js tests/unit/analytics/analytics.failures.test.js tests/report.service.test.js --json --outputFile=../.cache/batch5-affected-after.json *> ../.cache/batch5-affected-after.log
```

Full backend, cwd `backend`:

```powershell
node node_modules/jest/bin/jest.js --runInBand --detectOpenHandles --json --outputFile=../.cache/batch5-backend-full.json *> ../.cache/batch5-backend-full.log
```

Full web, cwd `web` (final successful run):

```powershell
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --reporter=default --reporter=json --outputFile=../.cache/batch5-web-full.json *> ../.cache/batch5-web-full.log
```

Full mobile, cwd `mobile`:

```powershell
node node_modules/jest/bin/jest.js --runInBand --detectOpenHandles --json --outputFile=../.cache/batch5-mobile-full.json *> ../.cache/batch5-mobile-full.log
```

Full sensor dashboard, cwd `sensor-dashboard` (final successful run):

```powershell
node ../web/node_modules/vitest/vitest.mjs run --config vitest.config.mjs --maxWorkers=1 --reporter=default --reporter=json --outputFile=../.cache/batch5-sensor-full.json *> ../.cache/batch5-sensor-full.log
```

Initial incomplete web/sensor commands used `--maxWorkers=2 --reporter=json` with the same output paths; their original files were copied to the `-first` evidence pairs before final reruns. The initial affected draft used the same nine new test paths but omitted `tests/report.service.test.js`, writing `batch5-before.{json,log}`.

Verification/table generation, cwd repository root:

```powershell
node .cache/batch5-document.cjs
git diff --check
```

Evidence/helper artifacts:

- `.cache/batch5-before.{json,log}` — initial test draft including explicitly documented harness mistakes.
- `.cache/batch5-regression-before.{json,log}` — corrected91-case failing application regression evidence.
- `.cache/batch5-affected-after.{json,log}` — same91 affected cases passing after corrections.
- `.cache/batch5-backend-full.{json,log}` — full1047/58 and open-handle diagnostics.
- `.cache/batch5-web-full-first.{json,log}` and `.cache/batch5-sensor-full-first.{json,log}` — retained incomplete attempts.
- `.cache/batch5-web-full.{json,log}` — final404/38 and unsuppressed warnings.
- `.cache/batch5-mobile-full.{json,log}` — full632/53 and open-handle/SQLite diagnostics.
- `.cache/batch5-sensor-full.{json,log}` — final30/3.
- `.cache/batch5-verification.json` — prior-case preservation, new counts and reproduced regression IDs.
- `.cache/batch5-document.cjs`, `.cache/batch5-case-table.md`, `.cache/batch5-summary.md`, `.cache/batch5-results.md` — ignored documentation assembly/check helpers.

`git diff --check` passed; Git separately reports existing LF/CRLF conversion notices for older modified files. No tests were skipped or assertions weakened to obtain these results. Batch5 is complete with the explicitly documented warning/policy gaps above; stop here for approval.

### Batch 5 verified case table

All 71 case IDs below map to unique passed assertions in the final backend JSON. Inputs are deterministic in-memory fixtures; no live database or provider was used.

| Test Case ID | Module | Scenario | Test Type | Input | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|---|---|---|---|
| B5-AUTH-01 | Authentication validators | normalization and default public role exclude client-owned fields | Positive/security | Whitespace and uppercase email; injected id/approval | Normalize; public role; return only allowed fields | Assertions passed in full guarded suite | Pass |
| B5-AUTH-02 | Authentication validators | exact 120-character name and 72-byte password accepted | Boundary | 120-char name; 72-byte UTF-8 password | Accept exact maxima | Assertions passed in full guarded suite | Pass |
| B5-AUTH-03 | Authentication validators | multibyte password above 72 bytes rejected | Negative/boundary | 73-byte multibyte password | 400 registration error on password | Assertions passed in full guarded suite | Pass |
| B5-AUTH-04 | Authentication validators | 121-character name rejected | Negative/boundary | 121-char name | 400 name diagnostic | Assertions passed in full guarded suite | Pass |
| B5-AUTH-05 | Authentication validators | self-registration cannot assign PARK_MANAGER | Authorization | PARK_MANAGER self-registration | 400 role diagnostic | Assertions passed in full guarded suite | Pass |
| B5-AUTH-06 | Authentication validators | ranger park identifier accepts exact 128-character boundary | Boundary | Ranger with 128-char park ID | Accept | Assertions passed in full guarded suite | Pass |
| B5-AUTH-07 | Authentication validators | ranger park identifier rejects 129 characters | Negative/boundary | Ranger with 129-char park ID | 400 requestedParkId diagnostic | Assertions passed in full guarded suite | Pass |
| B5-AUTH-08 | Authentication validators | non-ranger registration discards requested park | Security | Community role plus requested park | Discard park association | Assertions passed in full guarded suite | Pass |
| B5-AUTH-09 | Authentication validators | numeric phone rejected without coercion | Negative/type | Numeric phone | 400 phone diagnostic | Assertions passed in full guarded suite | Pass |
| B5-AUTH-10 | Authentication validators | login accepts existing short passwords without registration complexity | Compatibility | Existing one-char password at login | Accept; no registration complexity imposed | Assertions passed in full guarded suite | Pass |
| B5-AUTH-11 | Authentication validators | login preserves password whitespace | Boundary | Password containing surrounding spaces | Preserve exact password | Assertions passed in full guarded suite | Pass |
| B5-AUTH-12 | Authentication validators | login rejects multibyte passwords exceeding bcrypt byte limit | Negative/boundary | 74-byte login password | Auth validation rejection | Assertions passed in full guarded suite | Pass |
| B5-CVAL-01 | Community-report validators | zero coordinates accepted without manual location | Positive/boundary | Latitude0 longitude0; no location text | Accept coordinates | Assertions passed in full guarded suite | Pass |
| B5-CVAL-02 | Community-report validators | extreme latitude and longitude accepted inclusively | Boundary | (-90,180) and (90,-180) | Accept inclusive geographic bounds | Assertions passed in full guarded suite | Pass |
| B5-CVAL-03 | Community-report validators | nonfinite coordinates rejected even with manual location | Negative | Infinity latitude with manual location | Reject invalid coordinate | Assertions passed in full guarded suite | Pass |
| B5-CVAL-04 | Community-report validators | partial coordinate pair rejected | Negative | Latitude present; longitude null | Reject incomplete pair | Assertions passed in full guarded suite | Pass |
| B5-CVAL-05 | Community-report validators | description accepts exact minimum and maximum | Boundary | Description5 and2000 chars | Accept exact limits | Assertions passed in full guarded suite | Pass |
| B5-CVAL-06 | Community-report validators | description above maximum rejected | Negative/boundary | Description2001 chars | Reject | Assertions passed in full guarded suite | Pass |
| B5-CVAL-07 | Community-report validators | evidence accepts five and rejects six items | Boundary | Five evidence items then six | Accept five; reject six | Assertions passed in full guarded suite | Pass |
| B5-CVAL-08 | Community-report validators | anonymous identity discarded and input remains unchanged | Privacy/immutability | Anonymous with identity/status/owner fields | Null contacts; exclude owned fields; input unchanged | Assertions passed in full guarded suite | Pass |
| B5-CVAL-09 | Community-report validators | equivalent offset timestamps permit equal list boundaries | Date boundary | Equivalent timezone-offset from/to timestamps | Equal absolute Date values accepted | Assertions passed in full guarded suite | Pass |
| B5-CVAL-10 | Community-report validators | list accepts maximum page and search boundaries | Boundary | Page100000; search120 chars | Accept exact limits | Assertions passed in full guarded suite | Pass |
| B5-CVAL-11 | Community-report validators | list rejects overflow page and search length | Negative/boundary | Page100001 or search121 chars | Reject | Assertions passed in full guarded suite | Pass |
| B5-CVAL-12 | Community-report validators | terminal report can reopen for review but cannot directly switch terminal status | Lifecycle | VERIFIED to UNDER_REVIEW then direct REJECTED | Permit reopening; reject terminal switch | Assertions passed in full guarded suite | Pass |
| B5-COM-01 | Community-report service | forwarding preserves zero coordinates in incident and handoff | Regression/boundary | Anonymous report latitude0 longitude0 | Preserve0 in delegated incident and handoff | Failed before fix; passed in affected and full suites | Pass |
| B5-COM-02 | Community-report service | anonymous handoff excludes contacts from incident description | Privacy | Anonymous stored name/phone; staff forwarding | Exclude contacts in incident description; sanitized response | Assertions passed in full guarded suite | Pass |
| B5-COM-03 | Community-report service | duplicate lookup failure propagates and prevents creation | Error | Duplicate lookup rejects | Same error; no creation | Assertions passed in full guarded suite | Pass |
| B5-COM-04 | Community-report service | creation failure propagates without invented report | Error | Report creation rejects | Same error; one write attempt | Assertions passed in full guarded suite | Pass |
| B5-COM-05 | Community-report service | forwarding failure propagates without invented success | Error | Incident forwarding repository rejects | Propagate; no invented success | Assertions passed in full guarded suite | Pass |
| B5-COM-06 | Community-report service | failed pending-review transition prevents incident creation | Error/ordering | PENDING review transition rejects | Propagate; incident creation never attempted | Assertions passed in full guarded suite | Pass |
| B5-COM-07 | Community-report service | unauthorized forwarding rejected before repository access | Authorization | Ranger forwards community report | 403 before repository access | Assertions passed in full guarded suite | Pass |
| B5-COM-08 | Community-report service | anonymous public details remove ownership without mutating stored report | Privacy/immutability | Public anonymous details with stored owner/contact | Hide identity/owner; stored object unchanged | Assertions passed in full guarded suite | Pass |
| B5-ALERT-01 | Alert service | exactly 72-hour-old alert remains acknowledgeable | Boundary | Alert exactly72h old at fixed clock | Acknowledgement succeeds with exact user ID | Assertions passed in full guarded suite | Pass |
| B5-ALERT-02 | Alert service | one millisecond beyond expiry prevents acknowledgement write | Negative/boundary | Alert72h plus1ms old | 400; no acknowledgement write | Assertions passed in full guarded suite | Pass |
| B5-ALERT-03 | Alert service | missing user prevents read lookup and mutation | Authorization/error | markAsRead without user | 400 before lookup/mutation | Assertions passed in full guarded suite | Pass |
| B5-ALERT-04 | Alert service | acknowledgement repository failure remains observable | Error | Acknowledgement write rejects | Same error | Assertions passed in full guarded suite | Pass |
| B5-ALERT-05 | Alert service | list repository failure cannot return an empty success | Error | List query rejects | Same error; no empty success | Assertions passed in full guarded suite | Pass |
| B5-ALERT-06 | Alert service | unread count failure propagates | Error | Unread count rejects | Same error | Assertions passed in full guarded suite | Pass |
| B5-ALERT-07 | Alert service | read receipt failure propagates without success | Error | Read receipt write rejects | Same error; no success | Assertions passed in full guarded suite | Pass |
| B5-ALERT-08 | Alert service | mark-all failure propagates | Error | Mark-all repository rejects | Same error | Assertions passed in full guarded suite | Pass |
| B5-SMS-01 | SMS ingestion | sender lookup failure preserves existing ingestion fallback | Error/compatibility | Sender lookup rejects | Existing anonymous-user fallback; ingestion succeeds | Assertions passed in full guarded suite | Pass |
| B5-SMS-02 | SMS ingestion | failed submission is not cached and same provider ID can retry | Retry/error | Submission fails once; same provider ID retries | Failure uncached; second attempt succeeds | Assertions passed in full guarded suite | Pass |
| B5-SMS-03 | SMS ingestion | trimmed provider ID replay bypasses lookup and report creation | Idempotency | Whitespace provider ID then normalized replay | Duplicate; one lookup and creation | Assertions passed in full guarded suite | Pass |
| B5-SMS-04 | SMS ingestion | cache retains oldest entry at exact 5000-entry capacity | Boundary | 5000 unique IDs then oldest replay | Oldest retained; no extra creation | Assertions passed in full guarded suite | Pass |
| B5-SMS-05 | SMS ingestion | inserting entry 5001 evicts oldest while retaining newest | Regression/boundary | 5001 unique IDs; newest then oldest replay | Newest retained; oldest evicted and processed anew | Failed before fix; passed in affected and full suites | Pass |
| B5-EXPORT-01 | Conservation exports | HTML escapes generated-by name and area filter | Regression/security | Generated name IMG and area SCRIPT markup | Escaped text; no raw executable tags | Failed before fix; passed in affected and full suites | Pass |
| B5-EXPORT-02 | Conservation exports | HTML escapes incident reporter and patrol ranger names | Regression/security | Incident reporter IMG and ranger SVG markup | Escaped names; no raw tags | Failed before fix; passed in affected and full suites | Pass |
| B5-EXPORT-03 | Conservation exports | CSV safely quotes names and filter values containing commas quotes and newlines | Regression/CSV | Name/filter commas quotes and newline | One correctly quoted cell; doubled quotes | Failed before fix; passed in affected and full suites | Pass |
| B5-EXPORT-04 | Conservation exports | anonymous community exports never include identity properties | Privacy | Anonymous community fixture includes contact/owner properties | CSV/HTML omit all private fixture markers | Assertions passed in full guarded suite | Pass |
| B5-EXPORT-05 | Conservation exports | CSV keeps quoted species and multiline locations intact | Positive/CSV | Quoted species and multiline location | Quoted intact fields; escaped internal quotes | Assertions passed in full guarded suite | Pass |
| B5-EXPORT-06 | Conservation exports | HTML limits detail rows to 50 while CSV contains all 51 records | Boundary | 51 populated records | HTML50 with limit notice; CSV includes51st | Assertions passed in full guarded suite | Pass |
| B5-EXPORT-07 | Conservation exports | escaping handles null numeric quotes and ampersands | Boundary/escaping | Null undefined numeric0 and HTML special characters | Empty missing values; preserve0; correct escaping | Assertions passed in full guarded suite | Pass |
| B5-RVAL-01 | Report request validator | equal absolute date boundaries accepted | Date boundary | Equivalent offset from/to timestamps | Equal valid Dates | Assertions passed in full guarded suite | Pass |
| B5-RVAL-02 | Report request validator | reversed dates rejected | Negative | Reversed from/to | Reject | Assertions passed in full guarded suite | Pass |
| B5-RVAL-03 | Report request validator | malformed dates rejected | Negative | Invalid from string | Reject | Assertions passed in full guarded suite | Pass |
| B5-RVAL-04 | Report request validator | query normalizes area and filters with default month period | Positive | Trimmed area and lower-case type/status/priority | Normalized values; default month | Assertions passed in full guarded suite | Pass |
| B5-RVAL-05 | Report request validator | unsupported report type and export format rejected | Negative | Unknown report type and XML export | Reject unsupported values | Assertions passed in full guarded suite | Pass |
| B5-RVAL-06 | Report request validator | accepted report and format normalize case | Positive | incident/csv and absent export | INCIDENT/CSV and default JSON | Assertions passed in full guarded suite | Pass |
| B5-ERROR-01 | Centralized error middleware | generic server error hides SQL request payload and stack | Security/error | Untyped503 with fake SQL/payload details | 500 fixed safe envelope; no private details | Assertions passed in full guarded suite | Pass |
| B5-ERROR-02 | Centralized error middleware | malformed JSON error exposes only generic client message | Security/error | SyntaxError400 with private body | 400 Invalid request body | Assertions passed in full guarded suite | Pass |
| B5-ERROR-03 | Centralized error middleware | oversized body exposes safe 413 response | Security/error | 413 with private body | 413 Request body too large | Assertions passed in full guarded suite | Pass |
| B5-ERROR-04 | Centralized error middleware | headers already sent delegate error and preserve evidence trace | Lifecycle | Headers sent and evidence trace | Delegate original error; trace records; no response mutation | Assertions passed in full guarded suite | Pass |
| B5-ERROR-05 | Centralized error middleware | evidence failure uses no-store and whitelists safe fields | Security/error | Typed evidence503 with provider details | no-store; only success/code/message | Assertions passed in full guarded suite | Pass |
| B5-ERROR-06 | Centralized error middleware | navigation retry metadata preserves HTTP and body contracts | Contract | Typed navigation429 with retry7 and zero routing point | HTTP Retry-After7; matching whitelisted body | Assertions passed in full guarded suite | Pass |
| B5-ERROR-07 | Centralized error middleware | unsupported approval metadata never reaches client | Privacy | Auth403 with unsupported approvalStatus | Exclude unsupported approval metadata | Assertions passed in full guarded suite | Pass |
| B5-ERROR-08 | Centralized error middleware | registration conflict retains field diagnostics without arbitrary details | Contract/security | Registration409 with email diagnostic and query details | Retain email field error; exclude private query | Assertions passed in full guarded suite | Pass |
| B5-ANALYTICS-01 | Analytics repository failures | incident query failure propagates without invented totals | Error | Incident repository rejects | Same error; no invented totals | Assertions passed in full guarded suite | Pass |
| B5-ANALYTICS-02 | Analytics repository failures | patrol query failure propagates without invented totals | Error | Patrol repository rejects | Same error; no invented totals | Assertions passed in full guarded suite | Pass |
| B5-ANALYTICS-03 | Analytics repository failures | community query failure propagates without invented totals | Error | Community repository rejects | Same error; no invented totals | Assertions passed in full guarded suite | Pass |
| B5-RPT-01 | Populated report generation | incident report displays zero coordinates and matching summary | Regression/boundary | One incident at coordinates0,0 | Location0,0; summary total equals one detail row | Failed before fix; passed in affected and full suites | Pass |
| B5-RPT-02 | Populated report generation | community report displays zero coordinates and matching summary | Regression/boundary | One community report at coordinates0,0 | Location0,0; summary total equals one detail row | Failed before fix; passed in affected and full suites | Pass |
