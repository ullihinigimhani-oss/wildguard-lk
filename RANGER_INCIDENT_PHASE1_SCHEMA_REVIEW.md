# Ranger incident Phase 1: schema review and approval gate

Branch: feature/ranger-patrol-incident-management.

Implementation is paused before schema or application changes because the task explicitly requires approval when a migration is needed. Only this review document was added. No migration has been created or applied.

## Existing schema

- Patrol.incidents is Incident[]; Incident.patrolId is a nullable foreign key without a uniqueness constraint. Multiple distinct incidents per patrol are already supported.
- Incident.evidence is IncidentEvidence[]; evidence has its own ID and incidentId foreign key. Multiple evidence records per incident are already supported.
- Incident contains incidentType (String), description, optional latitude/longitude/manualLocation/occurredAt, status, syncStatus, reporterId, parkId, optional patrolId and timestamps.
- IncidentStatus: PENDING, UNDER_REVIEW, RESPONDING, RESOLVED. There is no withdrawal state or timestamp.
- IncidentEvidence contains fileUrl, fileType, optional caption, incidentId and createdAt. There is no binary field, upload source or structured footage metadata field.
- User supplies role, approvalStatus, isActive and park assignment. Patrol supplies assigned rangerId, parkId and lifecycle status including IN_PROGRESS and COMPLETED.
- Incident GPS is separate from PatrolLocation, so no trail schema change is needed.
- CameraTrapImage is currently a simulated image URL record; it does not establish an uploaded-footage storage service.

## Missing fields and smallest proposed additive migration

| Model | Proposed field | Reason |
| --- | --- | --- |
| Incident | title String? | Store and validate the requested incident title independently of description; nullable preserves historical rows without inventing titles. New API requests would require it. |
| Incident | withdrawnAt DateTime? | Soft withdrawal while retaining the incident, review status and evidence; no enum replacement or hard deletion. Existing rows remain null. |
| IncidentEvidence | metadata Json? | Store validated photo/video metadata such as source, original filename, MIME type, byte size, capturedAt and camera-trap identifier without storing binary content. |

Proposed PostgreSQL changes for review only:

```sql
ALTER TABLE "Incident" ADD COLUMN "title" TEXT;
ALTER TABLE "Incident" ADD COLUMN "withdrawnAt" TIMESTAMP(3);
ALTER TABLE "IncidentEvidence" ADD COLUMN "metadata" JSONB;
```

No data backfill, required-column conversion, enum change, relation change or table reset is needed. Keep legacy nullable patrolId/occurredAt/GPS columns; new patrol incident APIs would require valid values. Incident types can remain the existing String with an API allowlist for Poaching / Snare, Illegal Campsite, Wildlife Conflict and Animal Carcass; an IncidentType enum migration is unnecessary.

Approval is requested to prepare these schema additions and an additive migration file. Applying the migration is a separate explicit action; it will not run automatically.

## Existing APIs and storage readiness

The incident route, controller, service, repository, validator and incident test files are empty scaffolds. /api/incidents is not mounted in the current backend app. The Ranger incident screen remains a disabled reporting placeholder. No existing upload implementation or durable object-storage integration was found in backend code/dependencies. Photo/video binaries must live in a real configured storage service; Neon should hold URLs/object metadata only. An uploaded camera-trap video's metadata must not be confused with simulated CameraTrapImage data. A real provider/upload contract remains needed; no URLs or persistent storage will be fabricated.

## Planned API contract after approval (not implemented)

- POST /api/incidents/mine: approved active assigned Ranger creates an incident for an IN_PROGRESS patrol.
- GET /api/incidents/mine: list authenticated Ranger's incidents, optionally filtered by patrol.
- GET /api/incidents/mine/:id: owner-only read, including evidence and retained completed-patrol history.
- PATCH /api/incidents/mine/:id: owner-only editing during IN_PROGRESS and while PENDING, excluding withdrawn incidents.
- POST /api/incidents/mine/:id/withdraw: soft withdrawal under the same lifecycle/review restrictions.
- GET /api/incidents and GET /api/incidents/:id: approved Park Manager reads with safe patrol, reporter/Ranger, park, incident and evidence projections for future manager UI.

Reuse existing authentication/role middleware and incident scaffold layers. Require approved active Ranger identity, current patrol ownership and server-derived park/reporter relationships. Validate title, allowed type, description, occurredAt and finite GPS coordinates. Evidence payloads must be bounded metadata references to verified stored objects, never arbitrary large binaries or device-local URLs. Manager reads must exclude password hashes and other private account fields.

After COMPLETED, mutation endpoints must reject but read endpoints remain available. UNDER_REVIEW/RESPONDING/RESOLVED incidents must be immutable to Rangers. Soft withdrawal retains evidence/history and must not delete GPS, incidents or patrols.

## Planned concurrency protection (not implemented)

Use a Prisma transaction with a patrol row lock before incident creation/edit/withdrawal, then check IN_PROGRESS and current assignment while the lock is held. Patrol completion updates the same row, serializing completion against incident mutations. Lock/check the incident row after the patrol row and guard ownership, review status and withdrawnAt in the mutation to prevent review/withdrawal races. Consistent lock order and transaction rollback must be covered by tests. No ORS/RiskZone changes are needed.

## Verification and safety

Prisma validation passed against the unchanged current schema. Backend regressions passed: 17 suites, 383 tests. Existing authentication, Ranger ownership, patrol lifecycle and navigation regressions were run; new incident authorization/locking behavior is not yet implemented or tested.

No database connection was used to read or write incident records. No Neon data, schema, migration, seed, environment variable, DATABASE_URL, GPS, ORS, RiskZone, mobile UI or manager UI was changed. Only RANGER_INCIDENT_PHASE1_SCHEMA_REVIEW.md was created.

## Pending work

Phase 1: approved additive schema/migration preparation, incident validators/APIs/authorization/transaction locks, metadata contract and tests. No new incident backend behavior is claimed complete.

Phase 2: mobile report/list/detail/edit/withdraw experience, actual photo/video upload integration, camera-trap footage handling, manager incident review UI and physical-device end-to-end tests. A real media storage provider and verified upload flow must be configured before accepting uploaded evidence.
