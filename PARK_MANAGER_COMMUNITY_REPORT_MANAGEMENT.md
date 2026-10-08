# Park Manager — Community Report Management

Phase 4 deliverable. The Park Manager opens a community-submitted report, reads everything the
community user stored (or had stored for them as an anonymous reporter), and moves the report through
a four-status review lifecycle. The status is validated against a transition matrix, authorized and
persisted by the backend, and rendered on dedicated web screens. No Community User reporting flow was
added, the `CommunityReport` model was reused (not duplicated), and no other member's component was
modified.

---

## 1. Files created

**Backend**

| File | Purpose |
| --- | --- |
| `backend/prisma/migrations/20261008120000_community_report_status_review/` | Recreates the `CommunityReportStatus` enum with exactly the four review statuses and remaps legacy rows (see section 5). |
| `backend/src/validators/communityReport.validator.js` | *(see section 2 — this file was extended, not created)* |

**Web**

| File | Purpose |
| --- | --- |
| `web/src/pages/CommunityReports/CommunityReports.jsx` | Park Manager list screen: query-driven search, status / type / date-range filters, results table with badges, pagination, refresh. |
| `web/src/pages/CommunityReports/CommunityReportDetailsPage.jsx` | Gated details route wrapper with back link and an authorized-only call to the detail API. |
| `web/src/pages/CommunityReports/communityReportNavigation.js` | `readFilters` / `requestFilters` (local dates become `+05:30` absolute ISO bounds), `pageNumber` clamp, `useCommunityReportQuery` list hook. |
| `web/src/pages/CommunityReports/CommunityReportControls.jsx` | `QueryState` guard, `Pagination`, and the filter bar (`CommunityReportFilters`). |
| `web/src/pages/CommunityReports/CommunityReports.css` | Additive styles for the list and details screens. |
| `web/src/components/community/CommunityReportDetails.jsx` | Full read surface: reference, type, species, status badge, anonymity, description, location (manual + coordinates), reporter facts, evidence items (composed media URLs), timestamps. |
| `web/src/components/community/CommunityReportStatusForm.jsx` | Park Manager status control: `<select>` with the current status (disabled) plus the **valid transitions only**, an explicit **Update Status** button (per the phase-4 spec), in-flight disable, success/`role="alert"` error feedback, and revert to the stored value when a save is rejected. |
| `web/tests/foundation/communityReportApi.test.jsx` | 8 API tests: envelope validation, outbound param sanitisation, `mediaUrl` composition. |
| `web/tests/integration/communityReportManagement.test.jsx` | 10 integration tests: list render, details navigation, anonymous masking, PARK_MANAGER gating, Update Status button flow, transition options, rejected-save revert. |
| `PARK_MANAGER_COMMUNITY_REPORT_MANAGEMENT.md` | This report. |

## 2. Files modified

**Backend**

| File | Change |
| --- | --- |
| `backend/prisma/schema.prisma` | `CommunityReportStatus` enum is now the four review statuses: `PENDING`, `UNDER_REVIEW`, `VERIFIED`, `REJECTED` (`RESPONSE_IN_PROGRESS` / `RESOLVED` removed). |
| `backend/src/validators/communityReport.validator.js` | `REPORT_STATUSES` is now the four values; added `VALID_TRANSITIONS` (see section 4); added `validateReportStatusUpdate(current, next)` — value must be in `REPORT_STATUSES`, otherwise 400 `errors.status`, and the target must be in `VALID_TRANSITIONS[current]`, otherwise 400 `errors.status` listing the allowed moves; added `isoDate` and `validateListQuery` — validates `status`, `reportType`, `search` (≤ 120), `page` (1–100000), and `from`/`to` (ISO date or date/time, `from > to` rejected as 400 `errors.to`). Exported all of it. |
| `backend/src/services/communityReport.service.js` | `listReportsForLiaison` now runs the query through `validateListQuery` and passes `status`, `reportType`, `search`, `from`, `to`, `page` to the repository (pageSize clamped 1–50, default 20). `escalateReport` no longer writes the retired `RESPONSE_IN_PROGRESS`: a `PENDING` report is walked `PENDING → UNDER_REVIEW → VERIFIED`, any other status is marked `VERIFIED` directly, and an already-`VERIFIED` report is idempotently left `VERIFIED`. |
| `backend/src/repositories/communityReport.repository.js` | `listAllReports` gained `from`/`to` → `where.submittedAt = { gte, lte }`, plus the existing `search` OR-clause over description / species / manualLocation / reporterName. |
| `backend/tests/integration/communityReport.api.test.js` | Extended for the four-status lifecycle: PARK_MANAGER PENDING→UNDER_REVIEW, UNDER_REVIEW→VERIFIED, UNDER_REVIEW→REJECTED, VERIFIED→UNDER_REVIEW correction; direct PENDING→VERIFIED rejected 400 with the update never reaching the repository; arbitrary status 400; invalid-status list filter 400; `from > to` 400; date-range filtering returns only in-range reports; escalate moves reports to `VERIFIED` (both roles), idempotent when already `VERIFIED`; RANGER 403. |
| `backend/tests/integration/communityAnonymous.api.test.js` | Legacy `RESOLVED` expectations rewritten to `VERIFIED` (the terminal confirmed state). |

**Web**

| File | Change |
| --- | --- |
| `web/src/services/communityReportApi.js` | Rewritten from the empty placeholder: `reportTypes`, `reportStatuses`, `reportStatusClass`, `validTransitions` (mirror of the backend matrix), `listCommunityReports(filters, signal)` (whitelists allowed params), `getCommunityReport(id, signal)`, `updateCommunityReportStatus(id, status)`, the three error helpers (`communityReportListError`, `communityReportStatusError`, `communityReportError` — never leak raw client errors), and `mediaUrl(path)` which resolves the backend-served evidence path onto the API origin. |
| `web/src/routes/AppRoutes.jsx` | Added `/community-reports` and `/community-reports/:reportId` inside the `PARK_MANAGER` block (so they are authorized-gated before any data request) and removed the placeholder COMMUNITY_LIAISON route. |
| `web/src/constants/navigation.js` | `community-reports` roles set to `["PARK_MANAGER"]` so only an approved Park Manager sees the entry in the manager sidebar. |
| `web/vite.config.js` | Registered `tests/integration/communityReportManagement.test.jsx` in the explicit `test.include` list (additive only). |

## 3. API surface

The four-status lifecycle rides the **existing** community-report endpoints — no new route was added:

| Endpoint | Auth / roles | Notes for Park Manager review |
| --- | --- | --- |
| `GET /api/community-reports` | `authenticate` + `allowRoles("COMMUNITY_LIAISON","PARK_MANAGER")` + account `APPROVED` | List with `status`, `reportType`, `from`, `to` (ISO or `YYYY-MM-DD`), `search`, `page`, `pageSize` (clamped 1–50). Unknown status/type → 400 `errors.status` / `errors.reportType`, `from>to` → 400 `errors.to`. Returns `{ reports, total, page, pageSize }`. |
| `GET /api/community-reports/:id` | `optionalAuth` (authenticated users only see what their role allows) | Detail used by the manager details screen; staff see reporter facts even on anonymous reports, the `reporterId` – `reporterName`/`reporterPhone`/`reporter` remain masked, nothing else. |
| `PATCH /api/community-reports/:id/status` | `authenticate` + `allowRoles("COMMUNITY_LIAISON","PARK_MANAGER")` + account `APPROVED` | Body `{ "status": "PENDING"|"UNDER_REVIEW"|"VERIFIED"|"REJECTED" }`. Validated against the transition matrix; 400 `errors.status` otherwise. Returns the full sanitized report. |
| `POST /api/community-reports/:id/escalate` | same staff roles | Escalation now targets `VERIFIED` (the retired `RESPONSE_IN_PROGRESS` is gone). Returns `{ report, escalation }` operational payload. |

Errors follow the repo-wide conventions: `400` validation with `errors.<field>` · `401` anonymous · `403`
non-staff or unapproved · `404` unknown report. Community User submission/own-report endpoints are
untouched.

## 4. Community report review workflow

Four statuses — the same vocabulary end to end (`CommunityReportStatus` in the schema =
`REPORT_STATUSES` in the validator = `reportStatuses`/`reportStatusClass` in the web app = the badge
classes):

```
PENDING ─► UNDER_REVIEW ─► VERIFIED
   │             │
   │             └────────► REJECTED
   └──► VERIFIED (direct)
   └──► REJECTED (direct)
```

| Status | Badge class | Meaning |
| --- | --- | --- |
| `PENDING` | `badge-pending` | Submitted, not yet reviewed |
| `UNDER_REVIEW` | `badge-under-review` | A manager/liaison is assessing it |
| `VERIFIED` | `badge-verified` | Confirmed as a real event |
| `REJECTED` | `badge-rejected` | Assessed as not a real / actionable event |

**Transition matrix** (validated on the server; duplicated in the web app only to avoid offering
impossible moves):

```js
PENDING:     ["UNDER_REVIEW", "VERIFIED", "REJECTED"]
UNDER_REVIEW:["VERIFIED", "REJECTED"]
VERIFIED:    ["UNDER_REVIEW"]      // correction path
REJECTED:    ["UNDER_REVIEW"]      // reopen/correction path
```

* **A fresh `PENDING` report can be verified in one step** (or reviewed, or rejected) — the Park
  Manager does not have to move through `UNDER_REVIEW` first.
* Mistakes are corrected by returning to `UNDER_REVIEW` before acting again; terminal states cannot
  jump at each other (`VERIFIED → REJECTED` and `REJECTED → VERIFIED` are refused).
* **The UI uses an explicit Update Status button** (per the phase-4 spec, intentionally different from
  the phase-3 incident dropdown that saves on selection). The select shows the current status (disabled)
  plus only the valid next states; the button is disabled while unchanged or in flight; a rejected save
  reverts the select to the stored value and renders the server's `errors.status` in a `role="alert"`.
* The community user's own report stays `PENDING` until staff act; their existing
  "My Reports" flow still reads `status` and renders it (a `VERIFIED` value renders as the four-status
  badge label on the web side).
* A status change writes only `status` + `updatedAt`. Report content, reporter and evidence are never
  rewritten; ownership is never transferred.

## 5. Database changes

Migration `backend/prisma/migrations/20261008120000_community_report_status_review` (applied via
`npx prisma migrate deploy`, then verified):

* `CommunityReportStatus` is recreated with exactly `PENDING`, `UNDER_REVIEW`, `VERIFIED`, `REJECTED`
  (Postgres cannot drop enum values, so the type is renamed → recreated → rows converted → old type
  dropped; the default and any dependent columns keep `PENDING`).
* Existing rows are remapped, never lost: `RESPONSE_IN_PROGRESS → UNDER_REVIEW`, `RESOLVED → VERIFIED`.
* Verified afterwards: `npx prisma migrate status` up to date, the enum is the four values,
  and the migrated `CommunityReport` row set is intact (`PENDING` rows unchanged, legacy rows converted).
* Nothing else changed: `IncidentStatus`, `AlertStatus` and the other team enums were not touched, and
  no column / index / model was added.

## 6. Frontend screens

| Route | Screen | Review surface |
| --- | --- | --- |
| `/community-reports` | `CommunityReports` | Filter bar (status, type, From/To dates, free-text search), results table (type, species, submitted, location, status badge, View link), pagination, refresh, `QueryState` loading/error/empty states. |
| `/community-reports/:reportId` | `CommunityReportDetailsPage` → `CommunityReportDetails` + `CommunityReportStatusForm` | Everything the community user stored: reference, report type, species, status badge, anonymity, description, manual location + coordinates, reporter name/phone (or "Anonymous"), evidence items (image/video) via composed media URLs, submitted/created/updated times; then the status control with its Update Status button. |

Both routes sit inside the `PARK_MANAGER` route block, so `role === "PARK_MANAGER" &&
approvalStatus === "APPROVED"` is checked before any request is made; any other role sees the
authorization message. Sidebar entry only renders for `PARK_MANAGER`.

## 7. Testing instructions

```bash
# Backend — 3 community suites / 59 tests, all green
cd backend && npx jest tests/integration/communityReport.api.test.js tests/integration/communityAnonymous.api.test.js tests/integration/evidenceUpload.api.test.js

# Web — 2 new files / 18 tests (8 foundation + 10 integration), all green
cd web && npx vitest run tests/foundation/communityReportApi.test.jsx tests/integration/communityReportManagement.test.jsx

# Full regression context
cd backend && npx jest            # 29 suites / 604 tests
cd web && npx vitest run && npx vite build   # 21 files / 192 tests; build OK
```

Experimental up-to-date baselines: the same 26 web failures (login/app route `ZoneAlertProvider`
wiring, `managerIncidentApi` `/incidents/ranger` expectation, one flaky `rangerTracking` case) and the
same 2 incident suites fail **with and without** these Phase-4 changes (verified by stashing). They are
pre-existing drift on this branch: `backend/src/validators/incident.validator.js:7` still lists the six
legacy incident statuses (`RESPONDING` / `RESOLVED`) while the incident migration on this branch already
recreated the DB enum to four values, and the mobile/login web tests reference components that changed
since the branch was cut. They are outside this phase's scope and are listed for those teams in
section 8.

Manual check:

1. Start the API (`cd backend && npm run dev`) and web app (`cd web && npm run dev`).
2. Sign in as an approved **Park Manager** → Community Reports appears in the sidebar.
3. Use the filter bar (status, type, dates, search) and pagination; open a report via View.
4. On the details screen confirm every stored field is present (anonymous reports show "Anonymous",
   staff still see report facts and evidence).
5. Open "Update report status": pick a valid transition and press **Update Status**; confirm the badge
   and label change, the button disables while saving, a refresh keeps the value, and an impossible
   move (e.g. direct PENDING→VERIFIED) is rejected with the server's message and the select reverts.
6. Sign in as a **Ranger** → `/community-reports` shows the authorization message;
   `PATCH /api/community-reports/:id/status` returns 403.
7. curl example: `curl -X PATCH http://localhost:5000/api/community-reports/<id>/status
   -H "Authorization: Bearer <manager token>" -H "Content-Type: application/json"
   -d '{"status":"VERIFIED"}'`

**Completion checklist (12 items)**

| # | Requirement — verifiable behaviour | Covered by |
| --- | --- | --- |
| 1 | `CommunityReportStatus` offers exactly `PENDING`, `UNDER_REVIEW`, `VERIFIED`, `REJECTED` in schema, validator and web app | schema / validator / `communityReportApi.js` / migration |
| 2 | Legacy rows are migrated, not lost (`RESPONSE_IN_PROGRESS→UNDER_REVIEW`, `RESOLVED→VERIFIED`) | migration + `communityAnonymous.api.test.js` |
| 3 | Only approved staff (`COMMUNITY_LIAISON`, `PARK_MANAGER`) can update status; others 403 | route guard + 403 tests |
| 4 | Unknown / empty status value rejected with 400 `errors.status` | validator + tests |
| 5 | Invalid transitions rejected with 400 and the server message shown; valid transitions accepted | matrix + web revert test |
| 6 | Park Manager can list all reports with status/type/date/search filters and page | list API + web list screen + tests |
| 7 | `from > to` rejected as 400; invalid filter values rejected instead of silently empty | `validateListQuery` + tests |
| 8 | Details screen shows every stored field, masks anonymous reporters, renders evidence | `CommunityReportDetails` + integration test |
| 9 | Status change persists in the DB (`updatedAt` changes, content untouched) | service/repository + tests |
| 10 | A fresh `PENDING` report can be verified directly in one step; corrections return to `UNDER_REVIEW` | matrix + PENDING→VERIFIED test |
| 11 | Both managers and liaison can correct a decision (`VERIFIED→UNDER_REVIEW`, `REJECTED→UNDER_REVIEW`) | matrix + tests |
| 12 | Escalation marks the report `VERIFIED` (idempotent) with an operational integration payload | service + escalate tests |

## 8. Integration assumptions / Community Liaison component changes

* **The Community User flow was not touched.** `POST /api/community-reports`, my-reports, evidence
  attach, and the Community User web/mobile screens are unchanged — functionality starts where the
  community user submits.
* **Status vocabulary must now be shared with the Liaison and community apps.** `CommunityReportStatus`
  (schema) = `REPORT_STATUSES`/`VALID_TRANSITIONS` (validator) = `reportStatuses`/`validTransitions`
  (web) = the four review statuses. Anything still writing/reading the retired `RESPONSE_IN_PROGRESS`
  or `RESOLVED` values will get a 400 from the backend after this migration.
* **Coordination required for existing `COMMUNITY_LIAISON` references** (owning team must reconcile;
  deliberately not touched here):
  * `mobile/src/screens/community/LiaisonReviewScreen.js` — still offers `RESPONSE_IN_PROGRESS`
    ("Operational", lines 30/181) and `RESOLVED` (lines 31/585) as review actions and filters. Both
    values now 400; escalation from that screen should instead land on `VERIFIED`.
  * `mobile/src/screens/community/CommunityHomeScreen.js` (lines 23–24) and
    `mobile/src/screens/community/ReportStatusScreen.js` (lines 23–24, 31–32) — status colour/label
    maps still assume `RESPONSE_IN_PROGRESS`/`RESOLVED`; `VERIFIED`, `REJECTED` and the correct
    transition options are missing, so those screens will show the new values as fallback styling.
  * `backend/src/validators/incident.validator.js:7` — incident statuses are still the six legacy
    values while this branch's DB enum is the four review values; the incident owner's phase-3 fix
    (four values + updated incident unit/api tests) is not present on this branch and is the cause of
    the pre-existing incident test failures listed in section 7.
  * Unrelated `RESOLVED` references in `alert.service.js` / `alert.repository.js` and the mobile alert
    screens are the **Alert** lifecycle and were intentionally left alone.
* **Shared files touched are additive-only**: `web/vite.config.js` (one explicit test path) and
  `web/src/styles.css` (not modified — the four badge classes already exist and are reused). No other
  member component was edited.