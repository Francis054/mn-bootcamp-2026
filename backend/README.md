# Bootcamp API

This folder is the HTTP API for the Maxim Nyansa 2026 Cybersecurity Bootcamp. It is a separate program from the website. The website is developed on the `frontend` branch. This API is developed on the `backend` branch. Neither tree is copied into the other.

The process starts, checks its configuration, and connects to PostgreSQL. It answers `GET /api/v1/health`, and it can sign an administrator in. Lessons and the other screens are later milestones. There is no public registration page.

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

| Variable                   | What to put                                                                                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                 | `development` while you are working. `production` on the server.                                                                                                                        |
| `PORT`                     | `3000` is used when this is empty.                                                                                                                                                      |
| `DATABASE_URL`             | A Postgres URL. Required. The app will not start without it.                                                                                                                            |
| `DATABASE_SSL`             | `true` or `false`. Production defaults to `true`. A URL that already says `sslmode=require` also turns SSL on.                                                                          |
| `FRONTEND_URL`             | The one public website origin, for example `http://127.0.0.1:5173` in development. Production refuses to start if it is missing. A path on the end is ignored. Only the origin is kept. |
| `SESSION_SECRET`           | At least 32 characters. Required in production. The server uses it to hash session cookies. It is never printed. Sign-in answers with a plain error when it is missing.                 |
| `SESSION_IDLE_TTL_MS`      | How long a session can sit unused. `1800000` (30 minutes) when empty.                                                                                                                   |
| `SESSION_ABSOLUTE_TTL_MS`  | How long a session may exist at all. `43200000` (12 hours) when empty.                                                                                                                  |
| `LOGIN_FAILURE_LIMIT`      | Failed sign-ins for one mailbox before a lock. `5` when empty.                                                                                                                          |
| `LOGIN_LOCK_MS`            | How long that lock lasts. `60000` when empty.                                                                                                                                           |
| `LOGIN_IP_FAILURE_LIMIT`   | Failed sign-ins from one address before a lock. `30` when empty, so a classroom does not get locked by one mailbox.                                                                     |
| `ADMIN_EMAIL`              | Read only by `npm run admin:create`. Not read by the running server. Leave it empty in the example.                                                                                     |
| `ADMIN_BOOTSTRAP_PASSWORD` | Read only by that command, or type the password at its hidden prompt. Never put it on the command line. The command does not print it.                                                  |
| `LOG_LEVEL`                | `info` when empty. Use `silent` only in tests.                                                                                                                                          |
| `TRUST_PROXY`              | `true` in production, because the API sits behind the same-origin proxy. One proxy hop is trusted, which is what the rate limiter uses for the client address.                          |
| `RATE_LIMIT_WINDOW_MS`     | `60000` when empty.                                                                                                                                                                     |
| `RATE_LIMIT_MAX`           | `300` requests per window per address when empty. Health checks are not counted.                                                                                                        |

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

API docs are at `http://127.0.0.1:3000/api/docs`. The raw document is `/api/docs/openapi.json`. It lists health, sign-in, sign-out, and the session check. The administrator command is not an HTTP route, so it is not in that document.

## How a request walks through the program

Read this once with `GET /api/v1/health` in mind. The same path is used for every later route. The words in parentheses are the folder names.

1. **The process starts** (`src/main.ts`). It asks `loadEnv` to read the environment. If a required value is missing or nonsense, the process stops before it listens. The error names the variable. It does not repeat the value, because that value may be a password.

2. **The composition root builds the objects** (`src/composition/container.ts`). This is the only place that connects the pieces. It opens the database, builds the logger, and hands that database to `HealthService` and to the account and session services. A service does not create its own connection. The container builds the repository, then the service, then the route.

3. **A request arrives.** Express (`src/app.ts`) runs a line of functions. Each function does one job and then passes the request on. That line is called middleware.

4. **A request id is attached** (`shared/middleware/request-id.ts`). If the caller sent a short `X-Request-Id`, that id is kept. Otherwise a new one is minted. The same id is written on the response header and in the log, so you can match a browser failure to one server line.

5. **The request is logged when the response finishes** (`shared/middleware/request-logger.ts`). The line has the method, the path, the status, and how long it took. The query string is left out, so a token in the URL is not stored. The body is left out, so a password is not stored.

6. **Security checks run** (`shared/middleware/security.ts`). Helmet sets safe browser headers. CORS allows one origin, the `FRONTEND_URL`, and allows cookies to be sent with it. Any other browser origin is rejected. There is no `*` origin. A general rate limit slows a client that sends too many requests. JSON bodies larger than 1 MB are rejected. `cookie-parser` reads cookies. Sign-in is what sets the session cookie, and only on `/api/v1/auth/login`.

7. **The route runs** (`modules/health`). The router calls `HealthService`. The service asks the database `SELECT 1`. It returns `up` or `down`. The controller picks `200` or `503`.

8. **Unknown paths** become a `404` with the shared error shape. A thrown exception becomes a `500` with the message "Something went wrong." The real exception stays in the server log as a name only, not as a paragraph that might contain a URL.

The error shape the website already expects is:

```json
{ "error": { "code": "not_found", "message": "That route does not exist." } }
```

`code` is one of `validation` (422), `unauthenticated` (401), `forbidden` (403), `not_found` (404), `rate_limited` (429), `server` (500), or `pending` (501). Field problems also include `fieldErrors`, a map of field name to sentence. Invalid JSON and a body over 1 MB are `validation`, so the website can show them next to a form later.

## Cookies

Sign-in sets two cookies. The flags live on `app.locals.cookiePolicy`, and the routes read them from there:

| Cookie  | Name         | HttpOnly | SameSite | Path      | Secure        |
| ------- | ------------ | -------- | -------- | --------- | ------------- |
| Session | `mn_session` | yes      | `Lax`    | `/api/v1` | in production |
| CSRF    | `mn_csrf`    | no       | `Lax`    | `/`       | in production |

`Domain` is not set. The cookie stays on this host only. `SameSite=None` is not used. The browser is expected to talk to one origin. In development the Vite dev server proxies `/api/v1` to this process, so the browser still sees one origin.

## Database

TypeORM is the library that talks to PostgreSQL. `synchronize` is off. The program will not invent or alter tables on startup. A migration file is the only way the schema changes, and that file is reviewed like any other change.

`src/database/migrations/1792800000000-Baseline.ts` is the first migration. It creates no tables. It marks the start of the history. `1792868400000-Auth.ts` adds `users`, `sessions`, `login_throttles`, and `audit_events`. New migrations are new files, and each class is registered in `src/database/data-source.ts`.

`src/database/cli-data-source.ts` is what the migration commands load. They read the same environment as the server.

```bash
npm run migration:run     # apply new migrations
npm run migration:show    # list what is applied
npm run migration:revert  # undo the last migration
```

Run those against the database in `DATABASE_URL`. They do not choose a database by themselves.

`src/shared/persistence/base-repository.ts` is the pattern the account and session repositories extend. A repository is given a TypeORM repository. It does not open a connection.

## Tests

Unit tests do not need Postgres. They cover configuration, the error shape, cookies, the health decision, validation, passwords, roles, and the HTTP pipeline.

Integration tests need a real Postgres. Two ways to give them one:

1. **Docker.** If `/var/run/docker.sock` exists and `TEST_DATABASE_URL` is unset, the integration test starts PostgreSQL 16 with Testcontainers, uses a database named `mn_bootcamp_test`, and stops the container afterwards.
2. **A database you already have.** Set `TEST_DATABASE_URL` to a Postgres URL whose database name ends with `_test`. The test applies the baseline and auth migrations, then removes those two rows at the end. It does not drop the database.

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

| Script                 | What it does                                  |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Run the API and restart on file changes.      |
| `npm start`            | Run the compiled API.                         |
| `npm run build`        | Compile TypeScript to `dist/`.                |
| `npm run typecheck`    | Check types without writing files.            |
| `npm run lint`         | Run ESLint.                                   |
| `npm run format`       | Rewrite files with Prettier.                  |
| `npm test`             | Unit tests and the Postgres integration test. |
| `npm run admin:create` | Create the first administrator. See below.    |

## Signing in

There is no sign-up route. The first account is created on purpose:

```bash
npm run migration:run
npm run admin:create -- --email you@example.com
```

The mailbox can also come from `ADMIN_EMAIL`. The password comes from `ADMIN_BOOTSTRAP_PASSWORD` or from a hidden prompt when you are at a real terminal. The command asks twice. It refuses a password shorter than 12 characters, a password with no letter or no number, a very common password, and a password that is the mailbox. It does not print the mailbox or the password. If that mailbox already exists, it stops. `--rotate` changes the password of an existing administrator and does not turn a viewer or an editor into an administrator.

Do not run it with a real Foundation mailbox until one has been chosen. A local address such as one you control is enough for development.

A sign-in walks through the program like this:

1. The browser sends `POST /api/v1/auth/login` with the email and the password. The old `developmentAck` checkbox is accepted and ignored.
2. The server checks the body. It does not write the password to the log.
3. It asks PostgreSQL whether this mailbox or this address is locked. Five wrong passwords lock that mailbox for one minute. The message is the same when the mailbox is missing and when the password is wrong.
4. The password is checked with Argon2id. The database stores the hash, never the password.
5. A random session token is put in an HttpOnly cookie named `mn_session`. The cookie path is `/api/v1`, `SameSite` is `Lax`, and `Domain` is not set. A second cookie, `mn_csrf`, is readable by the page, path `/`, with the same `SameSite` and no `Domain`. Both are `Secure` in production. The database stores a hash of the session token, not the token.
6. Later requests send `mn_session` only to `/api/v1`. A change such as sign-out must also send the same token in the `X-CSRF-Token` header. A mismatch is `403`.
7. `GET /api/v1/auth/session` returns `{ "authenticated": false }` or the current person and an `expiresAt` time in ISO form. A session also ends after 30 minutes of quiet, or after 12 hours, whichever comes first.
8. Sign-out deletes the session row and clears both cookies.

Each success, failure, and sign-out writes an audit row. That row has the action, the account id when the account exists, the address, and the request id. It does not have the password or the mailbox. Nothing in this milestone lists those rows on a screen.

Roles are `viewer`, `editor`, and `administrator`. A route can ask for a minimum role. The permission names match the website: a viewer can read content and manage their own account, an editor can also change content and media, and an administrator can also manage users and settings.

## Where this will run

The database is a free Supabase Postgres project in `eu-central-1`. The project ref is `psxzqwztgjkqnnncxddc`. This API does not use Supabase Auth or Supabase Storage. TypeORM connects with `DATABASE_URL` from the host, over TLS (`DATABASE_SSL=true`).

The API process is a free Render web service. Put `DATABASE_URL`, `SESSION_SECRET`, and `FRONTEND_URL` in Render's environment, not in git. Set `TRUST_PROXY=true` there, because Render is the proxy in front of the process. `FRONTEND_URL` is the one public origin.

A free Supabase project can pause after about a week with no traffic. A free Render service sleeps after a period with no requests. The first request after a pause can fail until the database wakes up. `/api/v1/health` only means the process and the database answered at that moment.

No connection string is stored in this repository. None should be pasted into a pull request or a chat.

## What is left for the next milestone

Curriculum. Public class lists and class pages return published rows only. Drafts stay on the admin routes. Accounts, password reset mail, and invitations come after that.
