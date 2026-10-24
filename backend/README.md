# Bootcamp API

This folder is the HTTP API for the Maxim Nyansa 2026 Cybersecurity Bootcamp. It is a separate program from the website. The website is developed on the `frontend` branch. This API is developed on the `backend` branch. Neither tree is copied into the other.

This milestone is the foundation. The process starts, checks its configuration, connects to PostgreSQL, and answers `GET /api/v1/health`. Accounts, lessons, and the other screens are later milestones. There is no `admin:create` command yet, and no route besides health and the API docs.

## What you need

- Node.js 22 or newer (the current LTS line).
- PostgreSQL 16, either on your machine or in Docker.

## First run

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and set values there. Do not put those values in git, in a pull request, or in a chat. `.env.example` stays blank on purpose.

| Variable               | What to put                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`             | `development` while you are working. `production` on the server.                                                                                                                        |
| `PORT`                 | `3000` is used when this is empty.                                                                                                                                                      |
| `DATABASE_URL`         | A Postgres URL. Required. The app will not start without it.                                                                                                                            |
| `DATABASE_SSL`         | `true` or `false`. Production defaults to `true`. A URL that already says `sslmode=require` also turns SSL on.                                                                          |
| `FRONTEND_URL`         | The one public website origin, for example `http://127.0.0.1:5173` in development. Production refuses to start if it is missing. A path on the end is ignored. Only the origin is kept. |
| `SESSION_SECRET`       | Required in production, at least 32 characters. Not used for a login yet. It is loaded now so a production boot fails early when it is missing. It is never printed.                    |
| `LOG_LEVEL`            | `info` when empty. Use `silent` only in tests.                                                                                                                                          |
| `TRUST_PROXY`          | `true` in production, because the API sits behind the same-origin proxy. One proxy hop is trusted, which is what the rate limiter uses for the client address.                          |
| `RATE_LIMIT_WINDOW_MS` | `60000` when empty.                                                                                                                                                                     |
| `RATE_LIMIT_MAX`       | `300` requests per window per address when empty. Health checks are not counted.                                                                                                        |

Then create the migration history and start the API:

```bash
npm run migration:run
npm run dev
```

`npm run dev` restarts when you change a file. `npm run build` compiles to `dist/`, and `npm start` runs that compiled output.

Open `http://127.0.0.1:3000/api/v1/health`. A healthy database looks like:

```json
{ "status": "ok", "database": "up", "uptimeSeconds": 3 }
```

If Postgres is down, the status is `503` and `database` is `down`. The message from the database driver is not included. It can contain a host name.

API docs are at `http://127.0.0.1:3000/api/docs`. The raw document is `/api/docs/openapi.json`. Only the health route is listed, because documenting a route that does not exist would be a lie.

## How a request walks through the program

Read this once with `GET /api/v1/health` in mind. The same path is used for every later route. The words in parentheses are the folder names.

1. **The process starts** (`src/main.ts`). It asks `loadEnv` to read the environment. If a required value is missing or nonsense, the process stops before it listens. The error names the variable. It does not repeat the value, because that value may be a password.

2. **The composition root builds the objects** (`src/composition/container.ts`). This is the only place that connects the pieces. It opens the database, builds the logger, and hands that database to `HealthService`. The service does not create its own connection. Later features will be wired here the same way: the container builds the repository, then the service, then the route.

3. **A request arrives.** Express (`src/app.ts`) runs a line of functions. Each function does one job and then passes the request on. That line is called middleware.

4. **A request id is attached** (`shared/middleware/request-id.ts`). If the caller sent a short `X-Request-Id`, that id is kept. Otherwise a new one is minted. The same id is written on the response header and in the log, so you can match a browser failure to one server line.

5. **The request is logged when the response finishes** (`shared/middleware/request-logger.ts`). The line has the method, the path, the status, and how long it took. The query string is left out, so a token in the URL is not stored. The body is left out, so a password is not stored.

6. **Security checks run** (`shared/middleware/security.ts`). Helmet sets safe browser headers. CORS allows one origin, the `FRONTEND_URL`, and allows cookies to be sent with it. Any other browser origin is rejected. There is no `*` origin. A general rate limit slows a client that sends too many requests. JSON bodies larger than 1 MB are rejected. `cookie-parser` reads cookies. It does not set a session yet.

7. **The route runs** (`modules/health`). The router calls `HealthService`. The service asks the database `SELECT 1`. It returns `up` or `down`. The controller picks `200` or `503`.

8. **Unknown paths** become a `404` with the shared error shape. A thrown exception becomes a `500` with the message "Something went wrong." The real exception stays in the server log as a name only, not as a paragraph that might contain a URL.

The error shape the website already expects is:

```json
{ "error": { "code": "not_found", "message": "That route does not exist." } }
```

`code` is one of `validation` (422), `unauthenticated` (401), `forbidden` (403), `not_found` (404), `rate_limited` (429), `server` (500), or `pending` (501). Field problems also include `fieldErrors`, a map of field name to sentence. Invalid JSON and a body over 1 MB are `validation`, so the website can show them next to a form later.

## Cookies, ready for the next milestone

No login cookie is set yet. The flags the next milestone must use are already fixed and stored on `app.locals.cookiePolicy`:

| Cookie  | Name         | HttpOnly | SameSite | Path      | Secure        |
| ------- | ------------ | -------- | -------- | --------- | ------------- |
| Session | `mn_session` | yes      | `Lax`    | `/api/v1` | in production |
| CSRF    | `mn_csrf`    | no       | `Lax`    | `/`       | in production |

`Domain` is not set. The cookie stays on this host only. `SameSite=None` is not used. The browser is expected to talk to one origin. In development the Vite dev server proxies `/api/v1` to this process, so the browser still sees one origin.

## Database

TypeORM is the library that talks to PostgreSQL. `synchronize` is off. The program will not invent or alter tables on startup. A migration file is the only way the schema changes, and that file is reviewed like any other change.

`src/database/migrations/1792800000000-Baseline.ts` is the first migration. It creates no tables. It marks the start of the history. Later milestones add tables in new files and register those classes in `src/database/data-source.ts`.

`src/database/cli-data-source.ts` is what the migration commands load. They read the same environment as the server.

```bash
npm run migration:run     # apply new migrations
npm run migration:show    # list what is applied
npm run migration:revert  # undo the last migration
```

Run those against the database in `DATABASE_URL`. They do not choose a database by themselves.

`src/shared/persistence/base-repository.ts` is the pattern later modules will extend. A repository is given a TypeORM repository. It does not open a connection. There is no feature table to put behind it yet.

## Tests

Unit tests do not need Postgres. They cover configuration, the error shape, cookies, the health decision, validation, and the HTTP pipeline.

Integration tests need a real Postgres. Two ways to give them one:

1. **Docker.** If `/var/run/docker.sock` exists and `TEST_DATABASE_URL` is unset, the integration test starts PostgreSQL 16 with Testcontainers, uses a database named `mn_bootcamp_test`, and stops the container afterwards.
2. **A database you already have.** Set `TEST_DATABASE_URL` to a Postgres URL whose database name ends with `_test`. The test applies the baseline migration and removes that baseline row at the end. It does not drop the database.

If the database name does not end with `_test`, the test stops before connecting. A failure must not wipe a database you use for development.

```bash
# example only. Use your own local role. Do not point this at a shared database.
TEST_DATABASE_URL=postgres://127.0.0.1:5432/mn_bootcamp_test npm test
```

`npm run test:unit` and `npm run test:integration` run each group on its own. `npm test` runs both.

Also before you call a change done:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Scripts

| Script              | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Run the API and restart on file changes.      |
| `npm start`         | Run the compiled API.                         |
| `npm run build`     | Compile TypeScript to `dist/`.                |
| `npm run typecheck` | Check types without writing files.            |
| `npm run lint`      | Run ESLint.                                   |
| `npm run format`    | Rewrite files with Prettier.                  |
| `npm test`          | Unit tests and the Postgres integration test. |

## What is left for the next milestone

Authentication. That is Argon2id passwords, the session cookie, the CSRF cookie, login rate limiting, logout, `GET /api/v1/auth/session`, and `npm run admin:create`. The first administrator password will come from a private environment variable or an interactive prompt. It will not be logged or committed. That command is not part of this milestone, and it must not be run with a real address until the owner records one.

No feature route beyond health should be added before that.
