# Ranger offline field capture: Phase 1 and Phase 2

Branch: feature/ranger-patrol-incident-management. Verification date: 2026-10-09.

## Implementation

Native iPhone/Android Rangers now have SQLite-backed, local-first GPS capture and incident drafts. No Phase 3 offline maps, route generation, new Ranger tabs, or automatic patrol lifecycle operations were added.

### Dependencies

Installed with Expo's compatible installer:

- expo-sqlite ~57.0.4
- expo-network ~57.0.2
- expo-crypto ~57.0.3

The existing expo-file-system ~57.0.7 prepares persistent evidence. app.json includes the SQLite plugin. Expo's compatibility check reports a pre-existing Expo patch warning: installed 57.0.25, expected ~57.0.27. The new three packages were selected for the installed SDK; this task did not upgrade Expo itself.

### Local SQLite schema

wildguard-offline.db, schema version 1. WAL, transaction-based initialization, foreign keys on the main connection, pending indexes, and a fail-closed check for newer local schema versions. All reads and queue operations are scoped by authenticated Ranger ID. No JWTs, passwords, signed Cloudinary URLs, or media binaries are stored in SQLite.

| Table | Stored data |
| --- | --- |
| gps | UUID, owner, patrol ID, latitude/longitude/accuracy/original recordedAt JSON, capture timestamp, sync status, processing attempts, safe error, next retry time. Unique owner/patrol/capture timestamp. |
| drafts | UUID, owner, patrol ID, original validated report payload, editable form fields, timestamp, local status, confirmed server ID, attempts, error, next retry time. |
| evidence | UUID, owner, draft ID, attachment order, persistent owned URI, filename, MIME/size/source/upload key/metadata JSON, server evidence ID, status, attempts, error, next retry time. |
| patrol_cache | Owned patrol snapshot with status, saved waypoints and existing display fields. This is cached authority, not a promise that a patrol remains active remotely. |

Local statuses: LOCAL_DRAFT, PENDING_SYNC, SYNCING, SYNCED, SYNC_FAILED, NEEDS_REVIEW. No production Incident enum changes.

### GPS

Foreground navigation validates real coordinates/accuracy and writes SQLite before appending the orange trail. Sync does not gate capture and does not depend on ORS. Navigation merges local and server history, deduplicates by capture instant and coordinates, and sorts chronologically. The existing 1,000-point display cap remains; queue records are retained.

The coordinator uploads original timestamps through the existing /api/patrols/mine/:patrolId/locations endpoint. Rejected or throttled samples are retained for review rather than mislabeled as server-synced. Startup/login recovers interrupted operations. Owned patrol snapshots make already-loaded assigned patrols available during a live offline session. Successful Start/Complete responses update the local snapshot; no lifecycle changes are queued offline.

### Incident drafts and evidence

Use Save Draft on Device in the existing Report Incident form, including incomplete forms. Reopen drafts from Reports saved on this device on the existing Report Incident tab. Unfinished LOCAL_DRAFT records can be edited and resaved. Queued reports are submitted local records and cannot be changed back into editable drafts, even before their first network attempt.

Submit validates the existing required form and evidence rules, commits a stable local incident UUID plus ordered evidence to SQLite, then syncs. A local pending state never claims successful server creation. Once a create attempt has started, its payload stays immutable until acknowledged; this also protects crash/lost-response recovery. Editing an acknowledged server incident remains the existing online workflow.

Evidence reuses the existing Expo picker/camera/import preparation into app-owned persistent document files. Limits remain five items, 10 MB images and 50 MB videos. Before sending, files are checked again. Failed or unavailable files remain stored/referenced with a clear review/reselection message. MEDIA_CLEANUP_FAILED blocks automatic/manual upload retries for administrator review, preserving the existing private-asset cleanup safeguard. Newly selected files removed from an already-persisted draft are not automatically deleted from disk.

Incident creation is confirmed before evidence uploads. Partially uploaded evidence uses the same server incident ID; acknowledged items are skipped. Private Cloudinary credentials, upload/delivery security, media access APIs and content validation remain unchanged. Offline-sync uploads retain local files even after acknowledgement to avoid a response/local-write crash window; automatic media pruning is deliberately not implemented without a retention policy.

### Coordinator

One coordinator triggers at login/startup, restored connectivity, foreground/resume, new pending data and manual Retry Sync. Initial order is GPS, report creation, evidence. Batches are bounded: 25 GPS samples, 10 reports, 10 evidence items per pass. During a long media upload, a priority GPS lane drains every 15 seconds; at most one GPS request runs alongside one media request, with both settled before releasing the worker.

Processing claims and attempt counts are durable. Interrupted SYNCING rows recover on startup/login. Retry uses exponential backoff (5 seconds increasing to 5 minutes), respects numeric/date Retry-After and existing retryAfterSeconds, and persists the next-attempt time. HTTP 429 stops further coordinator requests and its shared cooldown survives restart. Manual Retry Sync does not bypass persisted delays. Network/server failures also pause the pass briefly. Authentication 401 pauses until reauthentication. Logout/account changes abort the prior session's requests and preserve pending records; an old account response cannot pause the new account.

The shared Screen component shows Offline, Saved on device, Pending sync counts, Syncing, Synced, and Sync failed/review states with Retry Sync. The four Ranger tabs and existing screen layouts/routes remain.

### Server idempotency

The existing patrol-incident creation endpoint accepts an optional UUID-v4 Idempotency-Key. The service derives a deterministic Incident primary key from Ranger ID, patrol ID and that client UUID. Existing primary-key uniqueness and the existing Patrol row lock prevent duplicate report creation. Matching owned retries return the already-persisted report; changed content is rejected with IDEMPOTENCY_CONFLICT. New reports still require an active assigned patrol. A lost response can recover an already-created report after completion, including completion winning the lock between the first read and the transaction.

GPS already has deterministic primary-key deduplication by patrol/capture time. Evidence already replays stable uploadKey/requestHash under its existing locks and performs existing cleanup/finalization checks. Delivery remains retried and acknowledged; this is not a claim of exactly-once network transport or exactly one external storage operation.

## Verification

- Mobile suite after the form-lifecycle fix: 461 tests passed in 43 suites.
- Targeted backend: 126 tests passed in six suites, including six new incident idempotency tests.
- Full backend: 616 passed, 11 pre-existing failures in two suites (627 tests total): incident.api.test.js and incident.validator.test.js. The failures concern existing incident review/validation behavior outside this change.
- Prisma validation: passed; no schema changes.
- Android Hermes export: passed with the final source changes.
- Expo Web export: passed with the final source changes. Browser offline persistence is intentionally unsupported; existing online web flows remain available.
- Expo dependency check: existing Expo patch warning described above.
- git diff --check: passed.

Tests use a temporary isolated on-disk SQLite database, mocked mobile/backend HTTP, mocked Cloudinary and in-memory backend repositories. Coverage includes SQLite close/reopen, account scope, transactional draft editing/media order, interrupted claims, immutable crash recovery payloads, GPS capture while risk/routing APIs fail, trail deduplication, network restoration/cleanup, long-upload GPS priority, partial evidence retry, stable IDs, 429 restart/manual retry, 401/expiry, account-switch races, completed/late rejection, cached patrol authorization, and existing navigation/evidence regressions. No production mutation tests or real storage uploads were performed.

## Remaining blockers and limitations

1. The existing backend accepts GPS samples only within two minutes of capture and requires IN_PROGRESS. Longer offline captures or completion before sync are kept locally as NEEDS_REVIEW. Accepting historical samples or reconciling data after completion requires an explicit policy approval; this task did not weaken authorization or retimestamp data.
2. New incidents and evidence cannot be finalized after patrol completion/review locks. Only an already-created matching incident can be replayed read-only. Late unsent reports remain local for review; no reconciliation API was invented.
3. Authentication remains the existing in-memory verified session. An unexpired session survives a foreground network failure, but still expires at its original deadline. Cold app restart requires online login before owned queues can reopen/sync; secure persistent offline authentication was not added.
4. GPS capture remains foreground-only on the existing navigation screen. No claim of capture after termination/background tracking. Sync timers are not a verified OS background service.
5. SQLite/documents are app-private native storage, not newly encrypted storage. Uninstall/device loss removes local data. Pending data is retained on logout. No automatic disk-retention cleanup, export/reconciliation UI or browser persistence was added.
6. Offline route calculation/map downloads are excluded. Unverified risk data still blocks routing and remains visibly warned; GPS capture can continue independently.
7. Physical iPhone/Android native-module behavior, document persistence, battery/performance and real reconnection still need device verification. Builds and automated mocks cannot establish those physical results.

No Prisma migration is required for the implemented idempotency support. Policy approval is required before changing historical-GPS or completed-patrol reconciliation rules. Production schema, migrations, Neon records, environment values, ORS quotas/routes, RiskZones and Park Manager code were not changed. backend/.env remains Git-ignored. No commit/push was performed.

## Physical iPhone checks

Use an isolated/staging test account and patrol for mutation checks.

1. Start/restart the updated backend with the new idempotency support before using the new mobile client. Reload the app after installing native dependencies; log in online as its assigned Ranger. Open My Patrol and the active patrol online to cache the owned snapshot. Confirm the working blue/green routes and RiskZone warnings.
2. Keep navigation foregrounded, enable airplane mode, and capture real accurate GPS while walking. Verify Offline/Saved on device counts and the orange trail without a routing success claim.
3. Open Report Incident from the cached active patrol. Enter form data and choose photos/video; Save Draft on Device. Reopen/edit/resave it from the local drafts section, then Submit to see Pending sync rather than a success claim.
4. Restore connectivity within two minutes for the happy GPS path. Verify pending counts decrease, originals keep their capture times, and the orange trail has no duplicate server/local points. Test a longer offline interval separately: old points should stay local with review state under the existing policy.
5. Verify one server report ID, ordered private evidence, partial-failure retry without another report or duplicate successful evidence, and continuing GPS sync during a slow video/photo upload.
6. Save an unsubmitted draft, close/reopen the app, restore connectivity and log in as the same Ranger. Confirm the draft/files survived. A cold offline login is not supported by the current session design.
7. Sign out and use another approved Ranger: the first account's drafts/trail/counts must stay hidden. Sign back into the original account to recover its pending data.
8. In isolated data, complete/cancel the patrol before sync or expire the session. Confirm backend rejection/auth pause and retention on the device; do not force reconciliation or edit patrol coordinates.

## Changed files

- `backend/src/controllers/incident.controller.js`
- `backend/src/services/incident.service.js`
- `backend/tests/unit/incident/incident.idempotency.test.js`
- `docs/ranger-offline-phase-1-2.md`
- `mobile/App.js`
- `mobile/app.json`
- `mobile/package-lock.json`
- `mobile/package.json`
- `mobile/src/components/common/OfflineStatus.js`
- `mobile/src/components/common/Screen.js`
- `mobile/src/components/incident/EvidenceDraft.js`
- `mobile/src/components/incident/LocalDrafts.js`
- `mobile/src/hooks/useAssignedPatrol.js`
- `mobile/src/hooks/useAuth.js`
- `mobile/src/hooks/useLiveNavigation.js`
- `mobile/src/hooks/useOffline.js`
- `mobile/src/hooks/useRangerPatrols.js`
- `mobile/src/screens/incident/RangerIncidentScreen.js`
- `mobile/src/screens/incident/ReportIncidentScreen.js`
- `mobile/src/screens/patrol/PatrolDetailsScreen.js`
- `mobile/src/services/incidentApi.js`
- `mobile/src/services/incidentEvidenceApi.js`
- `mobile/src/services/offlineGps.js`
- `mobile/src/services/offlinePatrol.js`
- `mobile/src/services/offlineSync.js`
- `mobile/src/storage/offlineStorage.js`
- `mobile/src/storage/offlineStorage.web.js`
- `mobile/tests/foundation/incidentScreens.test.js`
- `mobile/tests/foundation/liveNavigationHook.test.js`
- `mobile/tests/foundation/offlineStorage.test.js`
- `mobile/tests/foundation/session.test.js`


## Incident form lifecycle fix (2026-10-09)

Root cause: saveLocal awaited the sync worker after queue persistence and retained editable form/media state when no server acknowledgement arrived. Offline submitted records could also be reopened as editable drafts before their first attempt.

The successful SQLite transaction now confirms local submission immediately. The form fields, selected media references and validation/location state reset; a submission receipt replaces the form with Saved on device — Pending Sync. The queue and persistent media are untouched. Sync runs independently and receipt polling updates status/server ID without restoring form data. Navigation retains the local UUID for receipt remounts. LOCAL_DRAFT remains editable; all other local report statuses are blocked from form resubmission and SQLite draft replacement. UUID allocation happens once before persistence and survives retry of a failed local save. A component keyed by account/report identity and cancelled receipt reads prevent stale callbacks from clearing another opened draft.

Files changed for this follow-up: mobile/src/screens/incident/ReportIncidentScreen.js, mobile/src/storage/offlineStorage.js, mobile/tests/foundation/incidentScreens.test.js, mobile/tests/foundation/offlineStorage.test.js, and this report. No backend changes were needed for this follow-up.

Physical retest: on an isolated active patrol, submit a report with photos in airplane mode; immediately confirm the receipt, no editable old fields/photos and no Submit button. Restore connectivity and verify exactly one report/private evidence set and receipt Synced status. Navigate away/back and reopen its local receipt; it must not become editable. Save/reopen a separate unfinished draft while that report syncs and verify its contents stay intact. Exercise a local storage failure to confirm entered data/photos remain and retry keeps the same UUID. Physical device results remain unverified by automated tests.

Follow-up verification: all 461 mobile tests passed in 43 suites; Android Hermes and Expo Web exports passed; git diff --check passed. Tests use mocked HTTP/storage uploads and isolated local SQLite. No production data was changed and no migration, commit or push was performed.
