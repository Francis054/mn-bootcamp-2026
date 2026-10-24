# Backend architecture (Stage 1 plan)

**Status: plan only.** No backend code exists yet. This document describes the frontend that was inspected on branch `frontend` at commit `574b8db` (“Add the bootcamp frontend with auth and API boundaries”) and the backend shape proposed for later stages. It is not a description of running server code.

The owner must approve this plan before Stage 2. Nothing here authorises schema changes, dependency installs, or deployment.

## 1. Inspection record

Inspected on 24 Oct 2026 from a clean working tree on `frontend` (`git status` reported nothing to commit). Remote branches were fetched. `origin/backend` is an empty tree (commit `2dd4167`). There is no `backend/` directory and no server, ORM, or authentication implementation in this checkout.

### Read in full

- `README.md`, `.gitignore`
- `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/AUDIT.md`, `docs/research.md`
- `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/eslint.config.js`, `web/playwright.config.ts`, `web/index.html`
- `web/.env.example`, `web/.env.development`, `web/.env.production` (mode flags only; no secrets)
- `web/src/main.tsx`, `web/src/App.tsx`, `web/src/vite-env.d.ts`
- `web/src/config/env.ts`, `web/src/config/runtime.ts`
- `web/src/api/client.ts`, `web/src/api/liveTransport.ts`
- `web/src/auth/AuthProvider.tsx`
- `web/src/dev/transport.ts`, `web/src/dev/store.ts`, `web/src/dev/session.ts`, `web/src/dev/fixtures.ts`
- `web/src/domain/types.ts`, `permissions.ts`, `validate.ts`, `publish.ts`, `publicView.ts`, `format.ts`
- `web/src/hooks/useAsync.ts`, `web/src/hooks/useContent.ts`
- `web/src/layouts/AdminLayout.tsx`, `web/src/layouts/PublicLayout.tsx`
- `web/src/pages/admin/Editors.tsx`, `Lists.tsx`, `OverviewPage.tsx`, `SystemPages.tsx`
- `web/src/pages/auth/AuthPages.tsx`
- `web/src/pages/public/HomePage.tsx`, `ProgrammePages.tsx`, `CommunityPages.tsx`, `helpers.tsx`
- `web/src/components/Brand.tsx` (`Photo` and `Cover`)
- `web/tests/domain.test.ts`, `web/tests/screens.test.tsx`, `web/tests/transport.test.ts`
- `web/e2e/platform.spec.ts`
- `web/src/test/setup.ts`
- `js/data.js` lines 1–80 (prototype fixture catalogue). The React fixtures in `web/src/dev/fixtures.ts` are the models the API must serve.

### Enumerated, not read line by line

The static prototype at the repository root: 15 public HTML pages, 16 files under `admin/`, plus `design-system.html`, `motion-spec.html`, and `index-of-screens.html`. CSS in `css/tokens.css`, `css/components.css`, `css/pages.css`, `css/admin.css`. Behaviour in `js/components.js`, `js/motion.js`, `js/admin.js`. Assets under `assets/fonts`, `assets/img` (21 photo stems as 800/1600 WebP pairs), and `assets/logo`. Screen names were taken from `README.md`, which was read in full. `docs/AUDIT.md` describes this prototype and was read in full.

Tests were read. They were not executed in this run.

### Not present

No backend source, no database, no `.env` with secrets, no lockfile outside `web/package-lock.json`. `PublicLayout.tsx` was not re-read after the route map in `App.tsx`; public page behaviour comes from the page modules above.

## 2. What exists today

Two things share this branch. They are not a client and a server.

| Piece | Path | Role |
| --- | --- | --- |
| Static prototype | repository root (`index.html`, `admin/`, `css/`, `js/`, `assets/`) | Visual reference. Opens without a build. Not called by the React app except through shared CSS and image files. |
| React application | `web/` | Vite 7, React 19, React Router 7, TypeScript 5.9 (strict). This is the app the API must feed. |

`web/src/main.tsx` imports the prototype CSS from the parent directory:

```
../../css/tokens.css
../../css/components.css
../../css/pages.css
../../css/admin.css
```

`web/vite.config.ts` allows the dev server to read the parent directory (`server.fs.allow` includes `..`) so those imports work. `web/public/assets` is a symlink to `../../assets`. `Photo` in `web/src/components/Brand.tsx` always requests `/assets/img/{file}-800.webp` and `/assets/img/{file}-1600.webp`. It does not use a remote URL.

There is no `frontend/` directory and no `backend/` directory. The brief’s required layout is a later change. See `docs/backend-implementation-plan.md`.

### How a page gets data today

```
React page
  ├─ public reads and the admin overview
  │    useContent() / usePublicContent()
  │    → in-memory ContentState (web/src/dev/store.ts)
  │    → fixtures (web/src/dev/fixtures.ts)
  │
  └─ admin mutations, admin lists, login, contact form
       api() in web/src/api/client.ts
       → prefixes /api/v1
       → if VITE_API_MODE=live: liveTransport (fetch, credentials: include)
       → otherwise: devTransport (web/src/dev/transport.ts)
            same process, same memory, no HTTP, no database
```

`usePublicContent` (`web/src/hooks/useContent.ts`) filters with `isPubliclyListable` and strips private fields **in the browser**. The fixture module is in the client bundle. A production backend must do that filtering on the server and the client must stop shipping drafts. Switching `VITE_API_MODE` to `live` does **not** by itself move public pages onto HTTP: those pages never call `api()` for reads. Only the contact form does (`POST /public/enquiries`).

The development session lives in module memory (`web/src/dev/session.ts`). Reload signs the user out. `AuthProvider` does not call `GET /auth/session`. The route guard in `RequireAccess` is a navigation aid. `devTransport` re-checks the role on each protected call. That re-check disappears when the live transport is used, so the server has to enforce it.

### Environment

| Variable | Development file | Production file |
| --- | --- | --- |
| `VITE_API_MODE` | `development-adapter` | `development-adapter` |
| `VITE_API_BASE_URL` | empty | empty |
| `VITE_AUTH_MODE` | `development` | `disabled` |
| `VITE_DEV_SESSION_TTL_MS` | `1800000` (30 minutes) | same |

`VITE_AUTH_MODE=disabled` refuses to create a session. The production build still renders labelled fixtures from the in-memory adapter. It is not a live site.

Root `.gitignore` ignores `.env`, `.env.local`, `.env.*.local`, `node_modules/`, `dist/`, coverage, and Playwright output. It does **not** ignore `web/.env.development` or `web/.env.production`. Those two files are committed and contain only the flags above.

### Commands (from `web/package.json`)

`npm run dev` (port 5173, strict), `build` (tsc then Vite), `preview` (4173), `typecheck`, `lint`, `test` (Vitest, jsdom), `test:e2e` (Playwright, desktop 1440 and Pixel 5, axe on `main`). No `engines` field. This machine had Node `v22.23.4`.

### Git, as fetched this run

| Ref | Commit | Tree |
| --- | --- | --- |
| `frontend` and `origin/frontend` | `574b8db` | Prototype at repo root, plus `web/` and `docs/`. Parent is `4ccdc05`. |
| `origin/backend` | `2dd4167` | Empty. The commit deletes the prototype so work can live on other branches. |
| `origin/prototype` | `a3e29e1` | Static prototype moved under `prototype/`. |
| `origin/main` | `3cc42fa` | Merge of `2dd4167` and `a3e29e1`. Contains `prototype/` only. Not an empty tree. |
| Local `main` | `4ccdc05` | Stale. Behind `origin/main`. |

Do not push to `main`. A pull request from a `frontend`-based branch into `backend` will show the whole application, because `backend` has no files. That is called out in the implementation plan.

## 3. Domain the API must persist

Typed in `web/src/domain/types.ts` and filled by `web/src/dev/fixtures.ts`.

| Model | Fixture volume | Notes |
| --- | --- | --- |
| `ModuleInfo` | 6 constants | `network`, `ethical`, `vuln`, `forensics`, `awareness`, `incident`. Not stored in `ContentState`. Hard-coded in pages. |
| `PHASES` | 3 constants | Foundations / Find & analyse / Respond & protect. Also derived from week number (1–4, 5–8, else 3) inside `devTransport`. |
| `Lesson` | 12 weeks from 5 Oct 2026 | The admin calls these classes. Routes use `id`, not `slug`. |
| `Trainee` | 12 labelled samples | Email, LinkedIn, portfolio, consent, and notes are private. |
| `Project` | 6 samples | Repository URL, demo URL, share flag, and lab-only flag are private. |
| `BootcampEvent` | 6 | Four verified or source-backed, one sample midpoint, graduation date TBC. Body is a tagged object. |
| `MediaItem` | 21 photos | Albums `anniversary`, `hackathon`, `community`. Consent `verified` or `pending`. |
| `Milestone` | 7 | Anniversary timeline, including years marked “to be supplied”. |
| `AboutContent` | 1 | Mission, vision, values, address, email, website, `figuresPermission`. |
| `HomepageContent` | 1 | Copy, theme, one announcement banner, footer call to action. |
| `FoundationStat` | 4 constants | Not in `ContentState` and not in `docs/API.md`. Shown even when `figuresPermission` is false; the label changes. |
| `SiteSettings` | 1 | Site name, time zone, contact email, accent (stored, does not restyle), motion preference, three notification toggles. |
| `DevUser` | 3 fixtures | `viewer@example.test`, `editor@example.test`, `administrator@example.test`. `fixture: true` is a client marker, not a production column. |
| `EnquiryRecord` | none until submit | Stored in memory. `delivered` is always false. No admin screen reads them. |
| `SessionUser` / `DevSession` | memory | No password field anywhere. |

`FoundationStat`, `ModuleInfo`, and `PHASES` are imported from `@/dev/fixtures` by public pages. They will keep working after a backend exists until those imports are replaced. They are not evidence of missing endpoints unless the owner wants them editable.

Lesson “resources” (slides, lab PDF, recording) on the lesson page are disabled placeholders. They are not fields on `Lesson`. Trainer names are not a model. The lesson page says they stay unpublished until consent exists.

Calendar files (`.ics`) are built in the browser from event fields (`web/src/pages/public/helpers.tsx`). They are not an endpoint. `docs/API.md` says the same.

Hero facts on the home page (starts 5 Oct 2026, ends December 2026, free, Tantra Hills) and the contact cards (address, `mninfo@maximnyansa.com`, maximnyansa.com, maximnyansaapplications.com) are written into the components. The about record has the same address and email, but the contact page does not read it.

## 4. Proposed modules and dependencies

Backend root: `backend/` (after the layout change in the implementation plan). Stack, fixed by the brief: Node.js LTS, Express, TypeScript, PostgreSQL, TypeORM, class-validator, class-transformer, Swagger. No Prisma, no Sequelize, no automatic schema sync in production.

Runtime to pin in Stage 2: **Node.js 22 LTS or Node.js 24 LTS**. Checked against nodejs.org release posts dated 21 Oct 2026: `v22.23.4` is labelled LTS, `v24.22.1` (‘Krypton’) is labelled LTS, and `v26.12.1` was still labelled Current. Node 26 is announced to enter LTS in October 2026; re-check `https://nodejs.org/en/about/previous-releases` before pinning 26. This environment already runs Node 22, so Stage 2 should target 22 unless the owner prefers 24. Commit the npm lockfile. Set `engines`.

### Layout to implement in Stage 2

Adapted from the brief so names match this site. One feature folder per area the UI actually has. No extra layers.

```
backend/
  package.json
  package-lock.json
  tsconfig.json
  .env.example
  README.md
  src/
    main.ts                 # listen, after env validation
    app.ts                  # express app, no listen (tests import this)
    config/                 # env schema, cors, cookie, swagger
    database/
      data-source.ts
      migrations/
      seeds/
    shared/
      middleware/           # auth, csrf, rate limit, request log
      errors/               # one error shape
      validation/           # class-validator pipe
      http/                 # response helpers, pagination
    providers/
      email/                # interface + unconfigured adapter + Resend later
      storage/              # interface + unconfigured adapter + Cloudinary later
      sms/                  # interface only; unused by core flows
    composition/            # builds repositories, services, controllers
    modules/
      health/
      auth/
      users/
      curriculum/           # modules reference data + lessons (“classes”)
      trainees/
      projects/
      events/
      gallery/              # media metadata; bytes go to the storage provider
      content/              # homepage, about, milestones (singletons)
      settings/
      enquiries/
      audit/                # write path only until an admin screen exists
    openapi/
  tests/
    unit/
    integration/
```

The brief also lists `announcements/`. This UI has one homepage banner (`announcement` + `showAnnouncement`), not a feed. That banner belongs to `content` with the homepage singleton. A separate announcements module waits on the owner asking for a list. See the open questions.

### Dependency direction

```
HTTP request
  → router (module routes)
  → middleware (session, CSRF on cookie mutations, rate limit on login)
  → DTO validation (class-validator). Reject unknown fields on writes.
  → controller (status codes, response DTO)
  → service (rules: publication, consent, role changes, tokens)
  → repository (TypeORM only)
  → entity
  → PostgreSQL

services may call provider interfaces (email, storage)
services must not construct repositories
controllers must not contain rules or queries
repositories must not send email or talk to Cloudinary
```

Composition lives in `src/composition/`. A module exports a `register(container)` function. Tests build the same graph with a test database and fake providers.

Shared types worth mirroring, not importing from `web/` at runtime (the packages deploy separately):

- `Role`, `Permission`, `ROLE_PERMISSIONS` — copy the map and test it against the same matrix as `web/tests/domain.test.ts`.
- `PublicationStatus`, `Listing`, `isPubliclyListable` — same predicate, on the server.
- Public projections — same omissions as `web/src/domain/publicView.ts`.
- Error body — `{ error: { code, message, fieldErrors? } }` with the codes in `docs/API.md`.

Do not publish the frontend package as a dependency of the backend. Drift is checked by a small contract test, not by a shared build.

### Why each module exists

| Module | Problem it solves | Depends on |
| --- | --- | --- |
| `health` | Load balancer and deploy checks. `GET /api/v1/health` returns process status and, when asked, whether the database answers. No secrets. | config, data-source |
| `auth` | Administrator sign-in, logout, current user, password reset. No public registration. | users repository, email provider, session store |
| `users` | List fixtures-turned-accounts, change role, invite. | auth (actor), email provider |
| `curriculum` | Weekly classes and the six module names the filters use. | auth for writes |
| `trainees` | Profiles. Holds email and consent away from public responses. | auth |
| `projects` | Labs and capstones. Holds repository and demo URLs away from public responses. | auth |
| `events` | Milestones, anniversary events, the unconfirmed hackathon. | auth |
| `gallery` | Photo metadata and upload permissions. | auth, storage provider |
| `content` | Homepage, about, milestone order. One row each, replaced by PUT. | auth |
| `settings` | Site name and contact email. Administrator only. | auth |
| `enquiries` | Contact form. Validates, stores, and tries to email. `delivered` stays false when email is unconfigured. | email provider |
| `audit` | Who changed a record. Written by services that mutate. No public read. | auth |

`account` password change is a route on `auth` or `users`, matching `POST /admin/account/password`. It does not need its own module.

## 5. Entity relationships and ownership

Proposed tables. Stage 4 creates only the ones the approved milestone needs. Names below are the planned PostgreSQL tables.

```
users 1 ── * sessions
users 1 ── * password_reset_tokens
users 1 ── * audit_events

modules 1 ── * lessons
lessons.publication + listing

trainees  (skills as text[])
projects  (steps text[], tools text, team_names text[] until real people exist)
events    (body jsonb)

media_assets  (storage key, public url, album, consent)

homepage_content   (single row)
about_content      (single row, values text[])
milestones         (ordered by position)
site_settings      (single row)
enquiries
```

Primary keys: UUID. The React routes treat `id` as an opaque string (`/classes/:id`, `/events/hackathon`). Seeds for the six known events may keep the current string ids (`start`, `hackathon`, `reception`, `durbar`, `midpoint`, `graduation`) so links in the fixtures survive. New records get UUIDs. Do not assume numeric ids; the editor loads whatever string the list returns.

Timestamps: `created_at`, `updated_at` on every mutable table. Lessons already expose `updatedAt`.

### Publication

Columns on lessons, trainees, projects, events, and media:

- `publication_status`: `draft | in_review | scheduled | published`
- `listing`: `hidden | sample | public`

Server predicate, copied from `web/src/domain/publish.ts`:

- `hidden` → never public
- `sample` → public, and the UI labels it as a sample
- `public` → public only when status is `published` or `scheduled`

This matches the current site. The Stage 6 sentence in the brief (“only published content”) is stricter and would hide sample drafts that the site shows today. Do not change the predicate until the owner picks one. The question is in the plan.

Deletes: default to hard delete, because the admin Delete buttons remove the row and the adapter does the same. Prefer `ON DELETE RESTRICT` from audit rows (keep the audit, null the actor if the user goes). Media delete must also call the storage provider. If the provider delete fails, keep the database row and return an error so the UI can retry. Do not leave an orphan URL as the only copy without recording the failure.

### Ownership and private fields

| Data | Who may write | Who may read |
| --- | --- | --- |
| Lessons, projects, events, homepage, about, milestones | `content.write` (editor, administrator) | Public projection if listable. Admin gets internal notes. |
| Media bytes and metadata | `media.write` | Public gallery gets the public media DTO. Pending consent may still show, because the gallery caption prints “consent record pending”. |
| Trainee email, LinkedIn, portfolio, `consentReceived`, internal notes | `content.write` | Admin only. Public trainee omits them (`toPublicTrainee`). |
| Project `repositoryUrl`, `demoUrl`, `shareAgreed`, `labOnlyConfirmed`, notes | `content.write` | Admin only. Public project omits them even when `shareAgreed` is true. |
| Users and roles | `users.manage` to change; `users.read` to list | Administrators. A user may read their own account. |
| Settings | `settings.manage` | Administrators. |
| Enquiries | public create | No admin reader yet. Treat the table as private. |
| Password hashes, session ids, reset token hashes | server only | Never in a response, log, or audit payload. |
| Audit rows | server writes | Proposed admin read later. Not in the current UI. |

`listing: public` on a trainee is forced back to `sample` when `consentReceived` is false (`traineeBody` in `devTransport`). The backend service must keep that rule. The client checkbox is not the control.

An administrator cannot demote their own account (`patchUser`). Keep that rule so the last administrator cannot lock the site out from this screen. Provisioning a second administrator is an operational requirement.

### Reference data that is not a table yet

Modules, phases, foundation stats, enquiry topics, project types, trainee tracks, and event kinds are unions or string lists in the client. Stage 2 can store the closed sets as Postgres enums or as check constraints:

- event kind: `Milestone | Anniversary | Partner event`
- project type: `Lab | CTF | Case study | Community project | Capstone`
- trainee track: the form offers Blue team, Red team, General. The fixtures use Blue team, Red team, and **GRC & awareness**. The plan asks which list is real.
- module id: the six ids above

Putting modules in a table is useful once an editor can rename them. Until then a seed plus a check constraint is enough, and the pages can keep the local catalogue. Flagged as a question.

### Lesson resources and trainers

Not in the typed model. The lesson page shows three disabled resource rows and a trainer placeholder. Do not invent those tables in the first migration. Add them only if the owner wants uploads of slides and a people directory.

## 6. Authentication and authorization

### What the client expects

`docs/API.md` and `web/src/api/liveTransport.ts`:

- Session cookie: HttpOnly, so JavaScript never reads it. `credentials: 'include'` on every live request.
- CSRF cookie: name `mn_csrf`, **not** HttpOnly. The client copies it into `X-CSRF-Token` when present.
- Login body today: `{ email, password, developmentAck: true }`. `developmentAck` is a development-only checkbox. Production `LoginDto` must not require it. The login page must stop sending it when `VITE_AUTH_MODE` is no longer `development` (frontend milestone, not Stage 2).
- `GET /auth/session` returns the current user or an unauthenticated payload. The React app does not call it yet. After cutover, `AuthProvider` has to, because memory will be empty on reload.
- `POST /auth/session/expire` is a development helper (`AccountPage`). Do not expose it in production.

### Server design

- No public registration route.
- First administrator: a seed or CLI that reads `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` from the environment, hashes the password, and refuses to run if those are missing. The password is never committed and never printed back. Document the command in `backend/README.md` when it exists.
- Password hashing: Argon2id (preferred; a maintained `argon2` binding). bcrypt is the fallback only if Argon2id cannot build on the chosen Node image. Cost parameters go in config, not in the hash call scattered through services.
- Sessions: random session id, hash stored in `sessions`, cookie holds the raw id. Cookie flags: `HttpOnly`, `Secure` outside local HTTP, `SameSite=Lax` when the site is one origin, `SameSite=None; Secure` only if the API host and the Vite host differ. Idle and absolute expiry. Logout deletes the row. Password reset deletes all sessions for that user.
- CSRF: double-submit cookie on every cookie-authenticated mutation (`POST`, `PUT`, `PATCH`, `DELETE`). Safe methods do not need it. Compare the header to the cookie with a constant-time check. Reject missing or mismatched tokens with `403` and code `forbidden`.
- Login rate limit: the adapter locks an email after 5 failures for 60 seconds. Production should limit by IP and by email, store counters outside process memory if more than one instance runs, and return the same `unauthenticated` message whether the email exists or the password is wrong. The adapter currently says “No development fixture matches that email” and names the three fixture addresses. That message must not ship.
- Password reset: `POST /auth/password-reset/request` always returns the same accepted body. It must not return `developmentResetPath` or a token. Email a single-use, expiring link (the adapter uses 15 minutes; keep a short TTL, configurable). Store a hash of the token. `POST /auth/password-reset/complete` does not echo the password. If email is unconfigured, the request still returns the generic body and writes nothing that would reveal the account; log a local warning that delivery did not happen, without the address if the log line would be public.
- Authorization: a middleware loads the session user and a second check calls the same permission map as `web/src/domain/permissions.ts`.

| Role | Permissions |
| --- | --- |
| viewer | `content.read`, `account.manage` |
| editor | viewer + `content.write`, `media.write` |
| administrator | editor + `users.read`, `users.manage`, `settings.manage` |

Every `/admin/*` route requires a session. Writes require the specific permission, not merely “logged in”. `GET /admin/settings` requires `settings.manage`. `GET /admin/users` requires `users.read`. The adapter also requires `content.read` before those checks; every current role has `content.read`, so the extra gate is redundant but harmless. Keep it so a future role without `content.read` cannot stumble into admin lists.

Frontend route guards stay. They are not the security boundary.

### Error contract

From `docs/API.md`, confirmed by `liveTransport.parseApiResponse` and `ApiError`:

| HTTP | `error.code` |
| --- | --- |
| 422 (and 400 from the client mapper) | `validation` |
| 401 | `unauthenticated` |
| 403 | `forbidden` |
| 404 | `not_found` |
| 429 | `rate_limited` |
| 500 | `server` |
| 501 | `pending` |

Body:

```json
{ "error": { "code": "validation", "message": "Check the highlighted fields.", "fieldErrors": { "title": "Give the class a title." } } }
```

`pending` / 501 is for features that are deliberately unconfigured (email not set, password change before a credential store). Once auth exists, password change returns 204 or 200, not 501. Invite returns `delivered: false` with 200 while email is unconfigured, matching the client toast, and 201 plus `delivered: true` when a message was accepted by the provider.

## 7. Endpoint inventory (grouped)

Full reconciliation, including paths the UI does not call yet, is in `docs/backend-implementation-plan.md`. Count of the contract already implemented inside `devTransport`: **57** handlers under `/api/v1`. One addition is required for operations and is not in the contract: `GET /api/v1/health`.

| Group | Methods and paths | Permission |
| --- | --- | --- |
| Health | `GET /health` | public |
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/session`, `POST /auth/password-reset/request`, `POST /auth/password-reset/complete` | public or session. Drop `POST /auth/session/expire` outside development. |
| Public reads | `GET /public/home`, `/public/about`, `/public/milestones`, `/public/classes`, `/public/classes/:id`, and the same for trainees, projects, events, plus `GET /public/media` | none. Server applies `isPubliclyListable` and the public DTO. |
| Public write | `POST /public/enquiries` | none. Rate limit. |
| Admin collections | `GET/POST /admin/{classes,trainees,projects,events}`, `PATCH/DELETE /admin/{resource}/:id`, `POST /admin/{resource}/bulk` | read: `content.read`. write and bulk: `content.write`. Bulk body `{ ids, action }` with `publish` or `delete`. |
| Media | `GET/POST /admin/media`, `PATCH/DELETE /admin/media/:id` | read: `content.read`. write: `media.write`. |
| Singletons | `GET/PUT /admin/home`, `/admin/about`, `/admin/milestones`, `/admin/settings` | content paths: `content.write` to PUT. Settings: `settings.manage` for GET and PUT. |
| Users | `GET /admin/users`, `PATCH /admin/users/:id` `{ role }`, `POST /admin/users/invite` | read vs `users.manage` |
| Account | `GET /admin/account`, `POST /admin/account/password` | `account.manage` |
| Search | `GET /admin/search?q=` | `content.read`. Cap results (adapter returns 8). |

Admin list responses are `{ items, page, pageSize, total }`. Query keys the client sends: `q`, `page`, `pageSize`, `sort`, `dir`, and `filters` encoded as `filters.moduleId` (see `liveTransport`, which writes `filters.${inner}`). Allowlist `sort` per resource. The adapter sorts on any object key; the server must not.

Public lists are bare arrays in the adapter, not pages. Keep that until the frontend is ready for pages. Media `GET /admin/media` is also a bare array. The other admin lists are pages.

There is no `GET /admin/classes/:id`. Editors call `GET /admin/classes?pageSize=100` and find the id in the page (`useEditorRecord`). That breaks past 100 rows. The plan adds `GET /admin/{resource}/:id` as a compatible extra and asks the owner to allow a small frontend change to use it.

## 8. Media storage

Two kinds of image, and they should stay distinct.

1. **Bundled event photos.** Twenty-one stems, each as `-800.webp` and `-1600.webp`, under `assets/img/`. `Photo` builds those URLs itself. They are design assets, already in git. Leave them on the static host. Seed `media_assets` rows that point at `/assets/img/{file}-800.webp` (or the 1600 original) with `storage_provider = 'static'`. Deleting a seeded row removes metadata only, not the file in git.
2. **Future uploads** from `MediaPage`. Today the browser keeps a `blob:` URL and posts JSON metadata. Nothing is stored. The backend must not write uploads to the API disk (Render’s free filesystem is wiped on spin-down and redeploy; this is in the plan’s free-tier section).

Upload flow to build behind `StorageProvider`:

```
editor (media.write)
  → POST /admin/media  (multipart, or a signed upload the provider hosts)
  → validate mime (jpeg, png, webp) and size (propose 5 MB until the owner sets one)
  → storage.put() returns { key, publicUrl, width, height }
  → repository saves metadata
  → response is the admin media DTO

delete
  → storage.delete(key) then repository delete, or the reverse with a recorded failure
```

New uploads start as the adapter does: `consent = pending`, `publication_status = draft`, `listing = hidden`. The adapter’s `PATCH` can then mark consent verified and flip listing to `sample` and status to `published`. The React media page does **not** call that PATCH today; it only posts and deletes. Consent review is a backend capability waiting for a button. Do not auto-publish real uploads the way the adapter’s PATCH does, until the owner confirms. The safer rule: verifying consent does not by itself publish. Flagged as a question because it changes adapter behaviour.

Public media DTO should include what the gallery renders: `id`, `file`, `src`, `width`, `height`, `caption`, `alt`, `album`, `consent`. `Photo` ignores `src` and uses `file` to build a local path. Cloudinary URLs will not appear until `Photo` (and the admin card) accept an absolute `src`. That is a frontend change in the gallery milestone, not a reason to store binaries in Postgres.

Alt text is required. The form says not to name people. The service can reject empty alt text. It cannot reliably detect names; that stays an editorial rule.

## 9. Security requirements (design)

- Validate every write with a DTO. Create and update are separate classes. `@IsOptional()` on update only where a partial PATCH is intended. The current admin forms send a full body on PATCH; either accept full replacement or document partial updates. Recommend full-body PATCH matching the forms, and ignore fields the form does not send only when the service merges onto the existing row (the adapter does merge).
- Strip unknown properties (`whitelist` + `forbidNonWhitelisted`) so a client cannot post `role` onto a trainee or `publicationStatus` onto a public enquiry.
- Public routes never select password, email of a trainee, internal notes, reset tokens, or session hashes.
- Do not log request bodies on `/auth/login`, `/auth/password-reset/complete`, or `/admin/account/password`.
- CORS: allow the configured `FRONTEND_URL` only, with credentials. Reject `*`.
- Helmet-style headers, JSON body limit (for example 1 MB; uploads go through the storage provider, not the JSON parser).
- Trust proxy only when deployed behind Render’s proxy, so rate limits see the client IP.
- `synchronize: false` in TypeORM. Migrations only. Production boot fails if `DATABASE_URL` or the session secret is missing.
- Secrets in the host’s environment, never in git. `.env.example` lists names.
- Enquiry and login endpoints are rate limited.
- Admin search queries the database with parameters, not string-concatenated SQL.
- Dependency review when the lockfile is added. No new GitHub Action is required by this plan; the owner can ask for one.

Offensive lab content: project and lesson copy is educational and must stay scoped to an isolated lab. The API stores text the editors write. It does not add exploit procedures. Editors remain responsible for what they publish. The public project page already says repository links stay off the page.

## 10. What this plan deliberately does not decide

Those items are questions in `docs/backend-implementation-plan.md`: publication strictness versus the sample listing, track names, whether `shareAgreed` reveals URLs, whether consent auto-publishes media, modules-as-a-table, lesson file attachments, an enquiry inbox, SMS, and the day the directories move.
