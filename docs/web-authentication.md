# Web authentication

The existing registration service, bcrypt hashes, Prisma User model and Neon database are reused. No database migration or mobile change is required.

## API and session

- `POST /api/auth/register`: existing community registration, unchanged.
- `POST /api/auth/login`: normalized email and password; returns safe user data and a one-hour HS256 JWT.
- `GET /api/auth/me`: requires `Authorization: Bearer <token>`; verifies signature, expiry, issuer and audience and checks the current active user in the database.
- Unknown users, wrong passwords and inactive users receive the same 401 error. Password hashes never leave the backend.
- The web AuthProvider stores only the JWT in sessionStorage, restores the user from `/auth/me`, and clears the session on logout, expiry or a 401 response. Login always opens `/dashboard`.
- Logout clears the current tab's token. This stateless implementation does not revoke a previously copied JWT server-side; it expires after one hour. Production deployment should additionally provide login rate limiting and an appropriate CSP. Use HTTPS outside local development.

## Configuration

Keep existing backend `DATABASE_URL`, `JWT_SECRET` (at least 32 characters), and optional `PORT` (default 5000). No environment file was changed. The frontend uses existing `VITE_API_BASE_URL`, defaulting to `http://localhost:5000/api`. Never put backend secrets in Vite variables.

## Pages

Public homepage and photographs are preserved. The login page now calls the API. Authenticated pages share the existing responsive operations layout and show the actual name, email and role. Registration still redirects to login without automatically signing in.

Protected routes: `/dashboard`, `/profile`, `/patrols`, `/incidents`, `/map`, `/community-reports`, `/wildlife`, `/alerts`, `/camera-traps`, `/analytics`, `/users`, `/settings`. Anonymous access redirects to `/login` after restoration completes. Field tools and password recovery remain clearly marked placeholders. Dashboard empty states do not claim to be live database statistics. Future operational endpoints must enforce authentication and role authorization server-side.

## Files

Created:
- `backend/tests/integration/login.api.test.js`
- `web/src/hooks/useAuth.jsx`
- `docs/web-authentication.md`

Modified:
- Backend `src/controllers/auth.controller.js`, `src/middleware/auth.middleware.js`, `src/middleware/error.middleware.js`, `src/repositories/auth.repository.js`, `src/routes/auth.routes.js`, `src/services/auth.service.js`, `src/validators/auth.validator.js`.
- Web `src/App.jsx`, `src/components/Navbar/Navbar.jsx`, `src/components/public/PublicNavbar.jsx`, `src/constants/navigation.js`, `src/pages/Dashboard/Dashboard.jsx`, `src/pages/Landing/Landing.jsx`, `src/pages/Login/Login.jsx`, `src/pages/Profile/Profile.jsx`, `src/routes/AppRoutes.jsx`, `src/routes/ProtectedRoute.jsx`, `src/services/authApi.js`, `src/styles.css`.
- Web tests `tests/foundation/app.test.jsx`, `tests/foundation/landing.test.jsx`. Registration tests preserved.

Removed: `web/src/hooks/useDemoAuth.jsx`, replaced by the real AuthProvider.

## Run

From backend:

```powershell
npm test
npm run dev
```

From web, in a separate terminal:

```powershell
npm test
npm run build
npm run dev
```

Restart any already running backend so the new routes load. If port 5000 is occupied, stop that existing backend before starting another, or use a matching PORT and VITE_API_BASE_URL in your local configuration.

## Verification

Automated tests cover credential validation, bcrypt verification, unknown/wrong/inactive credentials, safe responses, malformed requests, JWT expiry, authenticated session verification, frontend validation/errors/loading, login navigation, restoration, route protection and logout. Existing registration coverage remains.

A live Neon test registered a disposable account through the API, confirmed database persistence, logged in, restored the user with `/auth/me`, and checked rejection paths. A separate temporary account verified real browser login, dashboard refresh and logout. Temporary verification accounts were removed after use. Registration form behavior is covered by the existing automated tests; no legal terms were accepted through the browser on the user's behalf.
