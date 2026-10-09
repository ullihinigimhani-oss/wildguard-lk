# WildGuard LK registration and access management

> Current behavior: approval/rejection sends no emails and requires no RESEND_API_KEY or EMAIL_FROM. Email-related sections below document the earlier implementation and are superseded by EMAIL_NOTIFICATIONS_DISABLED.md.


Implemented 7 October 2026. Existing backend, Neon User table, mobile login/navigation, and desktop dashboard are reused.

## 1. Files created

- backend/prisma/migrations/20261007000100_user_approval/migration.sql
- backend/src/routes/user.routes.js
- backend/src/services/email.service.js
- backend/tests/integration/userApproval.api.test.js
- backend/tests/unit/auth/email.service.test.js
- docs/USER_ACCESS_WORKFLOW.md
- mobile/src/components/common/Avatar.js
- mobile/src/components/common/RegistrationPhoto.js
- mobile/src/constants/registrationRoles.js
- mobile/tests/foundation/registrationPhoto.test.js
- web/src/components/common/Avatar.jsx
- web/src/components/common/RegistrationPhoto.jsx
- web/src/constants/roles.js
- web/src/pages/Users/Users.jsx
- web/src/services/userApi.js
- web/tests/foundation/roleSelection.test.jsx
- web/tests/foundation/users.test.jsx

## 2. Files modified

- backend/.env.example
- backend/prisma/schema.prisma
- backend/src/app.js
- backend/src/middleware/error.middleware.js
- backend/src/middleware/role.middleware.js
- backend/src/repositories/auth.repository.js
- backend/src/services/auth.service.js
- backend/src/validators/auth.validator.js
- backend/tests/integration/login.api.test.js
- backend/tests/integration/registration.api.test.js
- mobile/package-lock.json
- mobile/package.json
- mobile/src/hooks/useAuth.js
- mobile/src/navigation/AuthNavigator.js
- mobile/src/screens/auth/LoginScreen.js
- mobile/src/screens/auth/RegisterScreen.js
- mobile/src/screens/home/HomeScreen.js
- mobile/src/screens/profile/ProfileScreen.js
- mobile/src/services/authApi.js
- mobile/tests/foundation/authApi.test.js
- mobile/tests/foundation/registration.test.js
- web/src/components/Navbar/Navbar.jsx
- web/src/hooks/useAuth.jsx
- web/src/pages/Login/Login.jsx
- web/src/pages/Profile/Profile.jsx
- web/src/pages/Register/Register.jsx
- web/src/routes/AppRoutes.jsx
- web/src/routes/ProtectedRoute.jsx
- web/src/services/authApi.js
- web/src/styles.css
- web/tests/foundation/app.test.jsx
- web/tests/foundation/authApi.test.jsx
- web/tests/foundation/landing.test.jsx
- web/tests/foundation/registration.test.jsx

## 3. Database migration

Applied migration 20261007000100_user_approval successfully to the existing configured Neon database. Prisma validation and client generation passed. No connection settings or actual .env files changed. The additive migration preserves every existing account as APPROVED; a read-only verification found two active APPROVED Park Managers and no invalid approval statuses. No test accounts were added to Neon.

Added ApprovalStatus enum (PENDING, APPROVED, REJECTED), nullable rejectionReason, reviewedAt and reviewedById audit fields, and an index on approvalStatus/role/createdAt. No duplicate table or destructive schema changes.

## 4. Exact approval field

User.approvalStatus, type ApprovalStatus, default APPROVED for existing/provisioned records. Public registration explicitly sets COMMUNITY_USER to APPROVED and the three public staff roles to PENDING; PARK_MANAGER requests are rejected; client approval values are ignored. Unknown role values are rejected. Existing roles remain RANGER, PARK_MANAGER, COMMUNITY_LIAISON, RESEARCHER and COMMUNITY_USER.

## 5. Exact image field

User.profileImageUrl, nullable String. Safe authenticated profiles and manager listings include it. Image components display a permanent existing URL or an initial fallback, including a fallback when loading fails. Public registration does not accept arbitrary client image URLs, temporary file URIs or base64 data.

## 6. Registration API

POST /api/auth/register retains name, email, optional phone and password validation/bcrypt hashing. It accepts only RANGER, COMMUNITY_LIAISON, RESEARCHER or COMMUNITY_USER. Public PARK_MANAGER requests return 400 before any account is created. For backward compatibility, omitted role means COMMUNITY_USER. Response safe user includes approvalStatus and profileImageUrl. No session is issued at registration.

Both frontends use role cards before the existing validated form, show Registering as, permit changing the role and support registration with no photo. Staff completion explains pending verification; community completion permits immediate sign-in. Frontend requests do not send approvalStatus or preview photos.

## 7. Login and authentication

POST /api/auth/login verifies password and active account, then requires APPROVED before issuing a token. PENDING and REJECTED return 403 without a token; pending includes the requested approval message. GET /api/auth/me and protected requests re-read the account's role and approval from the database. ACCOUNT_NOT_APPROVED responses clear existing frontend sessions. Normal permission denials do not unnecessarily log users out.

Existing common login, onboarding storage, deep links, Welcome/logout behavior and global Expo Web title/favicon remain. Mobile RANGER uses the existing field Home; other roles retain the existing account screen because dedicated mobile dashboards are not implemented. No new fake dashboards or ADMIN role were added.

## 8. User APIs

- GET /api/users/pending: pending RANGER, COMMUNITY_LIAISON and RESEARCHER only; search by name/email.
- GET /api/users: safe user listing; name/email search; exact role and status filters.
- PATCH /api/users/:id/approval: body status APPROVED or REJECTED, optional reason up to 1,000 characters.

Lists are paginated, 25 per page, with stable ordering, total count and no-store caching. Details are displayed from the safe listing record; passwords, hashes, tokens and active-state internals are never selected for listings.

## 9. Authorization and review rules

Every user-management API requires a verified, active, APPROVED PARK_MANAGER. The frontend also guards /users, while the server remains authoritative. Targets must have one of the three reviewable staff roles and currently be PENDING. An atomic conditional update in a database transaction permits only PENDING to APPROVED/REJECTED; repeated or competing decisions receive 409. PARK_MANAGER and COMMUNITY_USER targets receive 403. Rejection retains the user and reason. Manager ID and review timestamp are recorded.

/users now contains Pending Approvals and All Users below it, with avatars, friendly roles, dates, badges, search/filter controls, pagination, details dialogs and confirmation dialogs. Both lists refresh after review. Existing sidebar/header/layout and routes remain. Notifications are attempted only after the transaction commits; failure cannot undo status.

## 10. Email provider

A backend-only Resend HTTP adapter is implemented; there was no reusable provider in the project. It uses the registered database email address, the requested exact subjects/content and friendly role labels. Rejection omits Reason when absent. Credentials/passwords are not included. Provider success means the email was accepted for submission, not proven inbox delivery.

No live email delivery is claimed or tested: provider credentials/sender are not configured. Missing configuration, provider rejection or network failure produces a response warning; account status stays committed.

## 11. Email environment

Set RESEND_API_KEY and EMAIL_FROM in the backend environment (examples added to backend/.env.example). Verify the sending domain/address in Resend and use an authorized sender such as WildGuard LK <no-reply@your-verified-domain>. Restart the backend after configuring. Never put the provider key in EXPO_PUBLIC_* or VITE_* values. Test actual delivery to a controlled registered address after configuration.

## 12. Photo storage provider

None is configured. Mobile uses Expo-compatible expo-image-picker ~57.0.20; desktop uses a native file input. Both offer circular selection previews, change/remove controls, and an explicit preview-only notice. Photos are not uploaded or saved. iOS/Android permission denial is handled; Expo Web uses the picker without native permission requests.

## 13. Photo environment

No image-provider variables were introduced because no provider is integrated. To enable persistence, select persistent object/image storage, configure its backend credentials/bucket or upload preset, implement an authenticated/validated upload adapter that returns a permanent URL/reference, then save only that verified reference in profileImageUrl. Do not save a temporary Expo URI or raw/base64 image in User.

## 14. Verification

- Backend: 73 tests passed across five suites, including complete mocked registration-to-review/login flows for Ranger, Liaison, Researcher and Community Member; pending/rejected denial; automatic community approval; current manager login; unauthorized direct API access; prohibited targets; invalid/repeated transitions; safe fields; filters/pagination; no-photo registration; email content, configured adapter submission, missing configuration, and failure without rollback.
- Web: 48 tests passed across six suites (47 in the full run plus the subsequently added manager route/layout test, with its suite rerun successfully). Includes role cards, validation, optional photo preview/remove cleanup, common login, pending feedback, manager /users layout, ranger route denial, details/confirmation interactions, rejection reason, email warning, search/filter and failure retry.
- Mobile: 63 tests passed across ten suites; final header change additionally passed startup/screens checks. Covers registration/role selection, picker preview/removal/permission denial, sessions, role routes, deep links, onboarding and logout.
- Prisma schema validation/client generation passed; migration deployed and approved-manager preservation verified read-only in Neon.
- Desktop Vite production build passed. Expo iOS/Android/Web export passed with --no-bytecode; final Expo Web export passed. Physical iPhone/Android devices were not exercised.
- Browser checks: desktop and Expo Web /register display role cards, selected role/form and preview-only notice; title stays WildGuard LK and URL remains /register. At 320x568 the Expo Web form scrolls to the consent, submit and sign-in controls without clipping.
- Expo compatibility check flags the existing expo 57.0.25 patch, recommending ~57.0.27. The new picker matches the expected version. SDK patch update is not included in this feature.
- No real applicants were approved/rejected and no live emails were sent during tests. Database integration workflows use isolated mocks; migration verification uses the actual configured database.
- Persistent photo registration/upload is not tested because storage is unconfigured; this is explicitly unsupported pending setup, rather than represented as working.

## 15. Manual setup and operation

1. Restart/reload existing backend and frontends to use the generated Prisma client and new code. Install mobile dependencies if using another checkout; lockfile includes the picker.
2. Configure the two backend Resend variables and verified sender; test live controlled delivery.
3. Configure persistent image storage and implement trusted upload/save before expecting photos to survive registration or reload. Current UI intentionally says preview only.
4. Have an authorized database administrator provision/manage PARK_MANAGER accounts internally; public registration cannot request this role. The project has no ADMIN role or administrative approval screen, so none was invented. Existing managers are preserved.
5. Run the picker on actual iOS/Android Expo Go devices and test platform photo permission flows. Export/test checks cannot replace device permission testing.
6. Consider the existing Expo patch recommendation separately. Existing API base URLs, Neon connection and .env files are unchanged.
