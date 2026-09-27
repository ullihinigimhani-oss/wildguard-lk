# Registration implementation report

## Model, role and database
Reused the existing User: id (generated cuid), required name/email/passwordHash/role, optional phone/parkId, isActive (default true), createdAt and updatedAt. Email already has a unique constraint. Existing park, assigned/created patrol, incident, community report and alert acknowledgement relationships remain intact.
Public role: COMMUNITY_USER. Existing other roles: RANGER, PARK_MANAGER, COMMUNITY_LIAISON, RESEARCHER. ADMIN and PARK_RANGER are not actual enum values, and requests using either cannot elevate privileges.
Schema changes: none. Migrations: none. Database resets: none. Packages added to project: none. Package manifests and lockfiles unchanged.

## API and clients
POST /api/auth/register uses router → controller → validator → service → repository → Prisma → configured Neon database. Returns 201, 400, 409 or a safe 500. See api/API_DOCUMENTATION.md for request and response details.
Web route: /register, linked from Login. Mobile: Register screen in the existing auth navigator, linked from Welcome and Login. Both provide full name/email/optional phone/password/confirmation, password visibility controls and requirements, expandable prototype Terms & Privacy, required consent, validation, duplicate/API error feedback, disabled loading state and navigation to Login with success feedback only after confirmed API success.
Web reuses the existing responsive branded split layout and focus styles. Mobile reuses the safe-area, keyboard-avoiding scroll layout and large touch targets.
Environment settings: VITE_API_BASE_URL and EXPO_PUBLIC_API_BASE_URL, ending in /api. A physical phone requires a reachable LAN or hosted API URL. Neither client connects to Neon.

## Security
Server-side bcrypt cost 12; required password complexity; 72-byte UTF-8 maximum prevents bcrypt truncation. Trimmed names and lowercase trimmed emails. Whitelisted persistence fields and fixed community role; no public role/park/activation selection. Unique-constraint conflicts mapped to 409. Safe response selection plus service projection excludes credentials. No password/secret logging, no TLS bypass. Environment files remain Git ignored. confirmPassword and termsAccepted are validated by clients and never persisted.

## Verification actually run
- Backend npm test: 31 passed, including all five existing health tests and 26 registration tests.
- Web npm test: 14 passed across three suites (existing foundation, registration, API service).
- Mobile npm test: 15 passed across three suites (existing foundation, registration, API service).
- Backend npm run prisma:validate: passed.
- Web npm run build: passed.
- Mobile npm run check:expo: passed, dependencies up to date.
- Mobile npx expo config --type public: passed, SDK 57.0.0.
- Backend node scripts/verify-registration.js: passed against configured development Neon; GET /api/health 200, registration 201, row persistence, normalized email/name, bcrypt verification, COMMUNITY_USER, safe output, no confirmation/consent data and duplicate 409. Temporary user removed and absence verified.
- git diff --check: passed; only Git's LF/CRLF notices.
- Web desktop registration visually inspected successfully in the browser. Browser tab connection was intermittent; a fresh preview succeeded.

## Limits
Login remains the existing demo/availability preview, as requested; registration does not establish a session. Native iPhone/Android device and keyboard interaction were not visually tested. The inline Terms & Privacy is a prototype notice, not a supplied organizational policy. Existing empty future-module test files remain outside configured foundation suites. Web tests/build and Expo cache checks needed execution outside the filesystem sandbox and then passed. A discretionary formatter download was cancelled when it stalled; no dependency was added.
No Git commit, push, merge, checkout or branch operation was performed.

## Files created
- backend/scripts/verify-registration.js
- backend/src/repositories/auth.repository.js
- backend/src/validators/auth.validator.js
- backend/tests/integration/registration.api.test.js
- mobile/src/screens/auth/RegisterScreen.js
- mobile/src/services/authApi.js
- mobile/src/utils/registration.js
- mobile/tests/foundation/authApi.test.js
- mobile/tests/foundation/registration.test.js
- web/src/pages/Register/Register.jsx
- web/src/services/authApi.js
- web/src/utils/registration.js
- web/tests/foundation/authApi.test.jsx
- web/tests/foundation/registration.test.jsx
- docs/REGISTRATION_REPORT.md (this report)

## Files modified
- backend/src/app.js
- backend/src/controllers/auth.controller.js
- backend/src/middleware/error.middleware.js
- backend/src/routes/auth.routes.js
- backend/src/services/auth.service.js
- docs/api/API_DOCUMENTATION.md
- mobile/src/navigation/AuthNavigator.js
- mobile/src/screens/auth/LoginScreen.js
- mobile/src/screens/auth/WelcomeScreen.js
- web/src/pages/Login/Login.jsx
- web/src/routes/AppRoutes.jsx
- web/src/styles.css

## Run locally (three PowerShell terminals)
Backend:
```powershell
Set-Location 'C:\Users\Lihini\Desktop\WildGuard LK\wildguard-lk\backend'
npm run dev
```
Web:
```powershell
Set-Location 'C:\Users\Lihini\Desktop\WildGuard LK\wildguard-lk\web'
npm run dev
```
Mobile:
```powershell
Set-Location 'C:\Users\Lihini\Desktop\WildGuard LK\wildguard-lk\mobile'
$env:EXPO_PUBLIC_API_BASE_URL = 'http://YOUR_COMPUTER_LAN_IP:5000/api'
npm start
```
Use the backend's configured PORT (the example is 5000). Set web VITE_API_BASE_URL to the same backend /api URL if it differs from its localhost:5000/api default. On mobile, replace YOUR_COMPUTER_LAN_IP with the actual reachable address before starting Expo. Backend .env owns DATABASE_URL; keep it secret.
