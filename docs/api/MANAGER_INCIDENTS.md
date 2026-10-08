# Park Manager incident navigation

## Implementation and teammate preservation

The existing manager incident implementation was inspected before changes. It consisted of the incident table, filters, inline details, shared authentication/API client, fixed Leaflet location preview and private evidence viewer added in the previous phases. No unrelated teammate review workflow was present. This task changes incident navigation only: the existing details implementation was extracted without duplicating its contents; map and private-media components remain unchanged. Existing default page exports, manager styling, authentication and unrelated routes remain intact.

## Routes and behavior

- `/incidents`: one row per patrol with matching report count, patrol name, park, assigned Ranger, real patrol status and latest incident date.
- `/incidents/patrol/:patrolId`: dedicated Patrol Incident Reports page, real patrol header, count and paginated reports belonging only to that patrol.
- `/incidents/patrol/:patrolId/:incidentId`: dedicated details page, with Back to Patrol Reports.
- `/incidents/unassigned/:incidentId`: community/unassigned report details, with Back to Incidents.

The main page keeps Other / Unassigned Incidents in a separate section with reporter, park, status and private-media details access. No fake patrol association is created. Grouped patrols, reports and unassigned records each have appropriate 25-row pagination. Pagination counts distinct patrols on the main table, not individual incident rows. Invalid/out-of-range page values are safely clamped.

Patrol, Ranger, park, incident type/status, Sri Lanka occurrence-date range and withdrawn-history filters are preserved. Search now operates on the complete matching authorized dataset. Filters/search and pagination context remain in URL query parameters and follow View Reports/View/Back links. Counts represent matching reports under the selected filters and search, rather than implying an unfiltered patrol total.

## Accurate counts and existing APIs

No backend API change was required. The adapter sequentially loads every page of the existing authorized `GET /api/incidents` response before rendering grouped totals. It preserves the backend's stable ordering and deduplicates IDs. Backend total/page-size changes or a final distinct-ID count that does not equal the reported total produce an error instead of partial or inaccurate counts. In-flight pagination is cancelled on navigation/filter changes. Loading does not expose partial totals.

Group membership uses the actual patrolId (with the selected patrol relation ID as a fallback), not names. Latest date uses the latest real occurrence timestamp, falling back to report/create time when unavailable. The assigned Ranger comes from the patrol relationship, separately from the reporting person.

Patrol Reports uses the same complete authorized loader with the requested patrolId and inherited supported filters, then paginates the matching reports. `GET /api/patrols/:id` provides a real header even for a patrol with no matching incidents. The page rejects records that do not match the selected patrol. Detail pages likewise validate the incident's patrol relationship against the route; the unassigned route requires an unassigned incident.

Existing API reads only:

- `GET /api/incidents`
- `GET /api/incidents/:incidentId`
- `GET /api/patrols/:patrolId`
- `GET /api/incidents/:incidentId/evidence/:evidenceId/access`
- Existing scoped backend media endpoint with a short-lived ticket.

For very large datasets, sequential complete loading has a latency/memory cost. A future server-side patrol aggregate would improve scalability, but none is needed or added for this integration. The existing backend has per-page snapshots, not a cross-page snapshot; detected pagination changes fail safely and require refresh.

## Details, evidence and security preserved

Details preserve reference/title/type/status, reporting and assigned Ranger, patrol, park, description, occurrence/create/update timestamps, coordinates, fixed Leaflet/OpenStreetMap marker and private photo/video/camera-trap gallery metadata. Leaflet size invalidation remains active. Shared details styles now apply on dedicated pages, including small-screen padding and horizontal table scrolling.

Only approved Park Managers load incident pages; existing manager route guards and backend authentication remain authoritative. Unauthorized, expired session, missing record, loading, empty, retry and refresh states remain supported. No manager review mutation API exists, so review behavior remains read-only. Withdrawn reports stay excluded by default and retain their distinct badge in optional history.

PrivateEvidence is reused unchanged. It obtains authorized short-lived tickets, displays backend-proxied private media, removes expired media and supports fresh-access retry. No permanent Cloudinary URL is rendered or logged. Tokens/tickets are not persisted in navigation context. No new media provider or dependencies were added.

## Files changed in this task

- `web/src/pages/Incidents/Incidents.jsx`
- `web/src/pages/Incidents/Incidents.css`
- `web/src/pages/Incidents/IncidentControls.jsx` (new)
- `web/src/pages/Incidents/IncidentReportsTable.jsx` (new)
- `web/src/pages/Incidents/PatrolReports.jsx` (new)
- `web/src/pages/Incidents/IncidentDetailsPage.jsx` (new)
- `web/src/pages/Incidents/incidentNavigation.js` (new)
- `web/src/components/incident/IncidentDetails.jsx` (extracted)
- `web/src/components/incident/incidentPresentation.jsx` (extracted)
- `web/src/routes/AppRoutes.jsx`
- `web/src/services/incidentApi.js`
- `web/tests/foundation/managerIncidents.test.jsx` (updated for the new navigation)
- `web/tests/foundation/managerIncidentApi.test.jsx`
- `web/tests/foundation/privateIncidentEvidence.test.jsx` (existing media regressions moved here)
- `docs/api/MANAGER_INCIDENTS.md`

The teammate's empty incident review test remains untouched. Coordinate any future manager review action/API work with its owner; no review rules were invented here.

## Verification and safety

Tests mock APIs and media; no production reads/writes or real Cloudinary uploads were performed. Backend, schema, migrations, database, environment variables, Ranger mobile, GPS, lifecycle, ORS, RiskZones and live tracking remain unchanged. No secrets were accessed or exposed.

Final verification: all 163 web tests passed across 18 files, including complete-page counting, deduplication, grouping, navigation/back context, unassigned reports, authorization, map and secure evidence regressions. The production build passed with Vite's JavaScript chunk-size advisory (over 500 kB). `git diff --check` passed. The requested branch was confirmed and `backend/.env` remains Git-ignored.

## Browser handoff checks

Sign in as an approved manager. Verify a patrol with several incidents appears once with its full count, including when its reports span backend pages. Follow View Reports, then View, then both Back links; confirm filters/search and pagination context survive. Open a community incident and private photo/video; check map tiles, playback and access-expiry retry in the deployed browser. Confirm withdrawn history remains opt-in. These real-browser/media checks were not exercised by mocked automated tests.
