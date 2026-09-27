# WildGuard LK backend

Run commands from `backend/` with Node.js 22.12 or later supported by Prisma 7.

```sh
npm install
npm run prisma:generate
npm run prisma:validate
npm run dev
```

The existing `backend/.env` supplies `DATABASE_URL`. Do not commit or print it.
Runtime environment variables take precedence. `PORT` defaults to 3000.
The Prisma CLI continues to use the existing `prisma.config.ts`.
The runtime uses a shared Prisma client with the Prisma 7 PostgreSQL adapter.
No migration or database reset is needed for this foundation.

`npm start` starts the server without nodemon. SIGINT and SIGTERM close the
HTTP server and Prisma connection pool.

## Health endpoint

`GET /api/health` executes a read-only `SELECT 1` through Prisma on each request.
It returns HTTP 200 with `{ "success": true, "message": "WildGuard LK API is running", "database": "connected" }`.
Database failures return HTTP 503 with `success: false` and `database: "disconnected"`.
Connection details and stack traces are never returned in the response.
The HTTP server can start while the database is unavailable; the health endpoint
reports database readiness. The connection timeout is fifteen seconds to allow for
Neon wake-up and network latency; the query timeout remains five seconds.
Legacy SSL modes are normalized to `verify-full` in memory to preserve pg's current
certificate verification behavior, unless libpq compatibility is explicitly enabled.
The environment file is not changed.

The request flow is route → controller → service → repository → Prisma.
The existing validators and business-use-case placeholders remain available for future work.
CORS currently allows all origins without credentials for initial development.

## Tests

```sh
npm test
npm run test:watch
npm run test:coverage
```

Supertest exercises the Express application without starting the production server.
Prisma is mocked at the database boundary, so tests never access Neon or change data.
Tests cover the success response, status and JSON structure, database failure and
recovery, CORS, unknown routes, and malformed JSON handling.
Jest discovers nonempty test files under `tests/`; existing empty placeholders are
ignored until implemented. Coverage excludes startup and database configuration,
which require separate runtime verification.
