# Park Manager — Live Ranger Location Monitoring

Phase 5 completion report.

## 1. Feature implemented
A Park Manager dashboard that shows the latest known GPS position of every Ranger
currently conducting an `IN_PROGRESS` patrol, on the existing map library, with
automatic periodic refresh, location-availability (freshness) handling, list ↔ map
selection, and an optional recorded-route view.

## 2. Backend endpoints (added, manager-only)
| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/patrols/live` | `authenticate` + `allowRoles("PARK_MANAGER")` | Active patrols + latest GPS fix per Ranger + `freshnessSeconds` |
| `GET` | `/api/patrols/:id/locations` | `authenticate` + `allowRoles("PARK_MANAGER")` | Recorded GPS trail for one patrol (optional route view) |

`/live` is registered before `/:id` so it is not captured as a patrol id.
Both set `Cache-Control: no-store`.

Response shape of `/live`:
```json
{
  "success": true,
  "freshnessSeconds": 120,
  "rangers": [{
    "id": "<patrolId>", "routeName": "...", "status": "IN_PROGRESS",
    "patrolType": "...", "priority": "...", "startLocation": "...",
    "actualStartTime": "...", "park": { "id", "name" },
    "ranger": { "id", "name", "email" },
    "location": { "latitude", "longitude", "recordedAt" } | null
  }]
}
```

## 3. Data sources (nothing rebuilt)
- Reuses the existing mobile GPS ingest → `PatrolLocation` history (no new table,
  no schema change) and the existing `IN_PROGRESS` patrol lifecycle.
- Reuses route → controller → service → repository layering and response/error
  conventions.
- Reuses existing Leaflet + react-leaflet map stack (same library as `FieldMap`).
- No duplicate GPS API was created; manager reads only.

## 4. Files added / changed
Added:
- `backend/tests/integration/liveRanger.api.test.js`
- `web/src/components/patrol/LiveRangerMap.jsx`
- `web/src/components/patrol/RangerTrackMap.jsx`
- `web/src/pages/RangerMonitoring/RangerTrack.jsx`
- `web/tests/integration/liveMonitoring.test.jsx`
- `web/tests/integration/rangerTracking.test.jsx`

Changed:
- `backend/src/repositories/patrol.repository.js` — `findLivePatrols`, `findLatestLocation`, `findPatrolTrail`
- `backend/src/services/patrol.service.js` — `getLiveRangers`, `getPatrolTrail`, `liveFreshnessSeconds`
- `backend/src/controllers/patrol.controller.js` — `live`, `trail`
- `backend/src/routes/patrol.routes.js` — the two routes (manager block)
- `web/src/pages/RangerMonitoring/RangerMonitoring.jsx` — page (was an empty scaffold)
- `web/src/services/patrolApi.js` — `listLiveRangers`, `getPatrolTrail`
- `web/src/routes/AppRoutes.jsx` — `/patrols/live` inside the PARK_MANAGER gate + placeholder exclusion
- `web/src/constants/navigation.js` — no sidebar entry is added for live monitoring (removed from nav); the page is reached from Patrol Management
- `web/src/pages/PatrolManagement/PatrolManagement.jsx` — manager-only link to the page; per-row "Live Tracking" link on in-progress patrols and "Route history" link on completed patrols
- `web/src/components/patrol/LiveTrackingAction.jsx` — now a router link to `/patrols/:id/track`
- `web/src/styles.css` — appended live-monitoring and per-ranger tracking styles (append-only)
- `web/vite.config.js` — registered the new test files
- `web/tests/foundation/app.test.jsx` — added route-protection cases
- `web/tests/integration/patrolList.test.jsx`, `web/tests/integration/patrolEditCancel.test.jsx` — updated placeholder assertions to the new per-ranger link

## 5. Update method and frequency
REST polling every **7 seconds** (spec range 5–10 s) using a `setTimeout` chain
with an in-flight guard, matching the existing Patrol Management polling pattern.
There is no WebSocket/SSE layer in the project, so polling was used and is not
described as continuous real-time. The timer is cleared on unmount; no overlapping
requests; the last successful data is kept during a transient poll failure.

## 6. Location availability / freshness
Client computes per Ranger from the server-supplied `freshnessSeconds` (120):
- **Available** – a fix exists within 120 s
- **Stale** – a fix exists but is older than 120 s
- **Unavailable** – no GPS fix recorded for the active patrol

120 s is derived from the existing `NAVIGATION.sampleMaxAgeMs` (samples older than
this are rejected at ingest) and allows one missed update, since a stationary Ranger
reports roughly every 60 s (`trailIntervalMs`). A single delayed update never marks a
Ranger offline immediately. Completed patrols leave `IN_PROGRESS` and therefore drop
out of monitoring on the next poll; late GPS from them cannot reactivate monitoring
(the ingest guard rejects non-`IN_PROGRESS` samples).

## 7. Map and UI behaviour
- Leaflet map with OSM tiles (same as the existing Field Map).
- One marker per Ranger that has a GPS fix; marker click opens a popup with Ranger
  name, Ranger ID, patrol title, park/area, status, coordinates and last GPS time.
- Selecting from the list recentres the map (only when the selected Ranger changes,
  so polling does not fight panning) and highlights the marker/detail card; marker
  clicks select the matching list row.
- List and map share one data source (the polled payload).
- Header stats: active patrols, recent GPS updates, stale/unavailable.
- Filters: free-text (name / Ranger ID / patrol / park) and GPS status.
- Optional recorded-route polyline from real stored coordinates (toggleable).
- Honest copy: "refresh every 7 seconds" and explicit last-update timestamps.
- Loading, error + Retry, background-poll warning, empty and no-match states.

## 8. Security
- Both endpoints require a valid session and `PARK_MANAGER`; ownership/role is
  enforced server-side, not only in the frontend.
- Route is inside the PARK_MANAGER `ProtectedRoute`; non-managers are redirected.
- Repository selects exclude secrets (no `passwordHash`), field set is minimal.

## 9. Tests
Added 8 backend integration tests: 401 unauth, 403 for non-managers, active-only
listing with latest fix + freshness window, stale fix passthrough, nil location,
empty list, trail order/limits, 404 trail, and private DB errors. Added 7 web tests:
list + stats + badges + marker count, selection/detail/trail, marker-click popup,
filters, empty state, error + Retry, and polling with cleanup-on-unmount; plus the
`/patrols/live` protection cases in `app.test.jsx`.

## 10. Verification results
- Backend: `npx jest` → **18 suites / 391 tests passed**.
- Web: `npx vitest run` → **14 files / 119 tests passed**.
- Build: `npx vite build` → success.
- Schema: `npx prisma validate` → valid (no schema changes).
- Live smoke (real DB, read-only, signed manager JWT): `401` unauth, `403` ranger,
  `200` manager returning the real in-progress patrol "Lihini 2" with its latest GPS
  fix, `200` trail with 26 real points, `404` unknown patrol.

## 11. Limitations / known notes
- Position updates depend on the existing mobile reporting cadence (~60 s stationary,
  more often when moving), so between-report intervals show "Stale" as designed.
- The page reports the last known position; it is not a continuous stream.
- The table's per-row `LiveTrackingAction` now opens the dedicated per-ranger
  tracking page (`/patrols/:id/track`) instead of a placeholder.
- `navigation.js` still grants Patrol Management to RANGER/COMMUNITY_LIAISON (pre-existing
  teammate config); the live-monitoring link itself is Park-Manager-only.

## 12. Scope respected
Did not rebuild patrol creation, map-based location selection, or Ranger GPS tracking;
reused the existing `PatrolLocation` history and polled the existing data through one
new manager-facing read endpoint. No new phase started.

## 13. Per-ranger route tracking (follow-up)
Each in-progress patrol row has a "Live Tracking" link to a dedicated manager-only page
`/patrols/:id/track`; completed rows keep a "Route history" link to the same page.
The page is frontend-only and adds no backend endpoint — it reuses:
- `GET /api/patrols/:id` for the **planned route** (`plannedRoute` waypoints) and header
  metadata (ranger, park, status, type, priority);
- `GET /api/patrols/:id/locations` for the **recorded route / saved history** (polled
  every 7 s while `IN_PROGRESS`, stopped on unmount; still read once for completed patrols).

`RangerTrackMap` draws the planned route as a dashed polyline with the standard
S/E/!/O/number point markers, the recorded route as a solid polyline, and the latest
point as the current-position marker. Recording and persistence already happen in the
existing ranger GPS pipeline (`PatrolLocation`), so no new storage was introduced. The
map is fitted to the combined points once so periodic refreshes do not fight user panning.
Tests: `web/tests/integration/rangerTracking.test.jsx` (planned/recorded rendering, header,
back link, freshness, empty state, not-found + Retry, completed-as-history, polling and
unmount cleanup). Route protection covered in `app.test.jsx`.