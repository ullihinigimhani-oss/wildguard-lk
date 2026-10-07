# Ranger patrol lifecycle completion report

## 1. Files changed

Shared:
- shared/patrolLifecycle.js (new centralized date, state, delay, filter and dashboard helper)

Backend:
- backend/prisma/schema.prisma
- backend/prisma/migrations/20261007160000_patrol_actual_times/migration.sql (new)
- backend/src/routes/patrol.routes.js
- backend/src/controllers/patrol.controller.js
- backend/src/services/patrol.service.js
- backend/src/repositories/patrol.repository.js
- backend/src/validators/patrol.validator.js
- backend/src/middleware/error.middleware.js
- backend/scripts/verifyPatrolLifecycle.js (new opt-in transaction verification)
- backend/tests/integration/patrol.api.test.js
- backend/tests/integration/patrolLifecycle.api.test.js (new)
- backend/tests/unit/patrol/patrol.lifecycle.test.js (new)
- backend/tests/unit/patrol/patrol.validator.test.js
- backend/tests/unit/patrol/patrol.client.test.js

Mobile:
- mobile/metro.config.js (new; includes the shared helper in Metro's watch folders)
- mobile/src/utils/rangerPatrol.js
- mobile/src/services/patrolApi.js
- mobile/src/hooks/useRangerPatrols.js
- mobile/src/hooks/usePatrolClock.js (new)
- mobile/src/components/PatrolCard.js
- mobile/src/screens/home/HomeScreen.js
- mobile/src/screens/patrol/MyPatrolScreen.js
- mobile/src/screens/patrol/PatrolDetailsScreen.js
- mobile/src/navigation/AppNavigator.js
- mobile/src/navigation/linking.js
- mobile/tests/foundation/rangerDashboard.test.js
- mobile/tests/foundation/patrolDetails.test.js (new)
- mobile/tests/foundation/linking.test.js

Report: RANGER_PATROL_LIFECYCLE.md (this file). No web UI, authentication, approval, incident, onboarding or database URL files changed.

## 2. Existing APIs reused

POST /api/auth/login, GET /api/auth/me, GET /api/patrols/rangers, POST /api/patrols and GET /api/patrols/mine. The manager still selects an approved Ranger and creates exactly one Patrol record.

## 3. APIs modified/added

GET /api/patrols/mine now includes actual timestamps, instructions, starting point and assigned Ranger name. It returns every record belonging to the authenticated Ranger, including any existing CANCELLED records in All; cancelled records have no start/complete action.

Added:
- GET /api/patrols/mine/:patrolId: authorized detail/continue/summary read.
- POST /api/patrols/mine/:patrolId/start: SCHEDULED to IN_PROGRESS.
- POST /api/patrols/mine/:patrolId/complete: IN_PROGRESS to COMPLETED.

Mutation bodies cannot choose a Ranger, status or timestamp. The server constructs all writes. Detail/list responses are no-store. Friendly 404/409 messages are returned without private database errors.

## 4-9. Patrol classification and durations

Persisted statuses remain authoritative and unchanged. TODAY, UPCOMING, OVERDUE and COMPLETED LATE are derived labels, never database statuses.

- Today: SCHEDULED, schedule date equals today's Sri Lankan calendar date, completion deadline has not passed. A same-day patrol is Today even before its scheduled start.
- Upcoming: SCHEDULED and schedule date is later than the current Sri Lankan date. It is visible immediately on the next API fetch, with View Details; the server rejects early starts before its scheduled day.
- In Progress: persisted IN_PROGRESS. It remains active until the assigned Ranger completes it.
- Overdue: SCHEDULED or IN_PROGRESS and current instant is strictly after expected end. Scheduled overdue assignments can still start; active ones show IN PROGRESS plus OVERDUE and can continue/complete.
- Completed: persisted COMPLETED. It is excluded from actionable overdue, today and active filters and dashboard cards.
- Completed Late: COMPLETED with actualEndTime strictly greater than the recorded endTime. Equal or earlier completion is on time. It shows both COMPLETED and COMPLETED LATE badges and completion performance text.
- Delay: positive actualEndTime minus expected end, derived into minutes/hours/days. Subminute lateness says less than 1 minute. No calculated text is persisted.

Legacy records without actual completion timestamps are not falsely called on time. Legacy assignments missing endTime use the end of their scheduled Sri Lankan day as an operational overdue deadline, but completion performance is shown only when an actual completion and a recorded expected end are available. Existing missing timestamps are never invented or backfilled.

## 10. Timezone strategy

The shared helper uses the IANA zone Asia/Colombo and Intl. scheduledDate retains its existing date-only UTC-midnight convention; it is read as a calendar date without device-zone conversion. startTime/endTime and actual timestamps are absolute instants.

Patrol creation previously used server-local Date construction. New schedules now resolve submitted YYYY-MM-DD/HH:MM using Asia/Colombo, independent of server/device timezone. Existing stored schedule timestamps are untouched; no bulk timezone conversion was performed. The manager's form, payload fields and creation workflow are unchanged.

## 11. Dashboard priority

Active patrol, then Today's scheduled patrol, then actionable overdue patrol, then nearest Upcoming patrol. Headings distinguish ACTIVE PATROL, TODAY'S PATROL, OVERDUE PATROL and NEXT PATROL. A future card is never labeled today's patrol.

No-today state reads No patrol scheduled for today. Overdue notices count real assigned records and open My Patrol with Overdue selected. When today's work is complete, the dashboard provides a completed-patrol notice and route to Completed.

## 12. My Patrol filters

All, Today, Upcoming, In Progress, Overdue, Completed, in horizontally scrollable compact chips. Completed is patrol history inside My Patrol; no History tab was added. Every card opens authorized Patrol Details with the appropriate Start/Continue/View Details/View Summary label.

Lists reload on focus, on app resume, manually and every 30 seconds while foregrounded. Display classifications update every 15 seconds on focused screens and on app resume. These are polling updates, not a push/realtime guarantee.

## 13. Ranger authorization

Existing middleware verifies the token, reloads active/approval status and requires the Ranger role. Every read and conditional update includes both patrol ID and req.user.id as rangerId. Foreign and nonexistent records both return 404. Client query/body Ranger IDs are ignored. GET details is the Continue access path and enforces the same ownership rule. Mutations enforce workflow transitions and cannot restart completed/cancelled patrols.

Atomic compare-and-set updates include the expected old persisted status, preventing concurrent requests from recording multiple start/end times. Retried starts of an active patrol and completions of a completed patrol return the recorded result without rewriting it.

## 14-15. Actual timestamps

actualStartTime is set to server current time on the successful SCHEDULED to IN_PROGRESS transition. actualEndTime is set to server current time on IN_PROGRESS to COMPLETED. Original scheduledDate, startTime and endTime are never overwritten by these operations.

Details show the original schedule, park, assigned Ranger, type, priority, starting point, instructions, actual times and completion performance. No database IDs are displayed. Start is performed from reviewed details; completion requires an inline confirmation. Completed details link back to My Patrol with Completed selected.

## 16. Database/schema changes

Inspected the existing Patrol schema and migration history first. Both actual-time fields were genuinely missing. Added only nullable actualStartTime and actualEndTime DateTime fields through an additive two-column migration. Prisma validation and client generation passed. The migration was applied successfully to the configured Neon database after confirming it was the only pending migration.

No enum changes, duplicate tables/records, resets, reseeding, deletes, schedule rewrites or DATABASE_URL changes occurred. Existing rows keep null actual timestamps until a real new transition records them.

## 17-18. Tests and results

Backend: 12 suites, 215 tests passed. Shared-helper tests cover cases A-H and J-L, date boundaries, duration formatting, missing metadata and dashboard ordering. API tests cover Ranger isolation (case I), direct path/query/body manipulation, approvals, inactive/expired sessions, state transitions, future starts, schedule preservation, server timestamps, idempotency, concurrent requests and sanitized errors.

Mobile: 14 suites, 100 tests passed. Coverage includes all six filters, badges/actions, overdue navigation and real counts, future/no-today display, completed history, detail instructions, real API-driven start/complete behavior, late completion, empty states, network retries, state conflicts, inaccessible patrols, deep links and existing auth/onboarding/profile/navigation tests.

Park Manager web: 9 suites, 72 tests passed. Web source files were not modified.

Live Neon-backed verification passed using the real app routes, real approved login, creation, list/details, isolation and lifecycle mutations. It used temporary verification users/patrols inside one transaction that always rolls back. After rollback, database checks confirmed zero verification accounts and patrols persisted. Existing records were never updated or deleted.

Expo iOS, Android and web JavaScript exports passed with --no-bytecode, including the shared helper. Native Hermes compilation/device/simulator visual QA remain unverified due to the previously encountered local Hermes executable permission limitation and unavailable device sessions. git diff --check passed.

## 19. Next phase

GPS/location tracking, waypoints, field incident forms/evidence/submission, offline mutation queues, push updates, manager monitoring and other unrelated features remain unimplemented. The existing Report Incident destination and four Ranger tabs remain intact. No fabricated GPS or incident workflow was introduced.
