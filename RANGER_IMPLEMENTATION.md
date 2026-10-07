# Ranger dashboard implementation

Implemented authenticated Ranger Dashboard, My Patrol (Scheduled/In Progress/Completed filters), Report Incident destination, Profile and four fixed safe-area-aware navigation tabs. Existing flat route names and logout-to-Welcome behavior are preserved.

## Files changed or added

Backend:
- src/routes/patrol.routes.js
- src/controllers/patrol.controller.js
- src/services/patrol.service.js
- src/repositories/patrol.repository.js
- tests/integration/patrol.api.test.js

Mobile:
- src/navigation/AppNavigator.js
- src/navigation/RangerShell.js
- src/navigation/linking.js
- src/screens/home/HomeScreen.js
- src/screens/home/DemoHomeScreen.js (preserves separate explicit demo mode)
- src/screens/patrol/MyPatrolScreen.js
- src/screens/incident/RangerIncidentScreen.js
- src/screens/profile/ProfileScreen.js
- src/services/patrolApi.js
- src/hooks/useRangerPatrols.js
- src/utils/rangerPatrol.js
- src/components/PatrolCard.js
- src/components/PatrolLoadState.js
- tests/foundation/rangerDashboard.test.js
- tests/foundation/screens.test.js
- tests/foundation/linking.test.js

## APIs and security

Reused POST /api/auth/login and GET /api/auth/me, existing token/session verification, approval and role middleware. Existing POST /api/patrols and GET /api/patrols/rangers remain unchanged for managers.

Added GET /api/patrols/mine for Rangers. Authentication reloads active state and approval from the database; role middleware requires RANGER. The controller passes only req.user.id to the repository. Prisma filters the original Patrol records by rangerId and the three supported statuses. Client-supplied rangerId is ignored. Responses use Cache-Control: no-store and omit other users' account details. No mobile patrol copies or database/schema changes.

## Dashboard data and scope

Name, email, role, confirmed park and approval come from the authenticated session. Requested park is never substituted for confirmed park. The dashboard uses today's date in Asia/Colombo and prioritizes In Progress, then Scheduled, then Completed; within each status it selects the earliest start. Missing assignments have a clean empty state. Failed requests show retry rather than pretending no assignments exist. Patrol data reloads on focus and has cancellation protection; My Patrol includes manual refresh.

Authenticated Ranger dashboard removes simulated sync messages, backend diagnostics, demo actions and development content. Explicit demo mode remains isolated in its own screen and makes no patrol API requests.

Start Patrol / Continue Patrol / View Patrol open My Patrol with the matching status and selected record first. They do not change patrol status. GPS tracking, patrol execution, incident forms/evidence/submission and Profile settings are intentionally deferred. Report Incident has only its screen structure and an honest disabled-release message.

## Verification

Backend: 10 suites, 184 tests passed, including manager creation and token-scoped Ranger A/B isolation, malicious query rangerId, unauthenticated access and pending-account rejection.
Mobile: 13 suites, 82 tests, covering dashboard details and empty state, all status filters, Sri Lanka date boundary selection, four navigation destinations, profile, session/logout, approval/login and existing onboarding behavior.
Expo iOS and Android JavaScript exports passed using --no-bytecode. Hermes bytecode export could not execute local hermesc.exe (permission denied). App configuration was not changed. Device/simulator UI and real database/live account end-to-end checks were not performed.

Park Manager web UI, patrol creation logic, database records, database URL and approval rules were not modified.
