# Bootcamp API

This folder is the HTTP API for the Maxim Nyansa 2026 Cybersecurity Bootcamp. On the `dev` branch the website is the sibling folder `frontend/`. Run the API from `backend/`.

The process starts, checks its configuration, and connects to PostgreSQL. It answers `GET /api/v1/health`, it can sign an administrator in, and it serves the curriculum: tracks, modules, phases, and classes. There is no public registration page.

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

API docs are at `http://127.0.0.1:3000/api/docs`. The raw document is `/api/docs/openapi.json`. It lists health, sign-in, the session check, and the curriculum routes. The administrator command and the sample seed are not HTTP routes, so they are not in that document.

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

`src/database/migrations/1792800000000-Baseline.ts` is the first migration. It creates no tables. It marks the start of the history. `1792868400000-Auth.ts` adds `users`, `sessions`, `login_throttles`, and `audit_events`. `1792886400000-Curriculum.ts` adds `tracks`, `modules`, `phases`, and `lessons`, and it extends the audit table with the curriculum actions. New migrations are new files, and each class is registered in `src/database/data-source.ts`.

`src/database/cli-data-source.ts` is what the migration commands load. They read the same environment as the server.

```bash
npm run migration:run     # apply new migrations
npm run migration:show    # list what is applied
npm run migration:revert  # undo the last migration
```

Run those against the database in `DATABASE_URL`. They do not choose a database by themselves.

`src/shared/persistence/base-repository.ts` is the pattern the account and session repositories extend. A repository is given a TypeORM repository. It does not open a connection.

## Keep the free service awake

`scripts/keep-alive.mjs` sends one GET to the public health URL in `KEEPALIVE_URL` and logs the HTTP status and how long it took. It never prints a query string, a password, or a token. If `KEEPALIVE_URL` is unset, it says so and exits 0, so the job can exist before the site is deployed. The GitHub Actions workflow at the repository root, `.github/workflows/keep-alive.yml`, runs that script every 14 minutes. GitHub runs that schedule only from the repository default branch. The setup steps are in the deploy checklist on `dev`.

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
| `npm run seed`         | Insert the labelled sample curriculum.        |

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

New photo uploads use Cloudinary when `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are all set on the host. The cloud name for this project is `i5rrintk`. Leave those three lines blank in `.env.example`. Do not commit the key or the secret. Development and the tests keep uploads in memory, so the test suite does not call Cloudinary. If production starts without those three variables, the process still boots and an upload is refused. This milestone does not rewrite image bytes to remove EXIF. The plan does not ask for that.

Mail uses Resend when `RESEND_API_KEY` and `EMAIL_FROM` are both set. Leave both lines blank in `.env.example`. Do not commit a key or a from address. Development and the tests keep messages in memory, so the test suite does not call Resend. If production starts with neither variable, the process still boots and a message is reported as not sent. Set both, or leave both blank. The plan leaves text messages unselected, so this API does not send SMS.

A free Supabase project can pause after about a week with no traffic. A free Render service sleeps after a period with no requests. The first request after a pause can fail until the database wakes up. `/api/v1/health` only means the process and the database answered at that moment.

No connection string is stored in this repository. None should be pasted into a pull request or a chat.

## Classes, modules, phases, and tracks

The public site and the admin site do not see the same rows.

- `GET /api/v1/public/classes` and `GET /api/v1/public/classes/:id` return a lesson only when its workflow is `published` and its listing is not `hidden`. A draft, a row in review, and a scheduled row are not on the public site, even if the listing says `sample`. The same rule applies to tracks, modules, and phases.
- `GET /api/v1/admin/classes` returns every lesson, including drafts and the private notes. A viewer can read it. An editor and an administrator can change it. The website calls that permission `content.write`. Publishing and deleting use that same permission. There is no separate publish permission in the website's map, so this API does not invent one.
- A change (create, edit, publish, unpublish, delete) needs the session cookie and the matching `X-CSRF-Token` header. The audit row stores the action and the row id. It does not store the class notes.
- Publish does not change the listing. A hidden class can be marked published and still stay off the public site until an editor sets the listing to `sample` or `public`.
- The class list accepts `q`, `page`, `pageSize`, `sort`, `dir`, and `filters.moduleId`. Week sorts as a number. The default sort is week, oldest first.
- `scheduleStatus` (`done`, `now`, `upcoming`) is worked out from the class date and today's date in Africa/Accra. It is not a column.
- Tracks are `Blue team`, `Red team`, and `GRC & Awareness`. That third name is the spelling later trainee rows should use.

Load the labelled sample, after the migrations, with:

```bash
npm run seed
```

Run it again and it does nothing to rows that are already there. It will not overwrite an edit. The sample text says it is a sample. It does not include foundation-wide counters, and it does not use real people's names. Do not run it against the production database.

Modules and phases are editable on the admin routes (`/api/v1/admin/modules` and `/api/v1/admin/phases`). Foundation-wide counters stay for the settings milestone. They are not stored here.

## Trainees

A public profile is a row whose workflow is `published`, whose listing is `sample` or `public`, and whose `consentReceived` is true. Drafts, rows in review, scheduled rows, and hidden rows stay on the admin routes. The same is true of a published row that does not have consent.

`GET /api/v1/public/trainees` returns the public profile: the display name, initials, colour, track, focus, skills, biography, quote, listing, workflow, and status label. The email, LinkedIn link, portfolio link, internal notes, consent flag, and consent timestamps stay on the admin response.

The track is `Blue team`, `Red team`, or `GRC & Awareness`. `General` and `GRC & awareness` are rejected.

An editor and an administrator both change profiles, including publish and delete. That is the website's `content.write` permission. A viewer can read the admin list. A change needs the session cookie and the matching `X-CSRF-Token` header.

Publish does not change the listing. A hidden profile can be marked published and still stay off the public site. Publish is rejected while consent is false. Clearing consent sets the workflow back to draft in that same save, so the profile leaves the public site immediately. The admin row keeps when consent was recorded, which account recorded it, and when it was withdrawn. The audit row stores the action and the profile id. It does not store the name, the email, the links, or the notes.

The trainee list has no bulk action. The class list is the one that publishes or deletes a selection. The admin list is a page. Search matches the display name, the track, and the skills. `filters.track` and `filters.focus` use the same dot form as the class filters.

`npm run seed` also inserts twelve labelled profiles, `Sample Trainee 01` through `Sample Trainee 12`, with addresses at `example.test`. Their workflow is published and their consent is false, so the public list does not include them. Run the command again and it leaves an edited row alone.

## Projects

A public project is a row whose workflow is `published` and whose listing is not `hidden`. Drafts, rows in review, scheduled rows, and hidden rows stay on the admin routes. A sample label does not put a draft on the public site.

`GET /api/v1/public/projects` returns the title, slug, type, module, cover, image, abstract, tools, steps, team names, listing, and workflow. The internal notes, the lab-only checkbox, and the form's share checkbox stay on the admin response. The code link and the demo link are included only when the project is published, the listing is not hidden, and every linked trainee has `linksShareConsent` set to true. If no trainee is linked, those links stay off. If one linked trainee withdraws that agreement, both links leave the public response on the next read. The project itself stays published. Withdrawing link consent does not unpublish the trainee profile.

`shareAgreed` is stored so the current form can round-trip. It does not publish the links. The agreement that does is `linksShareConsent` on the trainee.

A link has to be `https`, with no password in the address, and it cannot point at a private or loopback host. `javascript:` and `data:` are refused. The limit is 500 characters. A GitHub repository link is checked with one unauthenticated request. If that request is not a 200, the code link stays off the public page. The admin project then carries `repositoryLinkNote`. Demo links are not fetched. The admin list does not run that check.

Publish does not change the listing and does not record link consent. An editor and an administrator both change projects, including publish and delete. That is the website's `content.write` permission. A viewer can read the admin list. A change needs the session cookie and the matching `X-CSRF-Token` header. The audit row stores the action and the project id. It does not store the title, the links, the team names, or the notes.

The project list has no bulk action. Search matches the title and the type. `filters.type` uses the same dot form as the class filters.

`npm run seed` also inserts six labelled projects. Their workflow is `in_review` or `draft`, their links are blank, and the linked sample trainees have not agreed to share links, so the public list does not include them. Run the command again and it leaves an edited row alone.

A module that still has projects cannot be deleted until those projects are moved or deleted. A trainee who is still listed on a project cannot be deleted until they are removed from the project.

## Events

A public event is a row whose workflow is `published` and whose listing is not `hidden`. A row whose workflow is `scheduled` stays off the public routes until its start. Drafts, rows in review, and hidden rows stay on the admin routes. A sample label does not put a draft on the public site.

The start and end are a clock on the event's calendar day. Ghana does not use daylight saving, so Africa/Accra wall time is UTC. `17:00` is 17:00 UTC. An empty start means midnight on that date. The end, when it is set, has to be later the same day. A date marked `dateTbc` has no confirmed clock, so the times stay blank and a scheduled row with that flag does not appear on its own.

`GET /api/v1/public/events` returns the same fields the website shows, including the body, the source, and the anniversary flag. The internal notes stay on the admin response. There is no calendar-file route. The browser builds an `.ics` file from these fields.

Marking an event verified requires a public `https` source link. Publishing does not change the listing and does not turn a to-be-confirmed date into a confirmed one. An editor and an administrator both change events, including publish and delete. That is the website's `content.write` permission. A viewer can read the admin list. A change needs the session cookie and the matching `X-CSRF-Token` header. The audit row stores the action and the event id. It does not store the title, the place, the source, the body, or the notes.

The event list has no bulk action. Search matches the title and the place. `filters.kind` and `filters.verification` use the same dot form as the class filters. The default sort is the date, oldest first.

`npm run seed` also inserts six labelled events. Each internal note starts with `Sample event.` The hackathon stays to be confirmed: `dateTbc` is true, the place is `Venue to be confirmed`, and the start and end are blank. The seed does not invent a clock or a venue for it. The midpoint is a sample milestone with workflow `scheduled`, so it stays off the public list until 16 Nov 2026. Run the command again and it leaves an edited row alone.

## Gallery

A public photo is a row whose workflow is `published`, whose listing is not `hidden`, and whose consent is `verified`. Drafts, pending consent, withdrawn consent, and hidden rows stay on the admin routes. A sample label does not put a draft on the public site. Marking consent verified does not publish the photo. Publish is a separate step, and it is refused until consent is already verified. Sending both in one edit is refused.

`GET /api/v1/public/media` returns the id, file, src, width, height, caption, alt, and album. It leaves out the listing, the workflow, consent, and the storage key. The admin list is an array, not a page. Album filters stay in the browser.

A JSON create starts as pending, draft, and hidden, with an empty src. A file upload is sniffed as JPEG, PNG, or WebP. The file name and the part's content type are not trusted. The stored file label is `upload`, so an original name is not kept. The size cap is `UPLOAD_MAX_BYTES`. It is 5 MB unless the host sets another whole number up to 10 MB.

`POST /api/v1/admin/media/:id/withdraw-consent` sets consent to withdrawn, returns the workflow to draft, hides the listing, clears src, and deletes an uploaded object from storage. A static seed row has no uploaded object, so withdrawal only clears the metadata. If storage cannot delete the object, the photo is already off the public site and the key is kept so the request can be tried again. The audit row stores the action and the photo id. It does not store the alt text, the caption, the address, or the file bytes.

An editor and an administrator both change photos. That is the website's `media.write` permission. A viewer can read the admin list. A change needs the session cookie and the matching `X-CSRF-Token` header. There is no media bulk action.

`npm run seed` also inserts three labelled placeholders: `sample-banner`, `sample-bench`, and `sample-mark`. They are drawings and banners, not photographs of people. Consent is pending and the workflow is draft, so the public gallery does not include them. Run the command again and it leaves an edited row alone.

## Homepage, about, timeline, and settings

A public page is the last published copy. Editors read the draft on the admin routes. Saving an edit does not publish. Publish copies the draft. A later edit stays in the draft until the next publish. Unpublish takes the public copy down and leaves the draft.

The homepage includes the announcement banner: `announcement` and `showAnnouncement`. There is no separate announcements list. The about page keeps its address, email, and website when a save omits them. `figuresPermission` records display permission for the counters. It does not publish them.

The timeline is one list. `PUT /api/v1/admin/milestones` takes `{ milestones }` and stores that order. The public list is empty until publish.

Foundation counters live on settings. Only an administrator can read or change settings. That permission is `settings.manage`. An editor can change the homepage, the about page, and the timeline with `content.write`. A viewer can read those drafts and cannot open settings. A change needs the session cookie and the matching `X-CSRF-Token` header. The audit row stores the action and the document id. It does not store the headline, the mission, the contact email, or the counter labels.

`GET /api/v1/public/foundation-stats` returns the published counters. Until settings are published it returns an empty array. The contact email is not on that response.

`npm run seed` inserts the homepage, the about page, three timeline rows, and settings, all as drafts. The counters are labelled `Sample counter` and the value is `0`. The seed does not invent foundation-wide totals. Run the command again and it leaves an edited row alone. The settings draft includes the public contact address, which the enquiry notification uses. The seed does not insert enquiries.

## Accounts and mail

A signed-in person changes their password with `POST /api/v1/admin/account/password`. The body is `{ current, next, confirm }`. The current password is checked again. Other sessions for that account are signed out. This session stays. The new password uses the same 12-character rule as `npm run admin:create`: at least one letter and one number, and not the mailbox. The website form still says 8 characters. This API does not store a shorter password.

`POST /api/v1/auth/password-reset/request` answers with the same JSON whether or not the mailbox exists. It does not return a link. A real account gets one email, through the mail provider. The link lasts 15 minutes. The token in that link is random. The database stores a hash of it, and the row is single-use. `POST /api/v1/auth/password-reset/complete` writes the new hash and signs every session for that account out. `passwordStored` is true only when that hash was written. A password the rules reject does not use the link up. A missing, used, or expired link all return `This reset link is missing, used or expired.`

Reset requests are limited with the same counters as a failed sign-in. The lock message does not say whether the mailbox exists. A badly formed address is `422` and also does not say whether an account exists.

An administrator invites with `POST /api/v1/admin/users/invite` and a body `{ email, role }`. The role is `viewer`, `editor`, or `administrator`, and it is required. The current website form sends only an email, so that form is rejected until it sends a role. The account is created immediately. The invitation link uses the same complete-reset route and lasts 24 hours. `delivered` is true only when the provider accepted the message. If mail is not configured, the account still exists and the response says no email was sent. A second invite for the same mailbox is `422` and does not repeat the address.

`GET /api/v1/admin/users` is a list. Only an administrator can read it (`users.read`). `PATCH /api/v1/admin/users/:id` changes the role (`users.manage`). An administrator cannot remove their own administrator role from the session they are using. The new role is read from the database on the next request.

The contact form is `POST /api/v1/public/enquiries`. It checks the name, the email, one of the four topics, a message of at least 20 characters, and the consent tick. It does not use a captcha service. A non-empty `company` field is ignored as spam: the response looks like success, and nothing is stored or emailed. Posts from one address are rate-limited. The response `message` is a status sentence. It is not a copy of what the person wrote. When settings have a contact email and mail is configured, a notification is sent there. If that send fails, or mail is not configured, the enquiry is still saved and `delivered` is false.

`GET /api/v1/admin/enquiries` lists those rows for an administrator (`users.manage`). A viewer or an editor cannot read them. `PATCH` sets `handled`. `DELETE` removes the row. A change needs the session cookie and `X-CSRF-Token`. A public post with no session cookie does not.

The audit row stores the action and the account id or the enquiry id. It does not store a mailbox, a token, a password, or the message text.

## What is left

`POST /api/v1/auth/session/expire` and `GET /api/v1/admin/search` are still not implemented. The plan's next milestone is the public cutover on the website, then the deployment notes. This API does not start that work. Text messages stay off.
