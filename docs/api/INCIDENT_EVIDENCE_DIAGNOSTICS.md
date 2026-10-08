# iPhone evidence upload diagnosis

## Confirmed client_file_prepare copy race (follow-up)

The previous `uploadIncidentEvidence` implementation called `source.copy(stagedFile)` without awaiting it, then immediately checked destination existence/size. Installed Expo SDK 57 / expo-file-system ~57.0.7 declares iOS `copy` as an AsyncFunction (with separate copySync); the destination check therefore raced the asynchronous copy. It also deleted the staged copy in a request finally block, including failed uploads, so retries depended on the original picker URI remaining valid. A 7.7 MB JPG is below the image limit; this error happens before HTTP/Cloudinary and has no content hashing or MIME signature detection step.

Selection now calls shared prepareEvidenceItem, awaits File.copy, verifies the destination, and keeps a stable app-owned temporary file under Paths.document. The document directory avoids cache eviction while the report is being written. Filename, MIME, actual stat size and retry key remain on the selection. The original picker URI is not retained as the upload source. Both the report/edit form and later Add Evidence picker use this path. Drafts already open can be upgraded by ensureEvidencePrepared without changing their retry key.

uploadIncidentEvidence uses the prepared stable URI directly and deletes its owned copy only after confirmed evidence success. Failures retain the copy. Explicit Remove/Discard cleans only owned evidence copies, never picker originals. Failed preparation/partial batch copies are cleaned before acceptance into the draft. Upload-details edits retain the owned file independently of a changed retry key. An unavailable prepared file sets reselectRequired and blocks blind upload retries until removed/reselected. Draft files are not a persistent offline queue; unexpectedly closing the app can leave an owned temporary file, which is intentionally not purged while its submission outcome is unknown.

Safe client diagnostics contain requestId, client_file_prepare, a precise step (uri_normalization/source_stat/stable_copy/stable_stat), safe code, MIME and size only. They never include raw native exceptions, file paths, contents or credentials. The stage/step is also available in user-facing preparation errors.

Physical iPhone retest: load the updated bundle; select a fresh camera photo and a fresh gallery JPG; confirm preview/filename/size; edit form text and wait before uploading. Verify a network failure retains the same selection and retry identity, then retry against the already-saved incident. Check its existing evidence before reselecting anything whose previous upload outcome is uncertain. Remove an expired selection and pick a new file. Confirm no second incident is created, successful evidence is not re-uploaded, and Add Evidence still works. Physical confirmation remains pending; automated tests use an asynchronous File.copy mock whose destination is unavailable until its promise resolves.

Files changed for this follow-up: mobile/src/utils/incidentEvidence.js, mobile/src/services/incidentEvidenceApi.js, mobile/src/components/incident/EvidenceDraft.js, mobile/src/screens/incident/ReportIncidentScreen.js, mobile/src/screens/incident/IncidentEvidenceScreen.js; tests/foundation/incidentEvidencePreparation.test.js (new), incidentEvidenceApi.test.js, incidentEvidence.test.js, incidentScreens.test.js; this document. No backend, schema, environment, database, Cloudinary, ORS or RiskZone changes were made for this follow-up.

Mobile verification: 319 tests / 30 suites passed; Android Hermes and Expo Web exports passed, using ignored .expo/incident-evidence-file-prepare-* directories.

The supplied follow-up logs confirm the real JPG arrived (9,993,126 bytes), passed validation and reached Cloudinary. The phone connection closed at approximately 28 seconds; Cloudinary returned at approximately 50 seconds. The original synchronous handler then refused to finalize because its response connection was destroyed. The exact network/native/proxy reason for the connection closing remains unknown; it was not a multipart or MIME rejection. Automated tests reproduce delayed provider completion, not the physical phone/network itself.

The fix uses `Prefer: respond-async` on mobile multipart requests. Once authenticated bytes are validated, the backend returns HTTP 202 with a private upload receipt, and completes storage/DB work without relying on that response socket remaining open. The existing account/session is rechecked before finalization; row locks and cleanup still apply. Mobile makes short, authenticated GET requests to `/api/incidents/:incidentId/evidence/uploads/:uploadId` and returns success only when confirmed evidence is present. Successful uploads are not recreated. Legacy requests without the preference keep their synchronous contract.

Receipts are bounded (100 per process), contain no media binaries/credentials/provider URLs, and expire ten minutes after finishing. They are ephemeral, so a server restart requires same-key retry; DB deduplication remains authoritative. Multiple backend workers require sticky routing for these in-memory receipts or a future shared job store. This is suitable for the current single Express backend, not a durable distributed upload queue. The two-process-upload/one-Ranger-upload limits remain held until processing ends.

Each pg pool connection now uses a Client subclass that serializes its query promises/callbacks before calling native pg. This prevents implicit native query queuing across Prisma adapter calls, without suppressing warnings or reducing concurrency between separate pool connections. No database records or connection URL were changed.

All three backend Cloudinary configuration variables are present. The SDK configures successfully without a network request. Their values were never displayed or changed. Upload options remain signed backend-only `type: authenticated`, explicit image/video resource type, matching allowed format, no overwrite. No private-delivery settings were relaxed.

## Findings and changes

- Removed the manually specified multipart Content-Type from the mobile API call. Native/browser adapters generate the boundary. Inspection of installed Axios 1.20 shows it already removes Content-Type for React Native FormData; therefore the old header is not established as the root cause.
- Native file parts retain `{ uri, name, type }`; file size/content validation, local availability checks, 300-second request timeout, sequential uploads and existing token handling remain in place. No new native module or Expo Go capability is introduced.
- Malformed/missing-boundary multipart failures are now a safe `400 MULTIPART_INVALID` rather than a generic server exception.
- Each upload has a correlation ID. Safe server JSON logs identify request receipt, authentication, ownership/status preflight, multipart receipt, byte validation, storage upload/response validation, session recheck and database finalization. Logs contain only request/incident IDs, stage, HTTP status, whitelisted error code, MIME, size and elapsed milliseconds. They exclude filenames, URIs, credentials, tokens, signed URLs, media, SQL and GPS. File receipt includes actual multipart byte size. Production iPhone receipt is not yet verified.
- Storage SDK HTTP 401/403 becomes CLOUDINARY_AUTH_FAILED, 404 becomes CLOUDINARY_CONFIG_REJECTED, known timeout errors become CLOUDINARY_TIMEOUT. Raw provider messages are discarded. Other errors remain MEDIA_UPLOAD_FAILED. DB finalization errors remain EVIDENCE_SAVE_FAILED. If cleanup fails, the response keeps MEDIA_CLEANUP_FAILED and its diagnostic retains the original failing-stage code.
- Mobile messages distinguish network/no-response, timeout, file validation, configuration/authentication, storage, database finalization and patrol completion. A safe reference ID/stage/status is displayed. No raw Axios/provider errors are logged or rendered.
- Existing saved-incident retry identity and successful-item skipping remain unchanged. Uploaded assets remain private, and newly uploaded assets are cleaned when finalization fails. No incident is recreated by evidence retry.

## PostgreSQL warning (separate issue)

Installed pg 8.23 emits the supplied deprecation warning when a query is queued behind other work on one client. This was reproduced with a disconnected client, without any database connection. It is a warning about queuing; it does not itself establish a failed query or failed upload.

Incident listing used Promise.all for findMany/count inside one interactive Prisma transaction, which owns one pg client. Those queries now run sequentially, keeping the same RepeatableRead isolation, results and paging. A regression test verifies count does not start before findMany completes. The upload transaction already awaits its queries sequentially. If the warning persists, its origin may be other adapter/client work; no dependencies were downgraded, warnings suppressed or database settings changed.

## iPhone retest and exact evidence to collect

1. Restart the backend and load the updated mobile bundle. Do not submit another incident. Open the existing saved incident and check its evidence gallery/count first.
2. If the original form still retains the failed selection, use Retry Failed Uploads. This retains the same incident ID and upload key, including when a previous response was lost. If the draft was lost by app reload, inspect saved evidence before selecting again; there is no persistent offline draft/key queue. Do not re-add a file already saved.
3. Choose one small JPG under 10 MB. Confirm the patrol remains IN_PROGRESS and the owned incident is pending, not withdrawn/reviewed. A temporary URI availability error requires reselection. Keep the app foregrounded for this controlled user-directed attempt; automated tests never upload to the real account.
4. On failure, collect the displayed message and Reference ID/stage/HTTP status. Copy only backend JSON lines matching that requestId. Do not send .env, raw Axios/Cloudinary dumps, Authorization headers, provider URLs or the photo.
5. Relevant safe stages:
   - No matching request_received: request did not reach this server, or infrastructure logging is unavailable. Check phone connectivity and the existing public API origin.
   - request_received/authenticated/authorization_preflight + error: authentication, role, ownership, status or storage configuration preflight.
   - multipart_receiving without file_received: file transfer/parser/boundary/connection interruption.
   - file_received confirms file MIME and actual size arrived; media_validation failure isolates content/type/metadata validation.
   - cloudinary_upload + code: SDK/provider/network stage. Credential presence alone does not prove authentication.
   - cloudinary_response_validation: provider returned an unexpected/invalid resource.
   - session_recheck/database_finalization: original session expired, patrol/review state changed, or DB record finalization failed. Use the code to distinguish.
   - upload_complete + HTTP 201 with phone timeout: response delivery was lost. Retry using the original key; backend replay prevents another record.

For a persistent pg warning, collect only its exact warning text. Avoid enabling broad Prisma/HTTP debug output or sharing unreviewed stacks/configuration.

## Verification

- Backend: 494 tests / 24 suites passed, Cloudinary mocked.
- Mobile: 312 tests / 29 suites passed.
- Prisma schema validation passed.
- Android Hermes and Expo Web exports passed; outputs are in Git-ignored .expo/incident-evidence-diagnostics-* directories.
- No real production upload, database reset/seed, existing-data mutation, schema/migration, environment change or secret exposure. backend/.env remains ignored.

## Files changed for this diagnostic task

Follow-up receipt fix: backend/src/services/evidenceUploadJobs.js (new), backend/src/controllers/incidentEvidence.controller.js, backend/src/routes/incident.routes.js, backend/src/middleware/incidentEvidence.middleware.js, mobile/src/services/incidentEvidenceApi.js, regression tests and this report. The pg fix adds backend/src/config/serialPgClient.js and backend/tests/unit/incident/serialPgClient.test.js and updates backend/src/config/database.js. Existing concurrent native cache/XHR and compact-label changes were retained.

- backend/src/middleware/evidenceDiagnostics.middleware.js (new)
- backend/src/middleware/incidentEvidence.middleware.js
- backend/src/middleware/error.middleware.js
- backend/src/controllers/incidentEvidence.controller.js
- backend/src/routes/incident.routes.js
- backend/src/services/cloudinaryEvidence.storage.js
- backend/src/services/incidentEvidence.service.js
- backend/src/repositories/incident.repository.js
- backend/tests/integration/incidentEvidence.api.test.js
- backend/tests/unit/incident/incident.repository.test.js (new)
- mobile/src/services/incidentEvidenceApi.js
- mobile/tests/foundation/incidentEvidenceApi.test.js
- docs/api/INCIDENT_EVIDENCE_DIAGNOSTICS.md (new)
