# Park Manager — Conservation / Operational Analytics

Phase 6A deliverable. The Park Manager opens **Conservation & Operational Analytics** from the sidebar
and sees live operational summaries computed **from the real database** (no permanent mock statistics):
patrol coverage, ranger-incident workload and community/conflict signals, each with a trend line,
breakdown charts and entity-specific filters, all behind `role === "PARK_MANAGER" && APPROVED`.
Aggregation happens on the backend from the existing `Patrol`, `Incident` and `CommunityReport` rows;
the web app renders hand-rolled, dependency-free SVG/CSS charts with an explicit loading / empty /
error state for every visualization.

---

## 1. Files created

**Backend**

| File | Purpose |
| --- | --- |
| `backend/src/validators/analytics.validator.js` | Context-aware query validation: `period` (`day`/`week`/`month`, default `month`), `from`/`to` (ISO datetime or calendar date), `area` (≤ 200 chars), and per-entity whitelists passed in a context object. `validateAnalyticsQuery(query, { types, statuses, priorities, allowType, allowStatus, allowPriority })` rejects unknown values with 400 `errors.<field>`; the KPI endpoint passes an empty context so only `from`/`to`/`area` are accepted. |
| `backend/src/repositories/analytics.repository.js` | Read-only `findMany` projections per entity with only the aggregate columns needed (see section 4 — reporter identity/contact/description/evidence are never selected). |
| `backend/src/services/analytics.service.js` | All aggregation: `kpis`, `incidents`, `patrols`, `communityReports` plus exported `_internal` bucket helpers for unit testing. |
| `backend/tests/unit/analytics/analytics.validator.test.js` | 11 validator tests (defaults, per-entity accepts/rejects, `period` values, dates, area length, priority gating). |
| `backend/tests/unit/analytics/analytics.service.test.js` | 15 tests (see section 4) verifying aggregation against a known, in-memory record set. |
| `backend/tests/unit/analytics/analytics.repository.test.js` | 3 tests pinning the `select` projections (privacy: no reporter fields / evidence / description). |
| `backend/tests/integration/analytics.api.test.js` | 11 integration tests (auth guards incl. manager token vs ranger/non-manager roles, KPI shape, per-entity shapes, filter passthrough, 400s, park scoping, empty datasets). |

**Web**

| File | Purpose |
| --- | --- |
| `web/src/services/analyticsApi.js` | `periods` + label maps for every incident/patrol/report status, type and priority; `kpis` / `incidentAnalytics` / `patrolAnalytics` / `communityAnalytics` fetchers (each whitelisating its supported params and rejecting malformed envelopes); `analyticsError` mapper (field errors → message → status guidance, never raw client errors). |
| `web/src/pages/Analytics/analyticsNavigation.js` | `filterKeys` / `readFilters` / `requestFilters` (calendar dates become `+05:30` absolute ISO bounds, mirroring the Community Reports convention), `requestFilters(filters, entity)` mapping UI filter names to API params, and one shared `useAnalyticsQuery` (authorization gate, `AbortController`, JSON-keyed refetch, `from > to` guarded client-side) wrapping the four entity hooks. |
| `web/src/pages/Dashboard/DashboardAnalytics.jsx` | The analytics dashboard now embedded on the Park Manager's `/dashboard` home (metric strip, filter bar, three panels), driven by the query hooks via the URL search params of `/dashboard`.
| `web/src/pages/Dashboard/Dashboard.css` | Layout/css for the dashboard analytics — panel bodies keep real padding so charts are never flush to the clipped `.panel` edge (fixes the standalone page's cramped look), a dedicated filter bar, 6-card metric grid and responsive chart columns.
| `web/src/components/charts/ChartPanel.jsx` | Panel shell with the four states (loading `role="status"` / error `role="alert"` + Retry / empty-data copy / data) and an optional controls row + count badge; renders charts lazily via a render-prop so components are never touched while data is `null`. |
| `web/src/components/charts/BarChart.jsx` | Dependency-free horizontal CSS bar chart (label, proportional track, count value). |
| `web/src/components/charts/TrendChart.jsx` | Dependency-free SVG line/area chart (`role="img"` + `aria-label`, labelled points, and an accessible `trend-values` list for every point); x-axis labels are thinned to ≤ 8 so they never overlap. |
| `web/tests/foundation/analyticsApi.test.jsx` | 10 tests: per-endpoint param whitelisting (junk dropped, `priority` correctly absent for incidents, `type`/`status`/`priority` present for patrols), envelope rejection (`success`/`data`/object checks), `analyticsError` precedence and status mapping. |
| `web/tests/integration/analyticsDashboard.test.jsx` | 9 tests: authorized rendering of metric cards + trend SVGs + bar values, non-manager gate (nothing fetched), loading state, error + working Retry, empty state, date/timezone conversion and per-entity filter passthrough, panel-filter refetch, `from > to` guard (no network call), metric-card label/value pairing. |
| `PARK_MANAGER_CONSERVATION_ANALYTICS.md` | This report. |

## 2. Files modified

| File | Change |
| --- | --- |
| `backend/src/controllers/analytics.controller.js` | Replaced the empty placeholder with the four handlers (`kpis`, `incidents`, `patrols`, `communityReports`) that run `validateAnalyticsQuery` and return `{ success: true, data }` with `Cache-Control: no-store` (aggregations must not be cached stale). |
| `backend/src/routes/analytics.routes.js` | Replaced the empty placeholder: `router.use(authenticate, allowRoles("PARK_MANAGER"))` then the four `GET` handlers. |
| `backend/src/app.js` | Mounted `app.use("/api/analytics", require("./routes/analytics.routes"))` after the community-report routes. |
| `web/src/routes/AppRoutes.jsx` | `/analytics` renders the empty `<Analytics />` placeholder page (restored to its pre-phase state). |
| `web/src/pages/Dashboard/Dashboard.jsx` | Dashboard rewritten: approved Park Managers get the live conservation analytics (metrics + filters + three panels) plus real quick-action links; other roles keep the existing fallback content unchanged. |
| `web/vite.config.js` | Registered `tests/integration/analyticsDashboard.test.jsx` in the explicit `test.include` list (additive only). |
| `web/src/pages/Analytics/Analytics.jsx`, `Analytics.css` | Removed (replaced by the `/analytics → /dashboard` redirect; `analyticsNavigation.js` + chart components are reused from `/pages/Analytics`). |

## 3. API surface

All four endpoints require a logged-in, **approved `PARK_MANAGER`** (any other account → 403; no token →
401). Park scoping: when the token's user carries a `parkId`, patrol and incident queries are constrained
to that park; a manager without a parkId sees whole-tenant aggregates (mirrors how the rest of the manager
UI reads `req.user.parkId`). **Community reports have no park column**, so they are never park-scoped —
the `area` filter still narrows them by `manualLocation` text (uncovered and fixed in this phase).

| Endpoint | Query params | Returns `data` |
| --- | --- | --- |
| `GET /api/analytics/kpis` | `from`, `to`, `area` only | `{ patrols: { total, scheduled, inProgress, completed, cancelled }, incidents: { total }, community: { total, conflictCount } }` |
| `GET /api/analytics/incidents` | `period`, `from`, `to`, `area`, `type` (incident type), `status` (incident status) | `{ period, total, trend, byType, byStatus }` |
| `GET /api/analytics/patrols` | `period`, `from`, `to`, `area`, `type`, `status`, `priority` (patrol-only) | `{ period, total, trend, byStatus, byType, byPriority }` |
| `GET /api/analytics/community-reports` | `period`, `from`, `to`, `area`, `type`, `status` | `{ period, total, conflictCount, trend, byType, byStatus, byArea }` |

`trend` = `[{ bucket, label, count }]`, `by*` = `[{ key, count }]` sorted count-desc then key
alphabetically. Malformed values → `400 { success: false, message: "Please check the analytics
filters.", errors: { <field>: "..." } }`. Example verified live (see section 6).

## 4. Metrics implemented (real data only)

Every number below is aggregated in `analytics.service.js` from the existing tables each request.

* **Patrol KPIs** — `total` with `scheduled` / `inProgress` / `completed` / `cancelled` from
  `Patrol.status`. Patrol dates use the **effective patrol date** `actualStartTime || scheduledDate ||
  createdAt`, and a date/`area` range is bounded in the SQL `where` across all three columns then
  refined in JS so late-started patrols count on the shift they actually ran.
* **Incident KPIs & trends** — `total` (all incidents in the requested scope, so the metric row is
  consistent with the incident panel sum), trend bucketed by `reportedAt`, breakdowns by
  `incidentType` and `status`.
* **Community / conflict data** — trend by `submittedAt`, breakdowns by `reportType`, `status`, and
  **common areas** (`manualLocation`, case-preserving), plus `conflictCount` = reports whose
  `reportType === "HUMAN_WILDLIFE_CONFLICT"`.
* **Period bucketing** — `day` (UTC date labels), `week` (Monday-start, ISO label), `month`
  (`YYYY-MM`). A bounded `from`/`to` range is **zero-filled** so gaps are visible; an unbounded range
  emits only buckets that contain data. The web "empty state" is driven by `total === 0`.
* **Explicitly not implemented — incidents by priority.** The `Incident` model has no priority column,
  so the dashboard offers incident `type`/`status` filters only; `priority` filtering exists solely on
  the patrol panels (where `Patrol.priority` exists). No invented fields were introduced.
* **Privacy** — the repository projections select only aggregate columns
  (`status`,`incidentType`,`reportedAt`,`manualLocation` / patrol `status`,`patrolType`,`priority`,
  `scheduledDate`,`actualStartTime`,`createdAt`,`startLocation` / report
  `status`,`reportType`,`submittedAt`,`manualLocation`). Reporter identity, phone, description and
  evidence are never read by the analytics layer (pinned by `analytics.repository.test.js`).

## 5. Frontend screens

The conservation analytics live on the Dashboard (`/dashboard`). The sidebar keeps its original
"Analytics & Reports" entry (roles unchanged from before this phase) and `/analytics` renders a blank
placeholder page — the tab is back exactly as it was, with no data on it. The analytics section itself
renders only for approved Park Managers (other roles keep the existing fallback content), driven by the
`/dashboard` URL search params:

* **Global filter bar** — From/To dates (Sri Lanka), Granularity (Daily/Weekly/Monthly), Area/location
  free text, Clear filters, and a Refresh button.
* **Metric strip** — six cards: patrols scheduled / in progress / completed, incidents reported,
  community reports, human-wildlife conflicts — each with its own loading, error+Retry state.
* **Incident analytics panel** — trend by selected granularity (SVG), bars by type and by status;
  per-panel filters: incident type, incident status.
* **Patrol analytics panel** — trend, bars by status / type / priority; per-panel filters: type,
  status, priority.
* **Community report analytics panel** — trend, bars by type / status and Common areas; per-panel
  filters: report type, report status. No reporter fields are shown anywhere.

Every panel and metric block independently renders `role="status"` loading, `role="alert"` error with a
Retry button, an empty-data message, or the charts — so no visualization is ever silently blank. Charts
are hand-rolled (SVG + CSS) with **zero new npm dependencies**. Filters live in the URL search params
(`readFilters`/`update`), dates convert to `+05:30` absolute ISO bounds like the rest of the app, and a
reversed `from > to` range is rejected in the browser before any network call. Dashboard CSS gives every
panel body real padding (the shared `.panel` clips overflow and previously left content flush to the
edges), a dedicated filter-bar layout, a responsive 6-card metric grid, and thinned trend labels.

## 6. Testing instructions

```bash
# Seed / clean dashboard demo data (backend/scripts)
cd backend && npm run seed:dummy        # 2 parks, 10 patrols, 14 incidents, 12 reports + risk/wildlife/camera rows
cd backend && npm run seed:dummy:clean  # removes exactly the seeded rows (marker-prefixed, FK-safe order)
# Seeded manager login: seed-dummy-<tag>-manager@wildguard.test / DummyPass-123

# Backend — 4 analytics suites / 44 tests, all green
cd backend && npx jest tests/unit/analytics tests/integration/analytics.api.test.js --runInBand

# Web — 2 new files / 19 tests (10 foundation + 9 integration), all green
cd web && npx vitest run tests/foundation/analyticsApi.test.jsx tests/integration/analyticsDashboard.test.jsx

# Full regression context
cd backend && npx jest         # 35 suites / 671 tests (11 pre-existing incident failures, unchanged)
cd web && npx vitest run && npx vite build   # 26 files / 2 pre-existing failing files (25 failures; two timing-sensitive tests also flake under parallel load); build OK
```

Live smoke against the development Postgres DB (in-process, real data, port 5001):

```
/api/analytics/kpis                          STATUS 200 {"patrols":{"total":2,...},"incidents":{"total":5},"community":{"total":1,"conflictCount":0}}
/api/analytics/incidents                     STATUS 200 {"period":"month","total":5,"trend":[...],"byType":[...],"byStatus":[...]}
/api/analytics/patrols                       STATUS 200 {"period":"month","total":2,"byStatus":[{"key":"IN_PROGRESS","count":2}],...}
/api/analytics/community-reports             STATUS 200 {"period":"month","total":1,...}
/api/analytics/community-reports?area=Yala   STATUS 200 ... total 0   (area scoping works)
/api/analytics/incidents?period=hour         STATUS 400 {"errors":{"period":"Select a valid period."}}
/api/analytics/kpis (no token)               STATUS 401
```

**Completion checklist**

| # | Requirement — verifiable behaviour | Covered by |
| --- | --- | --- |
| 1 | Dashboard computes totals/scheduled/in-progress/completed patrols from real DB rows | `kpis` service + live smoke |
| 2 | Incidents reported, by status and by type, from `Incident` rows (no priority invention) | incident endpoint/service + docs |
| 3 | Community reports over time, by type/status, common areas, and conflict counts | community endpoint + `conflictCount` |
| 4 | Trends over time (daily/weekly/monthly) returned by the backend API | `period` + `buildTrend` unit tests |
| 5 | Filters: date range, incident type/status, patrol type/status/priority, area | validator + web filter bar + tests |
| 6 | Park scoping when the manager belongs to a park (community reports excluded — no park column) | service `parkId` + tests |
| 7 | No permanent mock statistics — every metric derived from DB at request time | repository/service design + live smoke |
| 8 | Every web visualization has loading / empty / error states | `ChartPanel` states + integration tests |
| 9 | PARK_MANAGER-only access end to end (route, nav, API) | guards + 403/401 tests + nav narrowing |
| 10 | Tests verify aggregation against known record sets and empty ranges | service unit tests + integration tests |

Manual check: `cd backend && npm run dev`, `cd web && npm run dev`, sign in as an approved **Park
Manager** → the Dashboard shows the conservation analytics behind a greeting and quick actions. Watch the
four requests load, then vary dates/granularity/area and each panel's selects and confirm the charts
refetch; pick a narrow date range that matches nothing and confirm every panel shows its empty state;
sign in as a Ranger and confirm the dashboard falls back to the plain overview (and `/api/analytics/*`
still returns 403). Opening the old `/analytics` URL now lands on the dashboard.

## 7. Integration assumptions / coordination notes

* **Incidents have no priority field.** The incident panel deliberately exposes type/status filters
  only. If an incident-priority requirement exists, the `Incident` model needs a priority column first
  (out of scope here).
* **`navigation.js` analytics sidebar entry kept as originally defined** (`["PARK_MANAGER","RANGER",
  "COMMUNITY_LIAISON"]`) and `/analytics` renders an empty placeholder — the tab is intentionally back
  with no data, matching the pre-analysis state. The analytics API still requires PARK_MANAGER only
  (`allowRoles("PARK_MANAGER")`), and the dashboard's analytics section renders only for approved
  managers. If the team wants Rangers/Liaisons on the dashboard later, the controllers' `allowRoles` +
  the front-end `authorized` check must be widened in one coordinated change.
* **Pre-existing branch failures are unchanged and out of scope** (verified before and after this
  phase): the incident suites (11 — `incident.validator.js` six-status drift vs the four-status DB
  enum) and the web login/app wiring + `managerIncidentApi`/`rangerTracking` set (25). They are the
  owning teams' deltas, documented in the phase-4 report.
* **Shared files touched are additive-only**: `backend/src/app.js` (one mount line),
  `web/src/routes/AppRoutes.jsx` (one import + one route + one exclusion token),
  `web/src/constants/navigation.js` (roles for the existing analytics entry), and `web/vite.config.js`
  (one explicit test path). No other member's component was edited; `web/src/styles.css` was not
  touched (all chart/metric styles live in `Analytics.css`).
* The analytics date convention matches the rest of the manager UI (`+05:30` absolute day bounds with
  `T00:00:00` / `T23:59:59.999`), so date filters are interchangeable with the Community Reports list.