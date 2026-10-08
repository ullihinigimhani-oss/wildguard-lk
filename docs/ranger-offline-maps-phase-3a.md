# Simplified offline patrol navigation

Current decision: coordinate-only offline patrol view. No basemap downloads or paid provider are required. Verification date: 2026-10-09.

## Behavior

Online retains the existing Leaflet/OpenStreetMap map and blue live GPS-to-START, green verified planned route, orange trail, RiskZones and current GPS. Existing online ORS validation, cooldown, backoff and hazard avoidance remain unchanged.

Offline automatically switches to the existing self-contained canvas/WebView, labelled Offline Patrol View — No Basemap. It uses a clean cream/sage background with a subtle grid anchored to projected coordinates. There are no remote scripts, styles, tiles, provider requirements or file-package reads in this view. Fit Route, Re-centre, pan and zoom controls remain.

The view renders the matching verified green LineString stored in SQLite, waypoints (including START/CHECKPOINT/END), the actual device GPS marker, recorded orange trail and cached risk polygons. Green is labelled cached; missing or stale geometry shows a clear unavailable message. No straight waypoint connections are fabricated as walking routes. Blue is always hidden offline; old live ETA/direction-loading indicators are hidden too. Cached hazards explicitly warn they may have changed and cannot establish current safety. HIGH/CRITICAL labels and overlays remain visible when available. Missing/invalid snapshots fail closed with a prominent warning.

Reconnection automatically restores the existing online map and normal routing through the same hooks. Offline ORS/history API calls are suppressed. The live hook retains the same session's visible orange trail while reinitializing connectivity-dependent route state and merges persistent local/server history. Account/patrol changes do not reuse another session's trail. The existing single GPS watcher hook and frequency are unchanged; no watcher was added. Existing four tabs, incident drafts, persistent evidence and synchronization are untouched.

The Ranger screen no longer imports or mounts OfflineMapControls. Its local snapshot hook now reads only navigation_cache and never reads map packages. The canvas no longer accepts or renders raster bundles. The earlier dormant package-manager/provider modules remain unused by Ranger navigation; no package or field-data records/files were removed, reset or downloaded.

## Files changed in this simplification

- mobile/src/screens/patrol/LivePatrolNavigationScreen.js
- mobile/src/hooks/useLiveNavigation.js
- mobile/src/hooks/useOfflinePatrolMap.js
- mobile/src/components/patrol/OfflinePatrolMap.js
- mobile/src/components/patrol/offlineMapDocument.js
- mobile/tests/foundation/liveNavigationScreen.test.js
- mobile/tests/foundation/offlineMaps.test.js
- docs/ranger-offline-maps-phase-3a.md

No dependencies installed. No backend, Prisma, Neon, migration, environment, Cloudinary or Park Manager changes. No commit/push. No offline GPS/incident/evidence deletion.

## Verification

Final verification: all 482 mobile tests passed in 44 suites. Android Hermes export and Expo Web export passed. git diff --check passed. Targeted navigation/offline tests: 27 passed in two suites. They cover online/offline/reconnect screen selection, cached/missing/stale green geometry, GPS/orange, hazard warnings, blue suppression, absence of download/provider UI and unchanged GPS activation. Real-hook tests verify no offline ORS call and one live request after reconnect, with rerenders causing no duplicate. Existing location-watcher and routing regressions remain in the full suite. Executed canvas tests check green/orange/red drawing, actual GPS marker and Fit Route/Re-centre; package tests retained for dormant code use isolated mocks only. Physical native rendering and connectivity behavior are still unverified.

## Physical iPhone checks

1. Reload the app and log in online. Open active patrol navigation; let verified green and authorized hazards load/cache. Verify blue/green/orange, GPS and existing Leaflet controls.
2. Enable airplane mode while keeping navigation foregrounded. Confirm Offline Patrol View — No Basemap, subtle grid, cached green/waypoints/red hazards, cached-hazard warning, no blue directions and no download/provider messages. Walk and verify actual GPS marker and orange trail; use Fit Route and Re-centre.
3. Restore internet without leaving the screen. Confirm automatic Leaflet restoration and blue/green routing, retained orange samples and field-data sync. Repeat the switch and check logs for request multiplication rather than one new live route per reconnect. Check existing GPS watcher cleanup tests and device location behavior; no extra watcher should appear.
4. Using isolated fixtures only, test missing or changed route/hazard snapshots: clear unavailable/warning state and no fabricated line. Confirm another Ranger cannot access the first account's snapshots/trail.
5. Verify offline incident drafts/evidence still submit/retry against the same IDs and four tabs remain. Existing session expiry and online login after cold restart requirements are unchanged.
