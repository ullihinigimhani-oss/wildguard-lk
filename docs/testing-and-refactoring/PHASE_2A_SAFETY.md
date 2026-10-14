# Phase 2A: safe testing environment

Verified on 13 October 2026 on `quality/testing-refactoring`.
Production business logic and production environment files were not changed.
No database migrations, seeds, resets, commits, pushes, merges, or branch switches were performed.

## Database isolation

Backend Jest uses a custom resolver. Imports of the application database module resolve to a test-only module that throws `TEST_DATABASE_BLOCKED`. A test must supply its own explicit mock factory to use that module. `jest.requireActual` still gets the blocking module, even when a mock exists.

The environment module resolves to an inert test module; it does not load dotenv or read an environment file. Direct dotenv imports are blocked separately. PostgreSQL drivers and adapters are blocked. Prisma entry points expose generated metadata for the existing schema tests, but their constructors throw. The Prisma runtime factory also returns a blocking constructor. This is independent of `NODE_ENV` and the value assigned to `DATABASE_URL`.

Before application imports, backend setup replaces inherited database configuration with a dummy URL on port 1 and removes inherited provider credentials using their variable names only. No secret values are read or displayed. Credentials supplied explicitly by existing tests are mock-only values.

The report API and service suites use an in-memory fixture. Its `create`, `delete`, and `deleteMany` functions operate only on arrays; they never import Prisma or pg. Fixed timestamps and deterministic IDs replace live database fixtures. Existing assertions and scenarios remain. The API fixture supplies active, approved users and a sufficiently long test JWT secret, as required by the real authentication implementation.

## Network isolation

The shared test-only guard blocks fetch, XHR send, WebSocket/EventSource where available, HTTP/HTTPS requests, raw TCP/TLS connections, UDP creation, and DNS lookup/resolve/reverse operations. Jest Expo has no default XHR, so its setup supplies an explicit deny-only XHR stub. Explicit test mocks remain usable.

Backend unit tests and all frontend tests have no local-service exception. Backend API suites may use only numeric loopback addresses and ports opened by a server in their own test process. Arbitrary localhost services, including database and development-server ports, remain blocked. This preserves Supertest's HTTP transport without allowing calls to the running application.

Web Vite disables environment-file loading in test mode only. The separate sensor test configuration also disables it. Development/build configuration keeps its existing behavior.

These are guards for accidental calls in the configured test runners, not an operating-system sandbox for deliberately hostile code. Do not disable the resolver/setup files, run tests through an alternative unguarded configuration, or treat standalone scripts as isolated tests.

## Execution and results

Commands below are run from the indicated application folder. No coverage run was requested in Phase 2A.

| Run | Suites/files | Passed tests | Failed tests |
| --- | --- | --- | --- |
| Backend final full Jest suite | 42 | 799 | 11 |
| Backend targeted report + isolation verification | 4 | 53 | 0 |
| Web full Vitest suite | 27 | 206 | 27 |
| Mobile full Jest suite | 47 | 529 | 0 |
| Sensor dashboard isolation suite | 1 | 3 | 0 |

The targeted backend run overlaps the full suite; do not add the two counts together. There are 32 new isolation cases: backend 21, web 4, mobile 4, sensor 3. The final web/mobile/sensor isolation suites were also rerun after the shared guard's DNS coverage was expanded.

```powershell
# backend
node node_modules/jest/bin/jest.js --runInBand
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/unit/testIsolation.test.js tests/integration/testIsolation.api.test.js tests/report.api.test.js tests/report.service.test.js
# web
node node_modules/vitest/vitest.mjs run
node node_modules/vitest/vitest.mjs run tests/foundation/testIsolation.test.jsx
# mobile
node node_modules/jest/bin/jest.js --runInBand
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/foundation/testIsolation.test.js
# sensor-dashboard (uses the existing installed web test toolchain)
npm test
```

Existing `npm test` commands for backend, web, and mobile use the same guarded configurations. Sensor testing currently requires the web dependencies to be installed; no new packages or lockfile changes were introduced. Its three cases validate isolation, not complete sensor functionality. Shared business logic is exercised by the existing backend/mobile suites and inherits their guards; no standalone shared runner was added.

Machine-readable evidence is saved locally in the ignored root `.cache` directory:

- `backend-phase2a.json` and `backend-phase2a.log`: final full backend run.
- `backend-targeted-phase2a.json`: report and guard verification.
- `web-phase2a.json`: full web run.
- `mobile-phase2a.json`: full mobile run.
- `sensor-phase2a.json`: sensor guard run.

### Remaining failures and warnings

- Backend: `tests/integration/incident.api.test.js` (10 failures) and `tests/unit/incident/incident.validator.test.js` (1 failure). Authorization/status/mass-assignment assertions remain unchanged for Phase 2B.
- Web: `tests/foundation/app.test.jsx` (23 failures), `tests/foundation/managerIncidentApi.test.jsx` (2), `tests/integration/communityReportManagement.test.jsx` (1), `tests/integration/patrolEditCancel.test.jsx` (1). Observed failures include missing ZoneAlertProvider in the test render, request-argument mismatches, a verification action not called, and missing walking-route confirmation. These require investigation in Phase 2B; none was weakened here.
- Mobile: existing React `act()` and console warnings remain. They were not suppressed.
- No guard failure appeared in the completed full-run assertion failures. No discovered automated suite still requires a real database.
- Existing discovery rules and empty scaffolding were retained. This phase does not claim all implemented functionality is tested.

### Standalone scripts remain unsafe

`backend/scripts/testReports.js` imports the real environment/database and reads live records. `backend/scripts/testRiskZones.js` imports the real database and supports creating/removing records. They are outside Jest discovery and were not executed or changed. Seeds and database maintenance commands are also outside this test isolation layer. Do not include any of them in a safe automated test command.

## Windows EPERM

The failure occurs in `fs.realpathSync.native` inside the managed execution sandbox, before Jest evaluates project configuration. Changing TEMP/TMP did not fix it. A read-only probe and all test commands succeeded outside that sandbox using the ordinary user account. No administrator privileges, global installations, cache deletion, or unrelated file deletion were needed.

Tests are now executable in the verified context. The sandbox's filesystem limitation itself remains; this is an execution-context workaround, not a Jest source patch. In a normal user PowerShell session, use the commands above. Do not grant administrator rights to solve this error.

## Every changed or added repository file

1. `backend/jest.config.js`
2. `backend/tests/report.api.test.js`
3. `backend/tests/report.service.test.js`
4. `backend/tests/fixtures/reportDatabase.cjs`
5. `backend/tests/integration/testIsolation.api.test.js`
6. `backend/tests/unit/testIsolation.test.js`
7. `backend/tests/isolation/database-blocked.cjs`
8. `backend/tests/isolation/dotenv-blocked.cjs`
9. `backend/tests/isolation/driver-blocked.cjs`
10. `backend/tests/isolation/environment.cjs`
11. `backend/tests/isolation/prisma.cjs`
12. `backend/tests/isolation/prisma-runtime.cjs`
13. `backend/tests/isolation/resolver.cjs`
14. `backend/tests/isolation/setup.cjs`
15. `mobile/jest.config.js`
16. `mobile/tests/isolation.cjs`
17. `mobile/tests/foundation/testIsolation.test.js`
18. `web/vite.config.js`
19. `web/tests/setup.js`
20. `web/tests/foundation/testIsolation.test.jsx`
21. `sensor-dashboard/package.json`
22. `sensor-dashboard/vitest.config.mjs`
23. `sensor-dashboard/tests/setup.cjs`
24. `sensor-dashboard/tests/testIsolation.test.js`
25. `test-support/network-isolation.cjs`
26. `docs/testing-and-refactoring/PHASE_2A_SAFETY.md`

Stop at Phase 2A. Production fixes and SOLID refactoring require the user's next approval.
