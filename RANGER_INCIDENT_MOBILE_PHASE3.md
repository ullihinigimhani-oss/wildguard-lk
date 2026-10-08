# Ranger mobile incident reporting — Phase 3

Implemented on `feature/ranger-patrol-incident-management`.

The existing Report Incident tab now provides a real-data incident workflow. Its subordinate screens follow the existing Ranger native-stack pattern; exactly four bottom tabs remain: Dashboard, My Patrol, Report Incident, Profile. Incident creation is also accessible from active Patrol Details and Live Patrol Navigation using the selected patrol ID. These actions push the form without clearing navigation sessions, completing patrols or altering GPS/ORS/RiskZone code.

## Screens and behavior

- **Field Incident Reporting:** active-patrol selection, actual patrol title/park/status, Report New Incident and My Incident Reports. No-active state links to My Patrols. Completed/cancelled patrols returned by the existing patrol API offer read-only report history.
- **Create / Edit Incident:** shared keyboard-aware form, selected type cards, title/description validation, explicit Sri Lanka date/time inputs (`YYYY-MM-DD`, 24-hour `HH:MM`, UTC+05:30), fixed GPS or controlled manual coordinates, disabled evidence section, server-confirmed submission. No unsupported severity/notes fields are sent. Edits PATCH only changed fields and preserve untouched occurrence seconds and GPS values.
- **My Incident Reports:** patrol-filtered backend list, newest-first server order, type/title/time/status/patrol/location/evidence count, loading/empty/error/retry, pull-to-refresh, pagination, and an explicit include-withdrawn history filter. Withdrawn records are excluded from the normal list. No local incident-record store or offline queue was added.
- **Incident Details:** full report, associated patrol/park/reporting Ranger, coordinates, created/updated times, evidence metadata if returned, server ID/reference, edit and confirmed soft-withdraw actions. Additional reports can be created independently on the same eligible patrol.

## Backend integration

All calls reuse the existing authenticated Axios client and its timeout/token behavior.

| Action | Existing endpoint |
| --- | --- |
| Create | `POST /api/patrols/:patrolId/incidents` |
| Patrol reports/history | `GET /api/patrols/:patrolId/incidents?page=…&includeWithdrawn=…` |
| Read | `GET /api/incidents/:incidentId` |
| Edit changed fields | `PATCH /api/incidents/:incidentId` |
| Soft withdrawal | `POST /api/incidents/:incidentId/withdraw` |

The API adapter requires a backend-confirmed incident ID before navigating to success. Immediate duplicate taps are blocked using refs as well as loading/disabled controls. Multiple successful reports receive independent server identities; edits do not create another incident. Transport retries remain explicit. The backend has no client idempotency-key contract; after an ambiguous timeout, review My Incident Reports before retrying a create.

| Display type | Existing validated code |
| --- | --- |
| Poaching / Snare | `POACHING_SNARE` |
| Illegal Campsite | `ILLEGAL_CAMPSITE` |
| Wildlife Conflict | `WILDLIFE_CONFLICT` |
| Animal Carcass | `ANIMAL_CARCASS` |

## GPS and evidence

The form reuses `useForegroundLocation` only when Use Current GPS Location is pressed. Existing permission/service/accuracy/freshness checks remain authoritative. A valid fix is copied into the form and the watcher stops. Latitude, longitude, accuracy and capture time are displayed. The selected point remains fixed while typing. A capture older than 30 seconds requires recapture or explicit confirmation that this fixed point is the incident location. Manual coordinates are numeric, finite, range-checked and explicitly identified as the known incident point. No PatrolLocation is written by the form, and no map provider or ORS route is introduced.

Take Photo, Choose from Gallery and Camera Trap Evidence are disabled with a secure-storage-unavailable explanation. They request no camera/gallery permissions, upload no media and send no evidence URLs or binary data. Text-only creation remains available. Details display existing evidence metadata if the backend returns it.

## Restrictions, refresh and errors

Edit/Withdraw require the authenticated Ranger to be both reporter and currently assigned patrol Ranger, an `IN_PROGRESS` patrol, a `PENDING` incident and no withdrawal. Completed/cancelled, reviewed, unlinked legacy, other-owner and withdrawn reports are read-only. Creation is blocked for non-active patrols. Backend authorization remains authoritative for all requests and races.

Withdrawal requires Keep Report / Withdraw Incident confirmation and retains the server record. Focus refresh updates lists/details/forms when returning; pull-to-refresh is supported on landing/list/details. Focus-scoped reads use AbortController and generation guards; no incident polling is added. The landing retains the existing patrol-fetch hook. HTTP 403/404/409 mutation failures refresh authoritative state while keeping form input. Friendly handling covers 400 field errors, 401, 403, 404, 409, 503 and network failures. Drafts survive ordinary focus refresh; removing an unsaved form requires a discard dialog. Successful drafts are not retained as local incident records.

## Appearance and accessibility

New incident UI uses the existing root-loaded Plus Jakarta Sans wrappers, forest green `#174D3A`, deep green `#103B2E`, cream `#F5F6F0`, sage `#DCE9DD`, white cards, and danger `#B63B3B`. Secondary text uses a darker muted green for readable contrast. Rounded cards, Ionicons, labelled inputs/type radio cards, named status badges, shared 54px buttons, keyboard avoidance and existing safe-area handling are reused. Shared Button/Screen extensions are optional and preserve defaults for other screens. No dependencies or font-loading behavior changed.

## Changed files

All paths below are relative to this repository.

| File | Change |
| --- | --- |
| [mobile/src/components/common/Button.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/components/common/Button.js>) | Optional scoped button color, preserving defaults |
| [mobile/src/components/common/Screen.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/components/common/Screen.js>) | Optional ScrollView refresh control |
| [mobile/src/components/incident/IncidentUI.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/components/incident/IncidentUI.js>) | Incident cards, fields, badges, inputs, loading/errors, disabled evidence UI |
| [mobile/src/hooks/useIncidentResource.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/hooks/useIncidentResource.js>) | Focus-scoped cancellable reads and refresh |
| [mobile/src/utils/incident.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/utils/incident.js>) | Type mapping, field validation, precise edit patches, permissions, GPS validation, time/error formatting |
| [mobile/src/services/incidentApi.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/services/incidentApi.js>) | Real Phase 2 API client adapter |
| [mobile/src/screens/incident/RangerIncidentScreen.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/screens/incident/RangerIncidentScreen.js>) | Active patrol landing and history |
| [mobile/src/screens/incident/ReportIncidentScreen.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/screens/incident/ReportIncidentScreen.js>) | Shared create/edit form, GPS snapshot, draft protection |
| [mobile/src/screens/incident/MyIncidentReportsScreen.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/screens/incident/MyIncidentReportsScreen.js>) | Paginated report list and history filter |
| [mobile/src/screens/incident/IncidentDetailsScreen.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/screens/incident/IncidentDetailsScreen.js>) | Read details, edit entry and soft withdrawal |
| [mobile/src/navigation/AppNavigator.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/navigation/AppNavigator.js>) | Authenticated Ranger-only subordinate incident routes with context identities |
| [mobile/src/navigation/linking.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/navigation/linking.js>) | Protected incident deep links with sensible tab back destination |
| [mobile/src/screens/patrol/PatrolDetailsScreen.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/screens/patrol/PatrolDetailsScreen.js>) | Contextual report/new-report-list actions |
| [mobile/src/screens/patrol/LivePatrolNavigationScreen.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/screens/patrol/LivePatrolNavigationScreen.js>) | Contextual report action without session reset |
| [mobile/tests/foundation/incidentApi.test.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/tests/foundation/incidentApi.test.js>) | API contracts, validation, permissions, GPS/error checks |
| [mobile/tests/foundation/incidentScreens.test.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/tests/foundation/incidentScreens.test.js>) | Create/edit/list/details/withdraw, duplicate taps, multiple reports, GPS, drafts, locks, refresh |
| [mobile/tests/foundation/linking.test.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/tests/foundation/linking.test.js>) | Incident deep-link context and demo exclusion |
| [mobile/tests/foundation/roleNavigation.test.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/tests/foundation/roleNavigation.test.js>) | Ranger-only incident routes |
| [mobile/tests/foundation/patrolDetails.test.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/tests/foundation/patrolDetails.test.js>) | Correct contextual IDs and unchanged lifecycle |
| [mobile/tests/foundation/liveNavigationScreen.test.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/tests/foundation/liveNavigationScreen.test.js>) | Incident action pushes existing patrol context |
| [mobile/tests/foundation/liveNavigationHook.test.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/tests/foundation/liveNavigationHook.test.js>) | Reached destinations survive incident-screen blur/resume |
| [RANGER_INCIDENT_MOBILE_PHASE3.md](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/RANGER_INCIDENT_MOBILE_PHASE3.md>) | This implementation and verification report |

## Verification

- Full mobile suite: **264 tests passed, 27 suites passed, 0 failed**. Existing four-tab, typography, authentication, patrol, GPS, map, ORS/risk and route regressions remain included.
- Android Hermes export: passed, 972 modules, 2.4 MB `.hbc` bundle, output `mobile/.expo/incident-ui-android`.
- Expo Web export: passed, 656 modules, 1.1 MB JavaScript bundle, output `mobile/.expo/incident-ui-web`.
- Export directories are Git-ignored; `backend/.env` remains Git-ignored.
- `git diff --check` passed. No backend, shared navigation logic, web, Prisma, migrations, dependency manifests or environment files changed.
- Tests use controlled API/location mocks. No production API mutations or database reads/writes were performed. Existing users, incidents, evidence, patrols, actual trail and TEST RiskZones were not modified.

## Physical-device checks still required

On an approved Ranger account, verify iPhone/Android safe areas, small screens/large text, keyboard/date/time entry, foreground GPS permission denial/retry/settings, actual fix accuracy, stale-point confirmation, hardware/header Back draft dialog, multiple reports, and live-navigation progress after returning from the form. Verify real authenticated backend responses and completion/review races on a designated test patrol. Exports prove bundling/Hermes compilation, not installed-device or real-world GPS behavior. Secure evidence storage/upload integration remains pending.
