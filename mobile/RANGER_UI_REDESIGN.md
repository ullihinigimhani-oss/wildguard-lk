# Ranger mobile UI redesign

## Presentation changes

- Dashboard: consistent forest/sage palette, larger authenticated avatar beside the greeting, assigned park, existing wildlife imagery on the active card, current/upcoming patrol actions, completed-patrol history shortcut and up to three real completed/cancelled assignments as recent activity. Existing loading, overdue, completed-today and empty states remain. No statistics, sample assignments or new API calls.
- My Patrol: screen header, rounded status filters, softer summary cards and badges, friendly empty state and consistent action buttons. Patrol details, route summary and navigation screens inherit the same Ranger colors. Only the outer map frame changes; map engine, route colors, GPS trail, waypoints, risk polygons and map callbacks are unchanged.
- Report Incident: shared field header, category icon tiles and selection surfaces, tinted rounded inputs, consistent cards and icon buttons for camera, gallery, camera-trap import and GPS capture. The category codes, handlers, validation, form fields, draft state, upload progress, retry and private evidence components remain intact.
- Profile: existing wildlife image, authenticated avatar/name and role, account information with icon rows, actual email/park/approval values and working logout. No invented identifiers, statistics, settings or edit buttons.
- Navigation: exactly Dashboard | My Patrol | Report Incident | Profile, in the same order, with the same routes and handlers. Consistent 56px tab targets, 22px icons, selected sage surfaces, readable labels and existing top/bottom safe areas. Nested Ranger native headers use the same palette; community/authentication navigation is untouched.

The requested palette is centralized in fieldTheme.js. Secondary and danger text use darker variants for legibility on light surfaces; the supplied soft gray-green and alert red remain available as accent tokens. Plus Jakarta Sans and its existing root font loader are unchanged. No dependencies were added.

## Reusable presentation

- RangerVisualContext scopes shared Screen/Button colors and spacing to the Ranger navigator.
- ModernCard, FieldIcon, ScreenHeader and EmptyState reuse existing Text typography and installed Feather icons.
- Existing rangerStyles, dashboard styles and IncidentUI retain their interfaces and now consume the shared palette.
- Button keeps its existing press/loading/disabled behavior and accepts an optional decorative icon.

## Functionality checklist

- Authentication, session handling, approval and Ranger ownership remain in their original hooks/providers.
- Patrol fetching, filters, focus refresh, start/complete confirmation, navigation destinations and selected patrol IDs remain unchanged.
- Maps remain on the original native WebView/web implementation. No edits to map HTML, routing/GPS hooks, ORS, RiskZone calculations, permissions or session persistence.
- Incident categories, create/edit/withdraw, multiple incidents, existing IDs, form validation, GPS/manual location and draft preservation remain unchanged.
- Photo/video pickers, original/optimized photo preparation, evidence limits, Cloudinary multipart APIs, sequential uploads, retry keys, successful-item skipping and private tickets remain unchanged.
- Profile uses the authenticated account and original logout callback.
- New dashboard shortcuts call existing routes only. Recent activity is derived from the already fetched patrol array; it is not an additional activity API.

## Changed files

- src/constants/fieldTheme.js (new)
- src/constants/rangerTheme.js
- src/components/common/FieldUI.js (new)
- src/components/common/Button.js
- src/components/common/Screen.js
- src/components/PatrolCard.js
- src/components/incident/IncidentUI.js
- src/components/patrol/PlannedRouteSummary.js
- src/components/patrol/PatrolRouteMap.js
- src/navigation/AppNavigator.js
- src/navigation/RangerShell.js
- src/screens/home/HomeScreen.js
- src/screens/home/DashboardPatrolCard.js
- src/screens/home/dashboardTheme.js
- src/screens/patrol/MyPatrolScreen.js
- src/screens/patrol/PatrolDetailsScreen.js
- src/screens/patrol/PatrolRouteScreen.js
- src/screens/patrol/LivePatrolNavigationScreen.js
- src/screens/incident/ReportIncidentScreen.js
- src/screens/profile/ProfileScreen.js
- tests/foundation/rangerDashboard.test.js
- RANGER_UI_REDESIGN.md (this report)

All paths above are relative to mobile/. Import-only changes in patrol detail/navigation screens select the Ranger presentation theme; their business logic is unchanged.

## Verification

- Full mobile Jest regression: 37 suites, 369 tests passed. Covers authentication, deep links, all four tabs, filters, lifecycle, maps, navigation, GPS hooks, incident create/edit/withdraw, camera/gallery, evidence preparation/upload/retry and private access. New tests cover the real activity/history destinations and non-fabricated empty activity; header-count assertions account for the new My Patrol screen heading.
- Android Hermes export: passed, output dist/ranger-ui-android with an .hbc bundle.
- Expo Web export: passed, output dist/ranger-ui-web.
- TypeScript check: not configured for this JavaScript app; no mobile tsconfig or typecheck script.
- git diff --check: passed. Normal Git LF/CRLF working-copy and Expo NO_COLOR/FORCE_COLOR notices remain.
- No backend, web, schema, migration, package/environment or production data files were changed. No credentials accessed, database mutations, real storage uploads, commits or pushes.

## Physical-device checks still required

Automated rendering and exports do not certify physical layout, GPS or camera permissions. On iPhone with Dynamic Island, a small iPhone and Android:

1. Verify safe areas, long names/park labels, larger system text, scrolling and the four tabs.
2. Open an assigned patrol and confirm the existing start → live navigation and completion flows with authorized test data. Check blue approach, green planned route, orange GPS trail, risk warnings and checkpoint interactions.
3. Report/edit a test incident, use GPS/manual coordinates, open the keyboard and ensure inputs remain reachable. Confirm the original four categories.
4. Select camera/gallery/camera-trap evidence, inspect previews, remove files, submit, interrupt/retry uploads against the same incident ID and reopen private evidence. Do not mutate production records just to verify styling.
5. Open profile and confirm the actual account information and logout. No buttons should overlap the tab bar.

The previously unconfirmed private-media delivery failure is not fixed by this UI task. Existing secure diagnostics and retry behavior are preserved; diagnose any recurrent provider failure separately.
