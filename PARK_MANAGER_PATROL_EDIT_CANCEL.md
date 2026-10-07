# Park Manager patrol editing and cancellation

## Implemented behavior

Scheduled patrol rows offer View, Edit and Cancel Patrol. In-progress rows retain View and the existing red Live Tracking action, with editing and cancellation disabled. Completed and cancelled rows retain View with disabled editing and cancellation. Existing filters, pagination and 15-second serial polling are preserved.

Edit opens /patrols/:id/edit inside the existing authenticated Park Manager routes. The existing Create Patrol form and Leaflet planner are reused. Title, park, assigned Ranger, date, Sri Lanka start/end times, type, priority, instructions and saved planned points are prepopulated. Starting-point label and coordinates are represented by the saved START point in the existing planner. Each saved point gets a stable local UI identifier for selection and editing; these identifiers are not sent as database keys. Save Changes updates the same Patrol ID without calling the creation API. Validation and conflict errors retain the edited values.

## APIs and atomic updates

PATCH /api/patrols/:id accepts the existing create-form payload and reuses its date/time, type, priority, coordinates and route validation. Exactly one START first and END last, valid point types, consecutive order and required coordinates are enforced. Only authenticated approved active Park Managers can mutate patrols through the existing authentication and role middleware.

The assigned Ranger must be approved and active. Rangers with a park assignment must match the selected park; the existing unassigned Ranger pool remains eligible. No User or park assignments are modified.

Patrol details and waypoints commit together in a Prisma interactive transaction. A guarded update of status SCHEDULED locks the patrol row until route changes finish. Existing planned waypoint rows are reused by order; only planned rows at removed orders are deleted, scoped to that patrol and explicit IDs. Unclassified historical waypoints are retained. GPS locations and incidents are never written by this workflow. A failed waypoint operation rolls back the patrol update.

Only scheduled patrols may be edited or cancelled. A changed status returns HTTP 409. Ranger Start Patrol compares the previously read updatedAt as well as ownership and status, preventing a stale schedule from starting after a manager edit. Concurrent start/edit/cancel interleavings are covered by isolated tests.

## Cancellation and history

POST /api/patrols/:id/cancel sets the existing CANCELLED status. CANCELLED already exists in prisma/schema.prisma; no schema change or migration is required. No destructive DELETE endpoint was added. The patrol record, route, history, GPS trail and incidents are retained; the existing updatedAt timestamp records the mutation.

The UI asks “Cancel this patrol?” and explains: “This patrol will be removed from the Ranger's upcoming patrol list. This action cannot be undone from this screen.” Keep Patrol dismisses without writing; Confirm Cancellation explicitly performs the mutation. Duplicate submissions are blocked. API errors remain visible and trigger a table refresh.

## Ranger synchronization and reassignment

Manager and Ranger APIs read the same Patrol record. The Ranger list excludes CANCELLED records. Ownership checks use the current rangerId, so the old Ranger immediately loses server access and the new Ranger gains access after reassignment. Existing focus, foreground and 30-second active-app refresh reload the list; returning to My Patrol already refetches. Patrol Details and planned route screens also refetch on focus or explicit refresh. No duplicate patrol storage or push notifications were introduced.

Cancelled patrol history remains readable by its assigned Ranger through the existing detail endpoint. Start/complete return conflicts for cancelled status. Existing navigation and RiskZone/full-route services require IN_PROGRESS, so cancelled patrols cannot request navigation. No ORS, RiskZone, authentication or GPS implementation changes were needed.

## Verification

| Check | Result |
| --- | --- |
| Backend tests | 17 suites, 383 tests passed |
| Web tests | 13 files, 108 tests passed |
| Mobile tests | 25 suites, 194 tests passed |
| Manager web production build | Passed; existing bundle-size advisory above 500 kB |
| Android Hermes export | Passed, .hbc bundle produced |
| Expo Web export | Passed |
| git diff --check | Passed |

Tests cover scheduled edits, updated Ranger details/routes, reassignment ownership, route preservation/removal, rollback, active/completed restrictions, cancellation, blocked start/navigation, Ranger and unapproved/inactive Manager restrictions, invalid Ranger/park/schedule/route inputs, concurrent start/edit/cancel interleavings, Live Tracking/View preservation, confirmation, UI conflicts, mobile focus/foreground refresh and cleanup.

## Database safety and pending verification

All database tests use isolated Prisma mocks. No production or Neon mutations were executed during implementation. No reset, migration, schema/environment change, hard patrol deletion, GPS/incident mutation, or TEST RiskZone modification occurred.

Pending: physically verify editing/reassignment/cancellation between a manager browser and Ranger phone against an authorized test patrol. Real PostgreSQL concurrency was not exercised against Neon; deterministic mocked interleaving tests validate guards and transaction rollback. No required implementation remains pending.

## Changed files

- [backend/src/controllers/patrol.controller.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/backend/src/controllers/patrol.controller.js)
- [backend/src/repositories/patrol.repository.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/backend/src/repositories/patrol.repository.js)
- [backend/src/routes/patrol.routes.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/backend/src/routes/patrol.routes.js)
- [backend/src/services/patrol.service.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/backend/src/services/patrol.service.js)
- [backend/tests/integration/patrolLifecycle.api.test.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/backend/tests/integration/patrolLifecycle.api.test.js)
- [mobile/tests/foundation/patrolDetails.test.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/mobile/tests/foundation/patrolDetails.test.js)
- [web/src/pages/PatrolManagement/CreatePatrolForm.jsx](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/web/src/pages/PatrolManagement/CreatePatrolForm.jsx)
- [web/src/pages/PatrolManagement/PatrolManagement.jsx](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/web/src/pages/PatrolManagement/PatrolManagement.jsx)
- [web/src/routes/AppRoutes.jsx](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/web/src/routes/AppRoutes.jsx)
- [web/src/services/patrolApi.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/web/src/services/patrolApi.js)
- [web/vite.config.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/web/vite.config.js)
- [backend/tests/integration/patrolManagement.api.test.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/backend/tests/integration/patrolManagement.api.test.js)
- [mobile/tests/foundation/patrolManagerSync.test.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/mobile/tests/foundation/patrolManagerSync.test.js)
- [web/src/pages/PatrolManagement/EditPatrol.jsx](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/web/src/pages/PatrolManagement/EditPatrol.jsx)
- [web/tests/integration/patrolEditCancel.test.jsx](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/web/tests/integration/patrolEditCancel.test.jsx)
- [PARK_MANAGER_PATROL_EDIT_CANCEL.md](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/PARK_MANAGER_PATROL_EDIT_CANCEL.md) — this report.
