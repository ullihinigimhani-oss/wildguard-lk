# Ranger park request and confirmed assignment

> Current behavior: approval/rejection sends no emails and requires no RESEND_API_KEY or EMAIL_FROM. Email-related sections below document the earlier implementation and are superseded by EMAIL_NOTIFICATIONS_DISABLED.md.


Implemented 7 October 2026.

## 1. Files changed

Modified for this extension:

- backend/prisma/schema.prisma
- backend/src/app.js
- backend/src/repositories/auth.repository.js
- backend/src/routes/user.routes.js
- backend/src/services/auth.service.js
- backend/src/services/email.service.js
- backend/src/validators/auth.validator.js
- backend/tests/integration/registration.api.test.js
- backend/tests/integration/userApproval.api.test.js
- backend/tests/unit/auth/email.service.test.js
- mobile/src/screens/auth/RegisterScreen.js
- mobile/src/screens/home/HomeScreen.js
- mobile/src/screens/profile/ProfileScreen.js
- mobile/src/services/authApi.js
- mobile/src/utils/registration.js
- mobile/tests/foundation/registrationPhoto.test.js
- web/src/pages/Profile/Profile.jsx
- web/src/pages/Register/Register.jsx
- web/src/pages/Users/Users.jsx
- web/src/services/authApi.js
- web/src/services/userApi.js
- web/src/styles.css
- web/src/utils/registration.js
- web/tests/foundation/roleSelection.test.jsx
- web/tests/foundation/users.test.jsx

Created:

- backend/prisma/migrations/20261007000200_requested_park/migration.sql
- backend/src/routes/park.routes.js
- docs/RANGER_AREA_WORKFLOW.md
- mobile/src/components/common/ParkSelect.js
- mobile/src/services/parkApi.js
- mobile/tests/foundation/rangerArea.test.js
- web/src/components/common/ParkSelect.jsx
- web/src/services/parkApi.js
- web/tests/foundation/rangerArea.test.jsx

## 2. Schema and deployment

Migration 20261007000200_requested_park was created and applied successfully to the configured Neon database. It adds nullable User.requestedParkId, its index and a foreign key to the existing Park table (ON DELETE SET NULL). Prisma schema validation and client generation passed.

Existing User.parkId and its foreign key are reused for the confirmed assignment. Prisma relation names distinguish AssignedPark and RequestedPark; no duplicate area table, park records, role enum changes or reassignment of existing users. Read-only verification found one existing Park record and two active approved Park Managers after migration. Connection settings and actual .env files are unchanged.

## 3. Existing park source

The existing Park model/table is the sole source of choices. New public GET /api/parks selects only id/name and sorts by name/id. Both registration clients and the manager confirmation control use it. No frontend park list or duplicate seeds were introduced. If the table is empty or the request fails, controls show an honest empty/error state and retry, rather than inventing choices.

## 4. Requested field

User.requestedParkId -> Park.id, exposed as requestedParkId and requestedPark {id,name}. Only RANGER public registration accepts this claim; other roles cannot create a park relationship by submitting Ranger fields. Existing pending Rangers may have no requested park; their manager must choose a confirmed park explicitly.

## 5. Confirmed field

Existing User.parkId -> Park.id, exposed as parkId and park {id,name}. Public registration ignores assigned/confirmed fields, and backend-created Rangers remain PENDING with no assignment. A manager-approved park is the assignment used in authenticated Ranger profiles, field Home and approval email. The requested ID remains for comparison/audit. Rejection creates no assignment and clears any pending Ranger parkId.

## 6. Registration API

POST /api/auth/register requires requestedParkId for RANGER. Syntactic validation and a real Park lookup occur before account creation; missing, non-string and nonexistent IDs return 400 with errors.requestedParkId. Client approvalStatus and parkId cannot promote/assign the account. RANGER stays PENDING until verified. COMMUNITY_LIAISON and RESEARCHER remain PENDING; COMMUNITY_USER remains automatically APPROVED. Public PARK_MANAGER remains rejected.

## 7. Approval API

PATCH /api/users/:id/approval retains status/reason and accepts parkId as the manager-confirmed assignment when approving a Ranger. This is required and must match a real Park. Both parkId and APPROVED are saved in the existing transaction with an atomic PENDING condition. The actor must be active, authenticated and APPROVED PARK_MANAGER; target role/status restrictions remain. Invalid area gives 400 with no update or notification. Repeated review gives 409. Non-Ranger review does not require or save a Ranger area.

GET /api/users and /api/users/pending include safe requested/assigned park IDs and names. POST /api/auth/login and GET /api/auth/me include the confirmed assignment and continue blocking pending/rejected accounts. Future patrol/incident/map services can use the verified session user's parkId for scope; unrelated application filtering was not added.

## 8. Frontend and email

Both existing registration forms show a required Park / Ranger Area control only for RANGER, with the requested helper text. Desktop/Expo Web uses searchable park filtering plus a native select; React Native uses an accessible expandable searchable choice list within the existing scrolling screen. Existing role cards, terms/password validation, optional photo selection and role changes remain.

/users shows the requested park for Rangers in the listing and details dialog. The Ranger approval dialog preselects requestedParkId and provides Confirmed Park / Ranger Area; managers can keep it or choose another valid park. Legacy requests without a park require a selection. Other roles see no irrelevant area control. Both lists refresh after approval/rejection.

Ranger mobile Home and mobile/desktop profiles display confirmed park.name. Approved Ranger email includes Assigned Park / Ranger Area using the confirmed name, never internal IDs or the unverified request. Liaison/Researcher emails and rejection content/reasons remain unchanged. Existing Resend failure isolation remains; live delivery is not claimed because provider setup is unchanged/unconfigured.

## 9. Verification

- Backend: 90 passing tests across five suites. Includes required/invalid/manually submitted park IDs, ignored assignment/status injection, non-Ranger field isolation, pending login denial, manager keeping/changing requested area, confirmed assignment in login/me, rejection without assignment, safe Park endpoint, confirmed-name email, manager login/access, unauthorized callers and repeated reviews.
- Web: 55 passing tests across seven suites. Includes Ranger field and blocked missing-area submission, valid selected ID submission, absence for all three other public roles, requested name/preselection, changing confirmed park, and legacy missing-request confirmation; previous registration, photo, login, manager layout and approval/rejection tests pass.
- Mobile: 68 passing tests across eleven suites. Includes searchable park selection and required submission, field absence for other roles, plus existing photo, authentication, onboarding, deep-link and logout tests.
- Desktop production build passed. Expo iOS/Android/Web export passed with --no-bytecode. Physical Expo Go devices were not exercised; no live applicant accounts were created/reviewed during tests. API workflow tests use isolated database mocks; schema deployment and read-only source/account counts use the actual configured Neon database.
- Git diff whitespace check passed.

## 10. Manual setup

No new dependency, API base URL or environment variable is required. Restart/reload the backend and clients to use the regenerated Prisma client and updated code. Park choices already exist; additional valid parks should be maintained administratively in the existing Park table, not in frontend lists. Managers must select a confirmed park for older pending Ranger accounts without a requested park.

Existing optional provider limitations remain: configure RESEND_API_KEY/EMAIL_FROM and a verified sender for live emails; permanent profile photo upload storage is still unconfigured and previews remain unsaved. This extension adds no fake persistence or delivery claims. Park Manager accounts remain internally provisioned; their public registration is prohibited.
