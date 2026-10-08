# Phase 4: secure incident evidence storage

Implemented on `feature/ranger-patrol-incident-management` using the existing IncidentEvidence schema. No schema, migration, environment file, production database record, patrol lifecycle, GPS, ORS, RiskZone or manager web UI changes were made. The existing four Ranger tabs are preserved.

## Integration and storage

The backend uses Cloudinary SDK 2.11.0 with backend-only environment configuration: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Configuration presence was verified without printing values. `backend/.env` remains Git-ignored and was not modified, copied or committed.

Server-side SDK uploads are signed and use `type: authenticated`, an explicit image/video resource type, an allowed format and a unique server-generated public ID. Overwriting is disabled. A signed upload alone does not make delivery private; this implementation explicitly verifies authenticated delivery in the provider result. See [Cloudinary access controls](https://cloudinary.com/documentation/control_access_to_media) and [Upload API](https://cloudinary.com/documentation/image_upload_api_reference).

IncidentEvidence.fileUrl stores an opaque internal asset reference. IncidentEvidence.metadata stores normalized source/capture/camera-trap information plus server-only asset ID, public ID, version, resource type, format, content hash and retry identity. Media binaries are never stored in Neon. API presentations hide storage internals, signed provider URLs and all permanent media URLs. Legacy unverified URLs are unavailable to the private gallery; existing database records are not rewritten.

## Endpoints

| Endpoint | Authorization and response |
| --- | --- |
| `POST /api/incidents/:incidentId/evidence` | Approved authenticated Ranger; one multipart file; returns confirmed evidence metadata/ID |
| `GET /api/incidents/:incidentId/evidence/:evidenceId/access` | Existing Ranger ownership/current assignment or Park Manager read policy; returns short-lived backend media path and expiry |
| `GET /api/incidents/:incidentId/evidence/:evidenceId/media?ticket=…` | Scoped signed capability; verifies expiry, account activity/approval/current role and incident read scope again; proxies private bytes |

Upload multipart fields: `file`, `source`, `uploadKey`, optional `caption`, `capturedAt`, `cameraTrapId`, `notes`. Sources are PHONE_CAMERA, GALLERY_UPLOAD and CAMERA_TRAP. A manual camera trap import requires its actual ID; capture time is optional but must be an absolute ISO timestamp when supplied. Arbitrary file URLs, identity fields and storage metadata cannot be submitted.

Create the incident first. JSON inline evidence arrays are rejected with `409 EVIDENCE_UPLOAD_REQUIRED`; use the multipart endpoint afterward. Text-only incident creation remains supported. Retry uses the same uploadKey; matching completed uploads return the same evidence ID without creating another asset/record. A key reused with different content/metadata returns 409. Retry identity lasts in the selected mobile screen state and the saved server metadata; no offline upload queue was added.

## Security and limits

- Initial limits: 10 MiB per image, 50 MiB per video, maximum five evidence records per incident. One file per multipart request; bounded field/part sizes.
- Supported media: JPEG, PNG, WebP, HEIC, MP4, MOV, WebM. SVG, executables and unsupported types are rejected.
- Actual bytes are inspected using file-type 22.1.1. The declared MIME must match detected content or be generic octet-stream. Actual byte size drives limits. Cloudinary must also successfully decode the expected authenticated image/video; dimensions are required and videos require duration, rejecting audio-only files disguised as video.
- One upload per Ranger and at most two uploads per backend process bound in-memory media. The multipart buffer is released after processing; no permanent local upload directory exists.
- Upload eligibility is checked before multipart parsing and before remote upload. Authentication is rechecked before finalization, followed by the existing Patrol → Incident row locks. Only a pending, non-withdrawn incident on the assigned reporting Ranger's IN_PROGRESS patrol can receive evidence. The five-item limit is rechecked under those locks.
- Cloudinary I/O occurs outside the database transaction. Completion, reassignment, review, withdrawal, session expiration and DB finalization failures trigger removal of the newly created private asset. Cleanup is attempted three times; an unconfirmed cleanup returns MEDIA_CLEANUP_FAILED and the mobile UI asks for administrator intervention instead of offering blind retry.
- Media access uses a separate JWT audience, scoped incident/evidence/account identities and a maximum five-minute expiry capped by the original sign-in expiry. It cannot act as an ordinary login token. Every media request rechecks current account and incident scope. Completed reports remain readable under the existing authorization policy.
- The Cloudinary private-download URL is generated with a 60-second expiry only inside the backend and is never returned or redirected to the client. The media proxy uses no-store/nosniff/no-referrer headers, forwards valid single byte ranges for playback, rejects redirects, streams with backpressure and has a bounded read timeout.
- Provider/DB exception details and credentials are never logged or serialized by the evidence code.

Short-lived tickets are bearer capabilities: protect them from logging/sharing, use HTTPS, and redact query strings at reverse proxies and monitoring tools. Expiry is checked when each media request starts; an already-authorized stream may finish within its bounded read timeout. No ticket or provider URL is stored in mobile persistent storage. A hard process crash during an external upload can leave an orphan private asset; periodic administrator reconciliation is an operational requirement because this phase adds no durable cross-service job/outbox schema.

## Mobile functionality

Incident Details → Add Evidence opens the subordinate IncidentEvidence screen with the saved incident ID. Create/edit forms now include an optional EvidenceDraft picker: Take Photo, combined photo/video Gallery, and manual Camera Trap imports. Selected files show previews, filenames, sources, sizes and remove controls; camera-trap ID/capture fields are supported. Edit forms show saved evidence separately and never re-upload it.

Submit validates the form and local files, saves the incident once, then uploads new evidence sequentially with saving/upload progress. The confirmed incident ID remains in screen state for retries. Partial failure displays “Incident saved, but some evidence failed.” and Retry Failed Uploads reuses the same ID and stable upload keys, skipping confirmed successful items. Saved form fields remain fixed during this recovery flow. Navigating to the saved incident warns before discarding remaining selections. Text-only reports still work. Local URI availability/size is rechecked before saving and each upload; expired/changed files prompt removal and reselection. Draft selections persist through field edits, validation and creation errors, but are not an app-restart/offline queue.

Available actions: Take Photo, Choose Photo from Gallery, Choose Video from Gallery, Import Camera Trap Photo/Video. Permissions are requested on deliberate camera/gallery actions. Manual imports use Expo DocumentPicker with cache copies. Multiple selections receive independent retry keys, image/video previews, captions and camera-trap metadata. Size and five-item capacity checks occur before requests. Uploads are serial; progress reflects transfer to the backend and remains below 100% until the server confirms persistence. Errors retain the selected file and incident, allow same-key retry, or allow editing upload details with a new key. Selection discard requires confirmation.

The Incident Details evidence gallery displays metadata and opens photos/videos through authorized, expiring backend tickets. It provides access refresh/error retry and clears expired/blurred media access. Videos use Expo Video controls and pause on blur. Actual HEIC/video codec preview support depends on the device/browser; unsupported previews show an error, with no public-delivery fallback.

Expo-compatible additions: expo-video ~57.0.5 and expo-document-picker ~57.0.3. Existing expo-image-picker and expo-file-system are reused. The image-picker config plugin declares camera/photo permissions and disables microphone permission; this phase captures photos and imports existing videos. Existing fonts, safe areas, shared buttons and forest-green UI remain in use.

## Verification results

| Check | Result |
| --- | --- |
| Prisma validation | Passed |
| Full backend suite | 483 tests / 22 suites passed |
| Full mobile suite | 304 tests / 29 suites passed after the evidence-form improvement |
| Android Hermes export | Passed; 988 modules, 2.5 MB .hbc bundle |
| Expo Web export | Passed; 689 modules, 1.1 MB bundle |
| Diff whitespace check | Passed |
| .env and export Git ignore | Confirmed |

Exports are under the ignored mobile/.expo/incident-evidence-android and mobile/.expo/incident-evidence-web directories. Tests mock Cloudinary/provider calls and all persistence. Real file-type detection is additionally tested in an isolated Node process. No real Cloudinary files were uploaded and no production database reads/writes were used for verification. Real account upload/delivery permissions remain to be verified in a separate staging environment.

Tests cover actual content/MIME/size validation, five-item races, authenticated provider parameters, cleanup failure, completion during upload, ownership/review/withdrawal locks, retry identity, token expiry/scope/revocation, private proxy responses, media selections/permissions/previews/progress, camera-trap metadata, repeated uploads and all existing navigation/patrol regressions.

Dependency audit still reports broader existing project findings (backend 26; mobile 62 including shell-quote critical). The new cloudinary, multer, file-type, expo-video and expo-document-picker packages are not listed as vulnerable. No unrelated dependency upgrades or forced audit fixes were made.

## Deployment requirements

1. Keep credentials only in backend deployment secrets; an unsigned preset is unnecessary. No new Cloudinary environment variables are required.
2. Run Node 22 or newer for file-type and the existing Node web-stream/fetch APIs.
3. Use an HTTPS backend; allow multipart bodies slightly above 50 MiB and sufficient upload time at the reverse proxy. The mobile per-upload timeout is five minutes; provider upload timeout is two minutes after receipt of the file.
4. Confirm authenticated image/video upload and private-download permissions/quotas in a staging Cloudinary environment. Delivery is proxied and consumes backend/provider bandwidth.
5. Rebuild a native development/production app to include Expo Video/DocumentPicker and the camera/photo permission configuration; restart the backend after installing its dependencies.
6. Redact media ticket query parameters and provider download URLs from infrastructure logs. Establish private orphan-asset reconciliation and handle cleanup-failure notifications operationally.
7. Resolve the broader existing dependency audit findings separately.

## Physical iPhone testing

Use separate staging services for end-to-end uploads; do not upload test files to the configured real account or change production incident data during verification. Camera/gallery permissions and local selection previews can be exercised without uploading.

1. Open the rebuilt app and sign in as an approved assigned Ranger on an IN_PROGRESS staging patrol. Save a staging incident, then open Add Evidence; confirm the four tabs and patrol navigation context remain intact.
2. Deny camera permission, verify the helpful error, enable it in Settings and retry. Capture a photo and check preview/name/size/caption.
3. Select multiple photos and a gallery video, test video playback, and import a camera-trap file from Files with actual trap ID/capture time/notes.
4. On staging, upload each item; verify transfer progress, server-confirmed completion, private gallery playback and independent evidence IDs. Interrupt connectivity, then retry the same selected item; verify no second incident or evidence record is created.
5. Test oversized selections and the fifth-item limit. Complete/review/withdraw the staging incident's patrol/report while an upload is pending; verify lock response and newly created asset cleanup.
6. Confirm a different Ranger cannot obtain access, completed reports remain read-only, ticket expiry requires reopening, and logout/back navigation removes visible media access. Exercise small-screen, large-text, keyboard and discard-dialog behavior.

## Files changed by this task

The follow-up evidence-form workflow changes are limited to mobile/src/components/incident/EvidenceDraft.js (new), mobile/src/screens/incident/ReportIncidentScreen.js, mobile/src/utils/incidentEvidence.js, mobile/tests/foundation/incidentScreens.test.js and this document. No backend/dependency/navigation changes were needed for that follow-up. Android Hermes and Expo Web exports were rerun to ignored .expo/incident-form-evidence-android and .expo/incident-form-evidence-web directories. Physical iPhone checks should also cover selecting/removing five files before Submit, text-only submission, draft discard/keep, expired local URI reselection, partial failure and same-ID retry, and editing a report that already has evidence. Run actual uploads only against staging services.

- [mobile/src/components/incident/EvidenceDraft.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/components/incident/EvidenceDraft.js>)

The pre-existing root Markdown deletions observed during this session were left untouched and are not part of this implementation.
- [backend/package.json](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/backend/package.json>)
- [backend/package-lock.json](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/backend/package-lock.json>)
- [backend/src/controllers/incidentEvidence.controller.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/backend/src/controllers/incidentEvidence.controller.js>)
- [backend/src/middleware/incidentEvidence.middleware.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/backend/src/middleware/incidentEvidence.middleware.js>)
- [backend/src/middleware/error.middleware.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/backend/src/middleware/error.middleware.js>)
- [backend/src/routes/incident.routes.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/backend/src/routes/incident.routes.js>)
- [backend/src/services/cloudinaryEvidence.storage.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/backend/src/services/cloudinaryEvidence.storage.js>)
- [backend/src/services/incidentEvidence.service.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/backend/src/services/incidentEvidence.service.js>)
- [backend/src/services/incident.service.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/backend/src/services/incident.service.js>)
- [backend/src/validators/incidentEvidence.validator.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/backend/src/validators/incidentEvidence.validator.js>)
- [backend/tests/integration/incident.api.test.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/backend/tests/integration/incident.api.test.js>)
- [backend/tests/integration/incidentEvidence.api.test.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/backend/tests/integration/incidentEvidence.api.test.js>)
- [backend/tests/unit/incident/incidentEvidence.service.test.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/backend/tests/unit/incident/incidentEvidence.service.test.js>)
- [backend/tests/unit/incident/incidentEvidence.validator.test.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/backend/tests/unit/incident/incidentEvidence.validator.test.js>)
- [mobile/package.json](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/package.json>)
- [mobile/package-lock.json](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/package-lock.json>)
- [mobile/app.json](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/app.json>)
- [mobile/src/components/incident/EvidenceMedia.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/components/incident/EvidenceMedia.js>)
- [mobile/src/components/incident/IncidentUI.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/components/incident/IncidentUI.js>)
- [mobile/src/navigation/AppNavigator.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/navigation/AppNavigator.js>)
- [mobile/src/navigation/linking.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/navigation/linking.js>)
- [mobile/src/screens/incident/IncidentEvidenceScreen.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/screens/incident/IncidentEvidenceScreen.js>)
- [mobile/src/screens/incident/IncidentDetailsScreen.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/screens/incident/IncidentDetailsScreen.js>)
- [mobile/src/screens/incident/ReportIncidentScreen.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/screens/incident/ReportIncidentScreen.js>)
- [mobile/src/services/incidentEvidenceApi.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/services/incidentEvidenceApi.js>)
- [mobile/src/utils/incidentEvidence.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/src/utils/incidentEvidence.js>)
- [mobile/tests/setup.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/tests/setup.js>)
- [mobile/tests/foundation/incidentEvidence.test.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/tests/foundation/incidentEvidence.test.js>)
- [mobile/tests/foundation/incidentEvidenceApi.test.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/tests/foundation/incidentEvidenceApi.test.js>)
- [mobile/tests/foundation/incidentScreens.test.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/tests/foundation/incidentScreens.test.js>)
- [mobile/tests/foundation/roleNavigation.test.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/tests/foundation/roleNavigation.test.js>)
- [mobile/tests/foundation/linking.test.js](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/mobile/tests/foundation/linking.test.js>)
- [docs/api/INCIDENT_EVIDENCE.md](<C:/Users/Lihini/Desktop/WildGuard LK/wildguard-lk/docs/api/INCIDENT_EVIDENCE.md>)
