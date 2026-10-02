# Public landing page

Implemented on `feature/public-landing-page`, branched from
`feature/user-access-management` at `008b365` with explicit user approval because
local `develop` did not yet contain registration. No commits, merges or pushes
were performed.

## Files created

- `web/src/pages/Landing/Landing.jsx` and `landing.css`: public page and scoped responsive styling.
- `web/src/components/public/`: PublicNavbar, PublicFooter, FeatureCard,
  FeatureIcon and ConservationStory components.
- `web/src/constants/publicContent.js`: shared navigation, feature/story content and asset imports.
- `web/src/assets/public/`: original landscape, ranger, community and monitoring SVG illustrations.
- `web/src/routes/ProtectedRoute.jsx`: reusable route guard that distinguishes demo preview from authenticated access.
- `web/tests/foundation/landing.test.jsx`: public navigation and access-control regression tests.
- This report.

## Files modified

- `web/src/routes/AppRoutes.jsx`: public `/`, protected operation routes, and an authenticated registration redirect.
- `web/src/hooks/useDemoAuth.jsx`: explicitly marks demo state as unauthenticated.
- `web/src/pages/Login/Login.jsx`: branding links back to the public home page.
- `web/tests/foundation/app.test.jsx`: existing login tests now begin at `/login`; demo/logout expectations reflect the registration redirect.

No packages, backend code, registration submission logic, database schema, environment files,
or mobile files were changed for this feature.

## Routes and access

- `/` is public for all visitors, including authenticated users. About, Features,
  Conservation and Contact are in-page anchors. Explore Features and Learn More
  use native anchor navigation with smooth scrolling when reduced motion is not requested.
- `/login` and `/register` retain the existing screens. Sign In opens `/login`;
  Sign Up and Get Started open `/register` for visitors.
- Unauthenticated `/dashboard`, `/profile` and module routes redirect to `/register`.
- The explicitly entered demo session can still preview the read-only dashboard/profile.
  It cannot enter operational module routes. A demo user is not an authenticated user.
- With a real authenticated user state, existing module/dashboard navigation is retained;
  `/register` and Get Started lead to `/dashboard` instead of requesting registration again.

Important existing limitation: the repository has a working community registration API,
but login is still a UI/demo preview. No real session authentication exists. The current
provider therefore keeps `isAuthenticated` false; tests inject authenticated state to
verify the future route behavior. The real authentication feature must populate that
state from a verified server session and enforce authorization on backend endpoints.
Client route guards alone are not backend security. This feature adds no fake login.

## Artwork and contact content

The four local SVGs were drawn specifically for this project. No SMART branding,
photographs or copyrighted site assets were copied. No manual image supply is required.
Approved photography can replace the imports in `publicContent.js` later; update the
alt text and illustration captions at the same time. No invented contact email or phone
number is published; Contact explains that launch contact details are pending.

## Verification

- `npm test` in `web/`: 30 tests passed across four files, including existing registration tests.
- `npm run build` in `web/`: production build passed.
- Added cases cover public rendering, Sign In, Sign Up, Get Started, Explore Features,
  Learn More anchors, mobile menu/Escape focus behavior, unauthenticated redirects,
  demo-versus-authenticated access, and authenticated registration/dashboard navigation.
- Browser checks covered the desktop hero/features at 1440px and the phone hero/menu
  at 390px, including real anchor navigation and the Sign In destination.

## Run

```powershell
Set-Location 'C:\Users\Lihini\Desktop\WildGuard LK\wildguard-lk\web'
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173/`.
The public page needs no backend connection. Existing registration requires the backend:

```powershell
Set-Location 'C:\Users\Lihini\Desktop\WildGuard LK\wildguard-lk\backend'
npm run dev
```
