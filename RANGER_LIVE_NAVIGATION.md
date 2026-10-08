# Ranger live patrol navigation

This is the historical first live-navigation phase report. The subsequent known-risk-area avoidance implementation is documented in `RANGER_RISK_AVOIDANCE.md`.

Implemented on `feature/ranger-patrol-incident-management`. Start Patrol uses the existing lifecycle API and opens the nested Patrol Navigation screen after an `IN_PROGRESS` response. Active patrols offer Open Navigation. View Route remains a read-only planned route, and the four Ranger bottom tabs remain unchanged.

## Required implementation and verification report

1. **Files changed:** see the complete manifest below. The main additions are `LivePatrolNavigationScreen`, `useForegroundLocation`, `useLiveNavigation`, the navigation/GPS APIs, and the server-only ORS service.
2. **Location library:** `expo-location ~57.0.20`, installed 57.0.20, matching the installed Expo SDK's bundled version.
3. **Permissions:** the Expo location plugin configures an iOS When In Use explanation and Android coarse/fine location. Introspection confirmed no iOS Always permission strings, no background location mode, and no Android background-location or foreground-service permissions. Motion permission strings are disabled.
4. **Watcher:** `watchPositionAsync`, high accuracy, a 5-second minimum interval and 10-metre distance interval. It starts only for a focused, owned, active patrol with a valid saved route. Permission/services failures have friendly retry states. Old/invalid fixes and accuracy worse than 100 metres are rejected. A 30-second stale-fix timeout removes the displayed current position. Subscriptions are removed on blur, background, unmount and completion; asynchronously resolved subscriptions are also removed after cancellation.
5. **Backend routing:** authenticated `POST /api/navigation/route`; destination coordinates are loaded from the patrol's saved waypoint. Node's existing built-in HTTP `fetch` is used; no new backend HTTP dependency or permanent verification endpoint was added.
6. **ORS profile:** `foot-walking` at `https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson`. Live server-only connectivity verification succeeded with **HTTP 200**, geometry, distance and duration returned. Temporary Heidelberg coordinates were used without database access.
7. **Destinations:** saved START, CHECKPOINT, OBSERVATION and END points in persisted order, addressed by saved waypoint ID. An incomplete/invalid saved route disables GPS navigation instead of inventing missing points. GPS away from START targets START; GPS already near START advances.
8. **HIGH_RISK:** skipped as a destination; retained as a red warning marker with label and notes. No polygon avoidance or safety guarantee is implemented.
9. **Geometry:** sanitized GeoJSON `LineString`, `[longitude, latitude]` coordinates. The Leaflet bridge converts them to its latitude/longitude order. Raw ORS metadata is omitted.
10. **Distance/duration:** initial authoritative ORS distance and duration; remaining estimates scale those summaries by progress projected onto the ORS geometry. They describe the next destination, not the entire patrol. No planned straight-line distance substitutes for live routing. Errors remove the live geometry/summary and preserve planned markers.
11. **Off route:** distance from the ORS geometry exceeds 70 metres plus reported GPS accuracy on three consecutive distinct fixes. Normal jitter does not reroute. The screen displays Off Planned Navigation Route.
12. **Quota controls:** client minimum 20-second cooldown, one concurrent route request and meaningful movement of at least 100 metres after 90 seconds for optional refresh. Destination changes respect cooldown. Failures wait for an explicit retry; server retry delays are honored. Server coalesces nearby duplicate requests, caches for 45 seconds within 20 metres of the previous origin, enforces a 10-second cooldown, six provider requests per Ranger per minute, and 30 per process per minute. Provider calls time out after 15 seconds. Server budgets/cache are process-local; multi-instance production deployment would need shared rate-limit storage.
13. **Arrival:** centralized 40-metre threshold, with GPS accuracy at most 30 metres for waypoint arrival.
14. **Progression:** reached IDs advance automatically, including observation points. Progress is memory-only and scoped to Ranger ID, patrol ID and actual start time; it survives blur/resume within the signed-in app session, and clears on logout or explicit completion. App restart resets progress. Persistent checkpoint completion needs a future schema/API design. END arrival offers Complete Patrol and waits for explicit confirmation through the existing completion API.
15. **GPS recording:** implemented using existing `PatrolLocation`. Owner-only GET/POST `/api/patrols/mine/:patrolId/locations`. Writes require `IN_PROGRESS`, a recent valid timestamp and usable coordinates/accuracy. At least 10 seconds between accepted samples, plus 30 metres of movement or 60 seconds elapsed. Timestamp-derived IDs reject duplicates. A transaction locks the owned patrol row so completion cannot race a GPS write. Pre-start samples, stale/future samples and post-completion writes are rejected. The map retrieves the latest 1,000 chronological samples.
16. **Separate concepts:** persisted planned markers; temporary blue ORS geometry; separate orange recorded GPS trail; distinct blue current-location circle and accuracy halo. Live navigation omits the straight planned polyline. GPS/map bridge updates do not reload the map HTML. Fit Route and Re-centre permit inspection and return to current GPS; the map stays north-up.
17. **Authorization:** existing authentication reloads active/approved account state and enforces Ranger role. Patrol ownership is checked before route/trail access, and waypoint ownership/type is checked before ORS. Ranger B cannot route or record GPS for Ranger A. The original start/complete protections remain intact.
18. **Secret protection:** only backend environment loading supplies the ORS Authorization header. No key is included in mobile/WebView requests or routing responses, and upstream error bodies/headers are not returned or logged. Private exact-value scanning of **220 client source/export files found zero matches**. `backend/.env` and `mobile/.env` remain Git-ignored; backend `.env` is not tracked.
19. **Database/schema:** no migration, schema change, environment change, reset, seed, deletion or verification-time database write. Existing data was not modified. GPS writes occur only when the authorized Ranger uses active live navigation.
20. **Backend tests:** **312 passed, 15 suites**. Covers auth/ownership, destination validation, lifecycle status, GPS validation/throttling/idempotency, sanitized ORS output/errors, cache and concurrent-request coalescing. Existing lifecycle/schedule and manager route-planning tests pass.
21. **Mobile tests:** **159 passed, 20 suites**. Covers start-to-navigation/resume, foreground permissions, service failure, subscription cleanup/background/resume/late resolution, START behavior, risk skipping, observation/END progression, actual hook rerouting/cooldown, jitter, unavailable route fallback, aborted stale responses, sample recording and explicit completion. Existing planned route and derived status tests pass.
22. **Web tests:** **92 passed, 12 files**, run with one worker to avoid CPU contention with Expo exports. The stale Field Map test now asserts the existing Field Map headings instead of Coming Soon. Manager Create Patrol and route planner tests pass; existing Leaflet/react-leaflet dependencies are preserved. Vite production build passes with its existing large-chunk advisory.
23. **Builds:** Android Hermes export passes (947 modules), Expo web export passes (624 modules), and the manager web build passes. Android export required standard permission to execute the installed Hermes compiler outside the sandbox. Expo compatibility check accepts the location dependency but recommends updating the existing Expo 57.0.25 package to ~57.0.27; that unrelated core patch update was not applied.
24. **Physical-device verification:** real Android/iOS permission prompts, precise/approximate permission behavior, forest GPS accuracy, stationary fix delivery, power usage, real walking/off-route transitions, native WebView gestures and tiles, and connectivity loss/recovery still need a device. Browser verification using temporary coordinates confirmed live geometry/current marker/trail transport, Re-centre and the red warning popup without JavaScript console errors. **OpenStreetMap returned blocked-tile images in the test browser**, so basemap availability is not verified and needs checking on the device/network. The temporary verification script/server were removed/stopped; no device GPS was simulated in production code.

## Changed-file manifest

Paths below are relative to `C:\Users\Lihini\Desktop\WildGuard LK\wildguard-lk`.

```text
backend/src/app.js
backend/src/controllers/navigation.controller.js
backend/src/middleware/error.middleware.js
backend/src/repositories/patrol.repository.js
backend/src/routes/navigation.routes.js
backend/src/routes/patrol.routes.js
backend/src/services/navigation.service.js
backend/src/services/ors.service.js
backend/tests/integration/navigation.api.test.js
backend/tests/integration/patrolLifecycle.api.test.js
backend/tests/unit/patrol/ors.test.js
shared/patrolNavigation.js
mobile/app.json
mobile/jest.config.js
mobile/metro.config.js
mobile/package.json
mobile/package-lock.json
mobile/src/components/patrol/PatrolMapSurface.js
mobile/src/components/patrol/PatrolMapSurface.web.js
mobile/src/components/patrol/PatrolRouteMap.js
mobile/src/components/patrol/plannedMapDocument.js
mobile/src/hooks/useAuth.js
mobile/src/hooks/useForegroundLocation.js
mobile/src/hooks/useLiveNavigation.js
mobile/src/navigation/AppNavigator.js
mobile/src/navigation/linking.js
mobile/src/screens/patrol/LivePatrolNavigationScreen.js
mobile/src/screens/patrol/PatrolDetailsScreen.js
mobile/src/services/patrolApi.js
mobile/src/utils/liveNavigation.js
mobile/src/utils/navigationSession.js
mobile/src/utils/plannedPatrolRoute.js
mobile/tests/foundation/foregroundLocation.test.js
mobile/tests/foundation/linking.test.js
mobile/tests/foundation/liveNavigation.test.js
mobile/tests/foundation/liveNavigationHook.test.js
mobile/tests/foundation/liveNavigationScreen.test.js
mobile/tests/foundation/patrolDetails.test.js
web/tests/foundation/landing.test.jsx
RANGER_LIVE_NAVIGATION.md
```

Exported bundles, config introspection output and the map-check screenshot are under ignored `mobile/.expo/`. No `.env` is part of this change.

## Device smoke check

Start the backend and Expo app using the existing scripts. Sign in as the assigned approved Ranger, inspect View Route, then start an eligible patrol. Accept foreground location permission on the Navigation screen. Verify the blue current marker, walking geometry and estimates; walk toward the saved destinations; confirm that a red High Risk marker is never a target. Leave the screen/background the app and verify tracking stops, then resume. At END, confirm Complete Patrol explicitly. Check denied permissions, disabled services and loss of network. No background location permission should be requested.
