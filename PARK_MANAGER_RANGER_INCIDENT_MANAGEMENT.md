# Park Manager — Ranger Incident Management

Phase 3 deliverable. The Park Manager opens a Ranger-submitted incident, reads everything the Ranger
stored, and changes the incident status. The status is validated, authorized and persisted by the
backend. No Ranger reporting form was added, no Incident model was duplicated, and no other member's
component was modified.

---

## 1. Files created

| File | Purpose |
| --- | --- |
| `web/src/components/incident/IncidentStatusForm.jsx` | Shared status control: existing-lifecycle `<select>` that **saves on selection** (no save button), in-progress/success/error feedback, revert to the stored value when a save is rejected, read-only rendering for withdrawn reports. Used both on the details screen (full) and inside the reports table (compact). |
| `backend/prisma/migrations/20261008090000_incident_status_review/` | Recreates the `IncidentStatus` enum with the four review statuses and remaps legacy rows (see section 5). |
| `web/tests/integration/incidentReview.test.jsx` | 11 integration tests for manager review (registered in `web/vite.config.js`). |
| `PARK_MANAGER_RANGER_INCIDENT_MANAGEMENT.md` | This report. |

No backend source file was created; the review flow is built from the existing validator / repository /
service / controller / route pieces.

## 2. Files modified

**Backend**

| File | Change |
| --- | --- |
| `backend/prisma/schema.prisma` | `IncidentStatus` enum is now the four review statuses: `PENDING`, `UNDER_REVIEW`, `VERIFIED`, `REJECTED` (`RESPONDING` / `RESOLVED` removed). |
| `backend/src/validators/incident.validator.js` | `STATUSES` is now `["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED"]`; added `validateStatus(body)` — allows only the `status` key, must be one of `STATUSES`, otherwise throws a `validationError` 400 with `errors.status`. Exported it. |
| `backend/src/repositories/incident.repository.js` | Added `setStatus(id, status)` — `updateMany` guarded by `withdrawnAt: null` inside a `ReadCommitted` transaction, then re-reads the row with `detailSelect`. |
| `backend/src/services/incident.service.js` | Added `updateStatus(id, status, user)` — 404 for unknown/out-of-scope incident, 409 for a withdrawn report, otherwise persists and returns `present(...)`. |
| `backend/src/controllers/incident.controller.js` | Added `updateStatus` controller using the existing `endpoint()` wrapper and `validateStatus`. |
| `backend/src/routes/incident.routes.js` | Added `PATCH /api/incidents/:incidentId/status` with `allowRoles("PARK_MANAGER")`. |
| `backend/tests/integration/incident.api.test.js` | 7 manager-review cases (extended to 561 tests in the suite) rewritten against the four statuses: accepted values, `RESPONDING`/`RESOLVED` now rejected with 400, unknown-field 400, role/ownership 403, withdrawn 409, post-patrol review, persistence. |

**Frontend**

| File | Change |
| --- | --- |
| `web/src/services/incidentApi.js` | `incidentStatuses` labels are now `Pending` / `Under review` / `Verified` / `Rejected`; added `updateIncidentStatus(id, status)` and `statusErrorMessage(error)` (field error → server message → status-code fallback; never the raw client error). |
| `web/src/components/incident/incidentPresentation.jsx` | `statusClass` maps the four statuses to the new badge classes below (withdrawn reports keep `badge-cancelled` → "Withdrawn"). |
| `web/src/styles.css` | Appended the four incident status badge colours (additive only): `.badge-pending` slate `#eef1f4/#4a5a6a` (awaiting review), `.badge-under-review` amber `#f7efdd/#886829` (needs attention), `.badge-verified` green `#e2f0e5/#2f7a4d` (confirmed), `.badge-rejected` red `#f8e8e4/#974836` (declined). |
| `web/src/components/incident/IncidentDetails.jsx` | Replaced the "read-only / manager review actions are not available yet" paragraph with `IncidentStatusForm`; the saved incident is merged into local state so the badge updates immediately. Also now shows `manualLocation`, so every field the Ranger submitted is visible. |
| `web/src/pages/Incidents/IncidentReportsTable.jsx` | Optional `statusEditor` / `onStatusSaved` props render the compact control in the Actions column; the table gains `has-status-editor` when enabled. |
| `web/src/pages/Incidents/PatrolReports.jsx` | Passes `statusEditor onStatusSaved={refresh}` so a save reloads the patrol report list. |
| `web/src/pages/Incidents/Incidents.css` | Appended status-form / actions-column styles (additive only). |
| `web/vite.config.js` | Registered `tests/integration/incidentReview.test.jsx`. |
| `mobile/tests/foundation/incidentApi.test.js` | The "review locks editing" cases now use `UNDER_REVIEW` / `VERIFIED` / `REJECTED` (mobile source unchanged — `canChangeIncident` only checks `status === "PENDING"`). |

## 3. New API endpoints

`PATCH /api/incidents/:incidentId/status`

* Auth: `authenticate` (any signed-in user) + `allowRoles("PARK_MANAGER")` + account `APPROVED`
* Body: `{ "status": "PENDING" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED" }` — nothing else is accepted
  (the retired `RESPONDING` / `RESOLVED` values are answered with 400 `errors.status`)
* Response `200`: `{ "success": true, "incident": { ...full detail shape (reporter, park, patrol, evidence, counts)... } }`
* Errors: `400` validation (unknown key / unsupported value / empty body) · `401` anonymous · `403` non-manager or unapproved · `404` unknown or out-of-scope incident · `409` withdrawn report or concurrent change

Existing endpoints (`GET /api/incidents`, `GET /api/incidents/:incidentId`, `PATCH /api/incidents/:incidentId`,
`POST /api/incidents/:incidentId/withdraw`, evidence access) are unchanged.

## 4. Incident status workflow

Four statuses — the vocabulary the review feature uses end to end (`IncidentStatus` in the schema =
`STATUSES` in the validator = `incidentStatuses` in the web app = the badge classes):

```
PENDING ──► UNDER_REVIEW ──► VERIFIED        (report confirmed)
   │              │
   │              └────────► REJECTED        (report declined)
   └────────────────────────► REJECTED
```

| Status | Badge class | Colour | Meaning |
| --- | --- | --- | --- |
| `PENDING` | `badge-pending` | slate `#eef1f4` / `#4a5a6a` | Submitted by the Ranger, not yet reviewed |
| `UNDER_REVIEW` | `badge-under-review` | amber `#f7efdd` / `#886829` | A Park Manager is assessing it |
| `VERIFIED` | `badge-verified` | green `#e2f0e5` / `#2f7a4d` | Confirmed as a real incident |
| `REJECTED` | `badge-rejected` | red `#f8e8e4` / `#974836` | Assessed as not a real incident |

* **The dropdown saves itself.** There is no "Save status" button: choosing a value in the select fires
  the `PATCH` immediately, the select is disabled while the request is in flight ("Saving…"), a success
  shows `Status saved as …`, and a rejected save reverts the select to the stored value and shows the
  server's reason (`role="alert"`).
* The Ranger's original report stays `PENDING` until a Park Manager acts.
* The manager may move a report in either direction (e.g. `REJECTED` → `VERIFIED`) — validation is
  membership in `STATUSES`, not a transition table, so a correction is always possible.
* Withdrawn reports are locked at `409`; their badge keeps showing `Withdrawn`.
* Ranger edit/withdraw rules are untouched: they still require an `IN_PROGRESS` patrol. Manager review
  has **no** patrol gate, so a report can be reviewed after the patrol has finished (verified live).
* Each save writes `updatedAt`; the reporter, park, patrol, evidence and `withdrawnAt` are never modified.

## 5. Database changes

Migration `backend/prisma/migrations/20261008090000_incident_status_review` (applied and recorded):

* `IncidentStatus` is recreated with exactly `PENDING`, `UNDER_REVIEW`, `VERIFIED`, `REJECTED`
  (Postgres cannot drop enum values, so the type is renamed → recreated → rows converted → old type
  dropped; the `Incident.status` default stays `PENDING` and the status index is rebuilt).
* Existing rows are remapped, never lost: `RESPONDING` → `UNDER_REVIEW`, `RESOLVED` → `VERIFIED`
  (the one legacy `RESOLVED` row in the shared database was converted by this migration).
* Applied with `npx prisma db execute --file …` + `npx prisma migrate resolve --applied
  20261008090000_incident_status_review`, then verified: `npx prisma validate` valid,
  `npx prisma generate` current, `npx prisma migrate status` → "8 migrations found … up to date!".
* Nothing else changed: evidence stays in `IncidentEvidence`, no column, index or model was added, and
  `CommunityReportStatus` / `AlertStatus` (other members' enums) were not touched.
* Note for the team: the shared database also carries a migration record
  `20261008080000_incident_review_fields` that has no folder in this repository (applied elsewhere).
  `migrate status` does not flag it; whoever owns it should commit the folder so a fresh checkout
  replays the same history.

## 6. Frontend routes / screens

No new URL was required; review happens on the two screens the manager already uses:

| Route | Screen | Review surface |
| --- | --- | --- |
| `/incidents/patrol/:patrolId/:incidentId` | `IncidentDetailsPage` → `IncidentDetails` | Full `IncidentStatusForm` under the evidence list: reference, type, Reporting Ranger, Assigned Ranger, patrol, park, occurred/created/updated, landmark description, coordinates + map, description, evidence, current status badge. |
| `/incidents/unassigned/:incidentId` | `IncidentDetailsPage` → `IncidentDetails` | Same form (community/unassigned reports stay readable). |
| `/incidents/patrol/:patrolId` | `PatrolReports` | `IncidentReportsTable` Actions column gets the compact control per row; choosing a value saves it and calls `refresh()` so list and counts reload. |

Both routes remain gated by `role === "PARK_MANAGER" && approvalStatus === "APPROVED"` before any data
request is made. `/incidents` (group list) and the filters are unchanged.

## 7. Testing instructions

```bash
# Backend — 29 suites / 561 tests (7 manager-review cases in incident.api.test.js)
cd backend && npx jest

# Web — 19 files / 174 tests (11 in tests/integration/incidentReview.test.jsx)
cd web && npx vitest run && npx vite build

# Database — schema, migration history and client must all agree
cd backend && npx prisma validate && npx prisma migrate status
```

Manual check:

1. Start the API (`cd backend && npm run dev`) and the web app (`cd web && npm run dev`).
2. Sign in as an approved **Park Manager**.
3. Incidents → open a patrol group → Patrol Incident Reports → **choose a value** in "Status for
   incident …" on a row, or open **View** and pick a value in "Update incident status". Selecting a
   value saves it immediately — there is no save button.
4. Confirm the badge/label changes colour and text (Pending / Under review / Verified / Rejected), the
   message "Status saved as …" appears, the select is disabled while saving, a page refresh keeps the
   value, and a rejected save reverts the select and shows the field error instead of a success message.
5. Sign in as a **Ranger** → the same URLs show "Only approved Park Managers can view incident
   management", and `PATCH /api/incidents/:id/status` returns 403.
6. curl example:
   `curl -X PATCH http://localhost:5000/api/incidents/<id>/status -H "Authorization: Bearer <manager token>" -H "Content-Type: application/json" -d '{"status":"VERIFIED"}'`

Live smoke (real API + real database on port 5001, 20/20 passed): details read 200 · no stray status
sub-resource · anonymous 401 · Ranger 403 · `RESOLVED` 400 with `errors.status` · `RESPONDING` 400 ·
extra field 400 · manager sets `VERIFIED` 200 and it is persisted · manager re-read 200 · manager sets
`REJECTED` 200 and it is persisted · reporting Ranger re-read 200 · `UNDER_REVIEW` accepted · details
still expose reporter/park/evidence · list filter accepts `status=VERIFIED` · list filter rejects
`status=RESOLVED` with 400 · unknown id 404 · unknown id status change 404 · original status restored.

## 8. Integration assumptions / Ranger component changes

* **The Ranger flow was not touched.** `mobile/`, the report-creation validator/service/repository and
  `POST /api/patrols/:patrolId/incidents` are unchanged — functionality starts where the Ranger submits.
* **Status vocabulary is shared with the Ranger app**: `IncidentStatus` (schema) = `STATUSES`
  (validator) = `incidentStatuses` (web labels) = the four review statuses `PENDING`, `UNDER_REVIEW`,
  `VERIFIED`, `REJECTED`. The manager only proposes a value the Ranger's model already understands, so
  a status change is visible to the Ranger's own status screen. Mobile needs no change:
  `canChangeIncident` only checks `status === "PENDING"` and `statusTitle` derives its label from the
  raw value, so `VERIFIED` / `REJECTED` read correctly.
* **Read scope reused**: the manager uses the same `findIncident` / `detailSelect` as the Ranger details
  endpoint, so every field shown is exactly what the Ranger stored (including `manualLocation`, which
  the details screen now renders) — nothing is derived or invented. The model has no priority or
  species field, so none is displayed.
* **Evidence handling reused**: the same private-media path (`evidence[].fileUrl` is nulled and
  `mediaAvailable` gates the viewer) — no copy, no second evidence model.
* **Ownership is not transferred**: reporter, park, patrol and evidence are never written by review,
  and review does not re-assign or delete anything.
* **Concurrency**: status writes are `updateMany` guarded by `withdrawnAt: null` in a transaction, so a
  report withdrawn while the form is open returns 409 instead of silently resurrecting it.
* **Team members' files**: only the shared `Incidents.css` (append-only) and `vite.config.js` (one
  explicit test path) were touched, plus the shared `IncidentReportsTable` via opt-in props that
  default to off, so the "Other / Unassigned" table behaves exactly as before.
* **Existing expectations kept**: the foundation suite still asserts that no `Approve / Reject /
  Withdraw / Edit incident` button exists — the review control is a plain `<select>` with **no button
  of any kind**, so the only actions on screen remain the ones the manager already had.
