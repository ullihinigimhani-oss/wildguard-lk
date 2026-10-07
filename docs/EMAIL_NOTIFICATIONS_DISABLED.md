# Account verification without email notifications

## Files modified

- backend/.env.example
- backend/src/routes/user.routes.js
- backend/src/services/auth.service.js
- backend/src/services/email.service.js
- backend/tests/integration/userApproval.api.test.js
- web/src/pages/Users/Users.jsx
- web/tests/foundation/users.test.jsx
- web/tests/foundation/app.test.jsx
- mobile/tests/foundation/screens.test.js
- docs/USER_ACCESS_WORKFLOW.md
- docs/RANGER_AREA_WORKFLOW.md

Created this report: docs/EMAIL_NOTIFICATIONS_DISABLED.md. Earlier workflow reports are marked as historical with their email sections superseded.

## Current behavior

The approval/rejection route no longer imports or calls the Resend adapter. A successful PATCH /api/users/:id/approval returns success, safe user data and either Account approved successfully. or Account rejected successfully. There is no notification result or email warning. /users displays those success messages and no longer promises an email in the approval dialog.

Resend is retained solely as an isolated, unused adapter in backend/src/services/email.service.js, with its isolated unit tests. It is not required, imported or invoked by any active registration, authentication or verification code. No email is sent even if old email environment values remain configured.

RESEND_API_KEY and EMAIL_FROM are not required for application startup, registration, approval, rejection or login. Their entries were removed from .env.example. No actual .env file or secret was read, changed or exposed.

## Verification and security retained

- RANGER, COMMUNITY_LIAISON and RESEARCHER register as PENDING, cannot login until a manager approves, then login as APPROVED.
- COMMUNITY_USER registers as APPROVED and can login immediately.
- PENDING login returns 403 without a token: Your account is awaiting approval. Your account must be verified before you can access WildGuard LK.
- REJECTED login returns 403 without a token: Your account request was not approved.
- Rejection retains the account and rejection reason. Only authenticated, active, APPROVED PARK_MANAGER actors may review allowed PENDING staff accounts. Repeated transitions remain prohibited.
- Ranger requested/confirmed park selection and assignment validation remain intact. Public PARK_MANAGER registration remains rejected.
- No schema/database migration or account mutation was needed. Existing Park Managers, profile-photo previews, onboarding, logout, deep links, role navigation, Expo Go/Web code and API base URLs remain.

## Tests

Backend: 96 tests passed in five suites. These include approval and rejection with both absent and present email configuration, assertions that neither the unused adapter nor outbound fetch is called, registration/login without email configuration, three staff approval flows, rejection messages/reasons, community immediate login, current manager login, authorization and Ranger area validation.

Web: 56 tests passed in seven suites, including approval/rejection success without notification fields, exact rejected login message, pending login denial, registration, photos, Ranger selection, manager /users and access restrictions.

Mobile: 70 tests passed in eleven suites, including exact pending/rejected messages, sessions, registration, photos, Ranger areas, onboarding, role routes and logout.

Git diff whitespace check passed. Tests use isolated API/database mocks; no live applicant accounts were reviewed and no live emails were sent.

## Setup

No email provider setup is required. Reload/restart the backend and web client to use the changed approval route and messages. Existing unrelated permanent photo storage setup remains outside this change; profile-photo selection remains a preview.
