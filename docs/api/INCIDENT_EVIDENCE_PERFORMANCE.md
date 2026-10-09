# Photo upload performance and private evidence diagnosis

## Findings

The old photo path preserved the full selected file and sent it unchanged. The supplied real-device measurements place the bottleneck in backend-to-Cloudinary transfer/processing: an 8,195,105-byte JPEG took approximately 50.8 seconds there (55.5 seconds total), compared with 4.46 seconds for a 755,394-byte PNG (7.84 seconds total). This establishes where time was spent, not whether uplink speed or provider processing dominates. No real Cloudinary uploads or production database writes were performed during this change.

The message near the media controller's former line 192 is a catch-all for failed server fetches or response streaming. It did not identify the cause. The reported private-display failure cannot be reproduced against the actual asset without a further controlled device request. It is not proven to be a signature, credential, redirect, or delivery configuration issue. Cloudinary's documented private_download_url supports authenticated resources; the existing backend-only signed download mechanism is retained.

## Photo mode

Both initial form selection and later Add Evidence offer explicit Original or Optimized photo modes. Original is the default and preserves the selected file's bytes. Optimized creates a JPEG at quality 0.8 with the longest dimension capped at 1600, never upscales, and makes one app-owned stable copy on native. Originals in the camera/gallery/picker are never overwritten or deleted. Compression may remove embedded metadata, as the picker clearly warns; use Original for forensic or metadata-preservation requirements. Original retention outside the app is the Ranger's responsibility when choosing an optimized upload. Small PNGs may not benefit from lossy JPEG conversion; use Original as appropriate.

An optimized selection keeps its prepared file and upload key across incident creation, upload failure and retry. A quality change affects only future selections. No re-encoding occurs during retry. Owned files are removed only after confirmed evidence success or explicit discard. On web the encoded Blob is retained for multipart upload and its owned preview URL is revoked on success/discard. HEIC decoding depends on device/browser codec support; a decoder failure asks for reselection with Original quality instead of uploading mislabeled content. Videos, 10 MB/50 MB limits, five-item limit, sequential uploads, duplicate prevention and backend authorization are unchanged.

## Safe timing logs

- mobile_image_preparation: preparation elapsedMs, originalSize and resulting fileSize; no filenames or URIs.
- multipart_transfer: time until the backend receipt/response, including network round trip and validation (not a pure wire-transfer benchmark).
- cloudinary_response_validation: durationMs measures the completed Cloudinary upload call.
- database_finalized: durationMs measures database finalization and any duplicate-asset cleanup.
- client_upload_complete: total client elapsedMs including async polling.

Real after-change measurements are pending physical-device testing. Mock encoding sizes are regression fixtures, not compression or network benchmarks.

## Private evidence failures

Server logs include requestId, incidentId, stage, safe code, HTTP status, upstream status if received, and elapsedMs only. Raw provider headers/messages, media URLs, tickets, credentials and file contents are never logged. Provider error hints are classified into fixed codes without exposing their contents.

| Code | Meaning / next check |
| --- | --- |
| MEDIA_ACCESS_EXPIRED | Renew access; sign in again if the session expired. |
| MEDIA_ACCESS_INVALID | Invalid ticket/signature; request a new access ticket. |
| MEDIA_PROVIDER_UNAUTHORIZED | Cloudinary returned 401. Administrator checks configuration. |
| MEDIA_PROVIDER_FORBIDDEN | Cloudinary returned 403. Administrator checks authenticated asset/delivery permissions. |
| MEDIA_PROVIDER_SIGNATURE_INVALID | Provider explicitly reported an invalid signature. |
| MEDIA_PROVIDER_DELIVERY_RESTRICTED | Provider explicitly reported restricted delivery. |
| MEDIA_PROVIDER_NOT_FOUND | Cloudinary returned 404; check stored asset identity/type/format. |
| MEDIA_PROVIDER_REDIRECT | Provider redirected. Redirect is deliberately not followed or exposed; investigate the response before relaxing any policy. |
| MEDIA_NETWORK_FAILED | Server fetch failed before a usable response. |
| MEDIA_READ_TIMEOUT | Server fetch/stream exceeded the 60-second read window. |
| MEDIA_STREAM_FAILED | Headers were received but byte streaming failed. |

Invalid/expired tickets remain distinct from Cloudinary responses. Missing ticket-signing configuration retains its storage/access-unavailable error rather than being mislabeled as expired access. Revoked users, wrong incident scope and unauthorized managers remain blocked before provider access. No public delivery or unsigned upload is enabled. Existing mobile Retry private media requests fresh authorized access.

## Physical iPhone retest

1. Restart backend and Expo; reopen the app. A custom development build must be rebuilt for the added Expo native module; use an Expo Go runtime compatible with SDK 57 where available.
2. On an eligible existing incident, select Optimized before choosing a large JPEG. Check the preview, resulting MB size and optimized label. Upload only with explicit test authorization; compare the safe timings above to the original observations.
3. Test a small PNG, HEIC if supported, multiple photos, and Original mode. Confirm originals remain available and videos behave as before. For metadata-critical evidence, use Original.
4. Interrupt the network, restore it, and retry against the same saved incident. Confirm successful items are not re-uploaded and failed selections remain. Do not recreate the incident.
5. Open a private photo and video as their owner and an authorized Park Manager. Use Retry private media after a failure or expired access. Unauthorized users must remain blocked.
6. If private display fails, provide only the backend JSON diagnostic containing requestId, stage, code, httpStatus, upstreamStatus and elapsedMs from that attempt. Do not share the request URL/ticket, provider headers, auth token or environment variables. That log is required to determine the real account/asset failure safely.

No schema, migration, environment, production records, review workflow, patrol lifecycle, GPS, ORS, RiskZone or Park Manager UI changes are included.

## Changed files

- backend/src/controllers/incidentEvidence.controller.js — provider/stream error classification and upload timing forwarding.
- backend/src/middleware/evidenceDiagnostics.middleware.js — safe stage duration measurements.
- backend/src/services/incidentEvidence.service.js — Cloudinary/database timings and distinct ticket validation errors.
- backend/tests/integration/incidentEvidence.api.test.js — private-read error/retry and logging regressions.
- backend/tests/unit/incident/incidentEvidence.service.test.js — invalid ticket versus missing signing configuration.
- mobile/package.json and mobile/package-lock.json — Expo-compatible expo-image-manipulator ~57.0.21.
- mobile/src/utils/incidentEvidence.js — optional photo preparation and stable native/web payload ownership.
- mobile/src/services/incidentEvidenceApi.js — multipart receipt and overall upload timings.
- mobile/src/components/incident/PhotoUploadMode.js — reusable explicit quality selection and metadata warning.
- mobile/src/components/incident/EvidenceDraft.js — form selection quality integration.
- mobile/src/screens/incident/IncidentEvidenceScreen.js — later Add Evidence quality integration.
- mobile/tests/foundation/incidentEvidencePreparation.test.js — photo, HEIC, web Blob and retry regressions.
- mobile/tests/foundation/photoUploadMode.test.js — quality selection and busy-state tests.
- mobile/tests/setup.js — removes a conflicting duplicate virtual WebView mock that prevented full regression tests from loading.
- docs/api/INCIDENT_EVIDENCE_PERFORMANCE.md — findings and controlled device retest instructions.

## Verification results

- Backend full regression: 29 suites / 557 tests passed. After the final ticket configuration adjustment and its additional regressions, both affected evidence suites were rerun: 38 tests passed.
- Mobile full regression: 37 suites / 367 tests passed.
- Prisma schema validation passed; no migration or database mutation commands were run.
- Android Hermes export and Expo Web export passed for the final application code. Outputs are under ignored mobile/dist/evidence-android and mobile/dist/evidence-web.
- Park Manager web production build passed; existing >500 kB chunk-size warning remains.
- Park Manager web tests: 18 suites / 163 tests passed with one worker. Initial concurrent tests/exports produced two 5-second test timeouts; the serial rerun passed without application changes. Existing React act() warnings remain in unrelated polling tests.
- git diff --check passed. Git reports normal working-copy LF/CRLF notices outside migration files.
- No test media were uploaded to Cloudinary. Physical iPhone codec/display tests and real after-change transfer measurements remain pending.
