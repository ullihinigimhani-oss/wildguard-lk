# Ranger incident backend Phase 2

## Outcome and scope

Implemented incident creation, Ranger patrol-linked listing, shared authorized details, Ranger editing/soft withdrawal, and Park Manager read APIs. The existing incident route/controller/service/repository/validator scaffolds were filled rather than duplicated. No mobile or manager UI changes were made. No schema changes or migrations were needed.

## Existing schema reused

Incident uses title, description, incidentType String, optional occurredAt/GPS/manualLocation, reporterId, parkId, optional patrolId, status, syncStatus, withdrawnAt and timestamps. Patrol.incidents and Incident.evidence already allow multiple records, each with its own generated ID. IncidentEvidence holds references and supplementary JSON metadata, never binaries. The previously applied nullable-field migration is unchanged.

No IncidentType enum exists. API types are explicit validated strings with these exact meanings:

| API value | Category |
| --- | --- |
| POACHING_SNARE | Poaching / Snare |
| ILLEGAL_CAMPSITE | Illegal Campsite |
| WILDLIFE_CONFLICT | Wildlife Conflict |
| ANIMAL_CARCASS | Animal Carcass |

Existing historical type strings and nullable titles are read without rewriting stored records. New submissions use the four codes above. Severity and separate incident notes fields do not exist and are rejected; description and supported manualLocation are available.

## API routes

All paths below include the /api prefix. Existing authentication and approval/role middleware protects every route. Responses use success plus incident or incidents/total/page/pageSize, with Cache-Control: no-store.

| Method and path | Authorization and behavior |
| --- | --- |
| POST /api/patrols/:patrolId/incidents | Assigned approved active Ranger; IN_PROGRESS only; 201 with new incident ID. Each successful submission creates a distinct row. |
| GET /api/patrols/:patrolId/incidents | Current assigned Ranger's own reports, or approved Park Manager; paginated reads including completed-patrol history. |
| GET /api/incidents/:incidentId | Reporting/current assigned Ranger, or approved Park Manager; full details and evidence references. |
| PATCH /api/incidents/:incidentId | Reporting/current assigned Ranger; active linked patrol, PENDING review state and not withdrawn. |
| POST /api/incidents/:incidentId/withdraw | Same mutation restrictions; sets server-generated withdrawnAt and retains record/evidence. |
| GET /api/incidents | Approved Park Manager only; paginated/filterable summaries. |

Manager read access follows the existing global Park Manager patrol-read authorization policy. Ranger queries enforce both reporterId and current patrol assignment. Historical reports with no linked patrol remain readable by their reporter or Manager, but cannot be changed as patrol incidents. Other Rangers/roles cannot read or mutate reports; Manager has no mutation/review endpoint. Private User account fields are excluded through explicit relation selects.

## Request validation and filters

Creation requires title (3–150 trimmed characters), description (3–5000), supported incidentType, occurredAt (valid absolute ISO timestamp with timezone, not in the future), numeric finite latitude [-90,90] and longitude [-180,180]. Optional manualLocation is at most 200 characters. No GPS values are guessed or coerced from strings.

PATCH accepts only title, description, incidentType, occurredAt, paired latitude/longitude and manualLocation. At least one field is required. Client ownership, status, withdrawal timestamps, IDs and other server fields are rejected. Withdrawal accepts an empty body; clients cannot supply timestamps or review fields.

Patrol-list queries: page and includeWithdrawn=true/false. Manager-list queries also support patrolId, rangerId (reporting Ranger), parkId, incidentType, status and from/to absolute ISO occurrence timestamps. Pages contain up to 25 records; sorting uses occurredAt descending/nulls last, then createdAt and id descending. Counts and page reads share a repeatable-read transaction. Withdrawn records are excluded by default; includeWithdrawn=true and authorized details retain audit/history access. List descriptions are truncated to 500 characters; details include the full description. Responses expose evidenceCount, withdrawn and withdrawnAt, patrol title/current assigned Ranger, reporter and park.

## Lifecycle, review and concurrency

Patrol status is the source of truth. SCHEDULED, COMPLETED and CANCELLED reject create/edit/withdraw with HTTP 409. Read access remains available. Only PENDING incidents can be edited/withdrawn; UNDER_REVIEW, RESPONDING and RESOLVED are locked. Repeated withdrawal returns 409 INCIDENT_WITHDRAWN and preserves the original timestamp.

Each mutation runs in a bounded Prisma read-committed transaction. Parameterized SELECT FOR UPDATE locks the assigned Patrol row before status checks and incident writes. The existing completion UPDATE locks the same row: if completion wins, the waiting mutation sees COMPLETED and fails; if incident mutation wins, it commits before completion can update the row. Existing completion code required no change.

Editing/withdrawal then locks the Incident row, rechecks reporter/relationship/review/withdrawal state, and uses a guarded update requiring PENDING and withdrawnAt=null. Lock order is always Patrol then Incident. Failures roll back incident changes. No GPS, waypoint, route, RiskZone, user or park writes occur.

## Evidence readiness and explicit limitation

Existing multiple evidence records are returned through safe projections with IDs, file type, caption, timestamps and bounded supported metadata. HTTPS references have URL query tokens/fragments stripped; URLs containing credentials or unsupported schemes become null. Invalid/unsupported legacy metadata becomes null. Existing stored references are not claimed to be verified uploads; signed links may therefore require a future authorized retrieval flow.

Metadata validation supports source PHONE_CAMERA/GALLERY_UPLOAD/CAMERA_TRAP, originalFileName, mimeType, fileSize, optional capturedAt/cameraTrapId/notes. It enforces a closed property allowlist, 4 KB JSON limit, filename 255 characters, notes 1000 characters, valid timestamps and supported photo/video MIME types. Evidence is bounded to 20 items, with PHOTO/VIDEO matching MIME type and a declared size from 1 byte to 500 MB. Camera-trap footage denotes manual import, not physical device integration.

No durable storage/upload provider exists. No provider was introduced. Creating an incident without evidence succeeds. Any non-empty valid evidence submission returns HTTP 503 EVIDENCE_STORAGE_UNAVAILABLE atomically; no incident or evidence row is created. Arbitrary fileUrl, binary properties, data blobs and unsupported fields are rejected. Upload IDs are validation foundations only and are not trusted or persisted without a real verified upload flow. PATCH does not accept evidence changes. Evidence creation/attachment remains blocked until an approved storage provider and verified upload contract exist.

## Errors and privacy

- 400: invalid fields, unsupported properties, malformed dates/GPS/types/filters/metadata.
- 401/403: existing authentication, active/approval and role failures.
- 404: missing or inaccessible patrol/incident; ownership is not disclosed.
- 409: inactive patrol, reviewed/withdrawn report, legacy unlinked mutation or guarded update conflict.
- 503: evidence storage unavailable.
- 500: generic internal error; database payloads/credentials/stack traces are not returned.

Existing error middleware handles all responses, with a narrow incident-error branch for safe public codes/messages. Existing authentication behavior was preserved.

## Verification and database safety

- Full backend suite: 19 suites, 455 tests passed (72 new incident tests plus 383 existing tests).
- Final incident/validator/patrol API/lifecycle regression run: 4 suites, 135 tests passed.
- Prisma validation: passed against the unchanged schema.
- git diff --check: passed.
- Schema/migration diff: empty. No new dependencies.

Tests cover all four categories, multiple distinct incidents, actual relationships, ownership/reassignment, approval/role restrictions, lifecycle/review locks, strict input allowlists, GPS/time validation, list pagination/history, safe editing/withdrawal, preserved evidence, rollback/conflicts, Manager filters/details, media metadata and safe unavailable-storage behavior. Concurrency tests model row locks and exercise both orderings for completion versus create/edit/withdraw using the real existing completion service. They use isolated Prisma mocks, not production Neon records; no real PostgreSQL concurrency test was performed.

No production database requests/writes occurred during implementation or tests. No schema/migration changes, resets, seeds, environment/DATABASE_URL changes, patrol/incident/evidence deletion, GPS trail writes or TEST RiskZone modifications occurred. ORS, navigation, patrol lifecycle, authentication behavior and UI were preserved.

## Pending work

Mobile: connect the existing Report Incident/list/detail screens to these APIs; provide category/form/GPS validation, multiple-report flows, refresh and read-only states after completion/review/withdrawal. No mobile layout or functionality was changed in this phase.

Evidence: explicitly approve/configure durable object storage, verified upload ownership/MIME/size checks and secure retrieval, then implement attachments without trusting client URLs. Physical phone/browser workflows and isolated real-PostgreSQL lock verification remain to be tested. Manager UI integration and approve/reject workflows were not implemented.

## Files changed

- [backend/src/app.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/backend/src/app.js)
- [backend/src/controllers/incident.controller.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/backend/src/controllers/incident.controller.js)
- [backend/src/middleware/error.middleware.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/backend/src/middleware/error.middleware.js)
- [backend/src/repositories/incident.repository.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/backend/src/repositories/incident.repository.js)
- [backend/src/routes/incident.routes.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/backend/src/routes/incident.routes.js)
- [backend/src/routes/patrol.routes.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/backend/src/routes/patrol.routes.js)
- [backend/src/services/incident.service.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/backend/src/services/incident.service.js)
- [backend/src/validators/incident.validator.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/backend/src/validators/incident.validator.js)
- [backend/tests/integration/incident.api.test.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/backend/tests/integration/incident.api.test.js)
- [backend/tests/unit/incident/incident.validator.test.js](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/backend/tests/unit/incident/incident.validator.test.js)
- [RANGER_INCIDENT_BACKEND_PHASE2.md](C:/Users/Lihini/Desktop/WildGuard%20LK/wildguard-lk/RANGER_INCIDENT_BACKEND_PHASE2.md) — this report.
