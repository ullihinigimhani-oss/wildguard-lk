# Application foundation

The existing backend, Prisma schema, and migrations are unchanged. Both clients
communicate only with the Express API. Development took place in the working tree
on `feature/app-foundation`; no branch, commit, push, or merge operation was performed.

## Run locally

Open three PowerShell terminals. Commands below use this checkout's absolute path.
Dependencies are already installed; on another machine, run `npm ci` in each folder.
Use Node.js 22.17 or a newer supported Node 22 LTS release.

Backend:

```powershell
Set-Location 'C:\Users\Lihini\Desktop\WildGuard LK\wildguard-lk\backend'
npm run dev
```

The existing backend environment supplies its database URL and port. This setup
uses port 5000. Do not copy that environment file into either client.

Web:

```powershell
Set-Location 'C:\Users\Lihini\Desktop\WildGuard LK\wildguard-lk\web'
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). The API URL
defaults to `http://localhost:5000/api`. To change it, set only
`VITE_API_BASE_URL` in `web/.env`, following `web/.env.example`, then restart Vite.

Mobile:

```powershell
Set-Location 'C:\Users\Lihini\Desktop\WildGuard LK\wildguard-lk\mobile'
npm start
```

Before testing API connectivity on a phone, set `EXPO_PUBLIC_API_BASE_URL` in
`mobile/.env` to `http://YOUR_COMPUTER_LAN_IP:5000/api` using the example file.
The sample IP in `.env.example` must be replaced. Use `ipconfig` to find the address
of the computer's active network adapter. The phone and computer must be on the
same reachable network. The backend port must be reachable through local firewall
rules. Android Emulator can use `http://10.0.2.2:5000/api`. A phone's `localhost`
refers to the phone, not the computer. Restart Expo after environment changes.

Use an Expo Go client compatible with SDK 57 or a compatible development build.
`npm run android` starts Expo for a configured Android emulator. Native iOS simulator
execution requires macOS; it is not available on this Windows host.

The app can be previewed without a backend. The API indicator then says unavailable
or not configured, while the explicitly labeled sample dashboard remains usable.
These client environment variables are public configuration, never secret storage.

## Implemented screens and navigation

Web: login, password-recovery placeholder, operations dashboard, profile, and 404.
The responsive sidebar links to placeholders for patrols, incidents, community
reports, wildlife monitoring, alerts, camera traps, analytics, users, and settings.
The user menu opens the sample profile; Exit demo returns to login.

Mobile: welcome, ranger login, ranger home, profile, wildlife alerts placeholder,
patrol placeholder, incident placeholder, and interactive sync-state preview.
React Navigation native stacks provide header/back navigation. Exiting the demo
removes the ranger navigation stack and returns to welcome.

The login buttons validate the UI and explain that real sign-in is unavailable.
They never send, authenticate, or persist credentials. Separate **Explore demo**
buttons explicitly enter memory-only sample sessions. Refresh/restart clears them.
Remember-me is unavailable until real auth exists. There is no registration flow.
Route gates are only prototype navigation, not security or API authorization.

All operational data lives in each client's `src/constants/demo.js`. The backend
health indicator is the only live data. Offline, pending-sync, and patrol statuses
are illustrative; no GPS, hardware integration, report submission, notifications,
local persistence, or synchronization is implemented.

## Structure and dependencies

Existing folders and empty future-feature placeholders are retained.

Web fills existing App/main, Login/Dashboard, Sidebar/Navbar/StatusBadge and API
files. New folders include `src/constants`, `src/hooks`, `src/layouts`, `src/routes`,
`src/components/common`, `src/pages/Profile`, and `tests/foundation`. Entry HTML,
Vite config, styles, lockfile and public environment example are included.
Dependencies: React, React DOM, React Router, Axios; Vite, React Vite plugin,
Vitest, jsdom and Testing Library for development/tests.

Mobile fills existing auth/app navigators, login/alerts screens, SyncStatus, API,
package and Expo config. New files include App/index, Babel/Jest config, public
environment example, Expo ignore rules and lockfile. New common components, hooks,
constants, welcome/home/profile/placeholder screens and foundation tests complete
the existing structure. Dependencies: Expo 57, React 19.2.3, React Native 0.86.3,
React Navigation native/native-stack, safe-area-context, native-screens and Axios;
Jest, jest-expo, Expo Babel preset, React Test Renderer and React Native Testing
Library for tests. Native versions follow Expo's bundled compatibility map.

## Verification commands

```powershell
npm --prefix backend test
npm --prefix web test
npm --prefix web run build
npm --prefix mobile test
npm --prefix mobile run check:expo
```

From `mobile/`:

```powershell
npx expo config --type public
npx expo export --platform android --platform ios --output-dir dist
```

Web tests cover login rendering, validation, password visibility, non-authenticating
login behavior, demo dashboard/profile/placeholder navigation, logout and 404.
Mobile tests cover login rendering, validation, password visibility, non-authenticating
login behavior, home actions and simulated sync controls. Health requests are mocked
in client tests; backend tests retain their existing Prisma mock. Empty future-use-case
tests are not executed. New client tests are discovered under `tests/foundation/`.
Expand the test configuration when implementing the existing future-test placeholders.

The JavaScript bundle export checks native imports and Metro compilation; it does
not replace testing on a real device. Responsive CSS and component tests do not
replace a browser visual/accessibility review.

Verified on 2026-09-27: backend 5/5 tests, web 4/4 tests, mobile 4/4 tests;
web production build passed; Expo dependency check and public config evaluation
passed; Android and iOS JavaScript exports passed. A real backend health request
returned HTTP 200 with the database connected, and Vite served the app entry with
HTTP 200. Web keyboard-menu focus and Escape behavior are covered by the navigation
test. The web dependency audit is clean. No backend files changed, no files were
staged, and all actual `.env` files remain ignored.

## Known limitations

- Real authentication and business workflows remain intentionally unimplemented.
- Mobile dependency audit reports 10 moderate findings through Expo's xcode/uuid
  build-tool dependency chain. No high or critical findings were reported. The
  suggested automated fix downgrades Expo to SDK 46; do not apply it blindly.
- The in-app browser blocked the localhost preview, so visual browser validation
  could not be completed in this environment. Physical-device validation is pending.
- Web fonts use Google Fonts with system-font fallbacks if unavailable.
