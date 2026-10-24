# Backend implementation plan (Stage 1)

**Status: awaiting the owner’s review.** This run does not add `backend/` code, does not move `web/`, and does not deploy anything. The design it refers to is `docs/backend-architecture.md`.

Approved work after this plan lands one milestone at a time, in the order below. Each milestone gets its own small commits, tests, and a note of what is still fake.

## 1. Screen-to-API mapping

Public pages read `usePublicContent()` (in-memory) unless the table says `api()`. Admin lists and editors use `api()`. The admin overview reads the store directly and will need a small client change when the store is removed.

| Screen | Route | Data today | API to call after cutover |
| --- | --- | --- | --- |
| Home | `/` | Homepage copy, lessons, projects, trainees, events from the store. Modules, phases, hero dates, and foundation-stat aside are constants. | `GET /public/home`, `/public/classes`, `/public/projects`, `/public/trainees`, `/public/events`. Constants stay until the owner wants them editable. |
| Bootcamp | `/bootcamp` | `MODULES` constant. | No collection endpoint required. Optional later: `GET /public/modules`. |
| Journey | `/journey` | `PHASES` constant plus lessons and events. | `GET /public/classes`, `GET /public/events`. |
| Class archive | `/classes` | Public lessons, filtered in the browser. | `GET /public/classes`. |
| Lesson | `/classes/:id` | One public lesson. Resources and trainer are placeholders. | `GET /public/classes/:id`. |
| Projects | `/projects` | Public projects. | `GET /public/projects`. |
| Project | `/projects/:id` | Public project. Links are not rendered. | `GET /public/projects/:id`. |
| Trainees | `/trainees` | Public trainees. | `GET /public/trainees`. |
| Trainee | `/trainees/:id` | Public trainee plus related projects. | `GET /public/trainees/:id` and `/public/projects`. |
| Events | `/events` | Public events. Past/upcoming is computed with `APP_TODAY` (24 Oct 2026 UTC). | `GET /public/events`. Server should compute schedule fields in `Africa/Accra` or return the raw date and let the client keep the clock. See questions. |
| Event | `/events/:id` | Public event. `.ics` built in the browser when `calendarDownload` is set. | `GET /public/events/:id`. No calendar endpoint. |
| Gallery | `/gallery` | Public media. Caption shows pending consent. | `GET /public/media`. |
| About | `/about` | About, milestones, and hardcoded `FOUNDATION_STATS`. | `GET /public/about`, `GET /public/milestones`. |
| Anniversary | `/anniversary` | Events with `showOnAnniversary`, anniversary album. Narrative copy is hardcoded. | `GET /public/events`, `GET /public/media`. |
| Contact | `/contact` | Address cards are hardcoded. Submit calls the API. | `POST /public/enquiries`. |
| Not found | `*` | Static. | None. |
| Sign in | `/admin/login` | `POST /auth/login`. | Same. Stop requiring `developmentAck` in production. |
| Forgot password | `/admin/forgot-password` | `POST /auth/password-reset/request`. Shows `developmentResetPath` when present. | Same path. Production body has no token and no path. |
| Reset password | `/admin/reset-password` | `POST /auth/password-reset/complete`. | Same. |
| Session expired | `/admin/session-expired` | Static page. | None. Expiry comes from `GET /auth/session` and 401s. |
| Forbidden | `/admin/forbidden` | Static page. | None. API returns 403. |
| Overview | `/admin` | Store counts. Activity list is a placeholder. | `GET /admin/classes`, `/admin/trainees`, `/admin/events`, `/admin/media` or one summary endpoint if the owner wants to avoid four calls. Default: reuse the lists. |
| Class list | `/admin/classes` | `GET /admin/classes` with `q`, `page`, `pageSize` 8, `sort=week`, `dir=asc`, `filters.moduleId`, `filters.scheduleStatus`. Bulk publish/delete. | Same. |
| Class editor | `/admin/classes/new`, `/admin/classes/:id` | List with `pageSize=100`, then `POST` or `PATCH`, `DELETE`. | Add `GET /admin/classes/:id` and switch the editor to it. |
| Trainee list / editor | `/admin/trainees...` | Same pattern. List filters are only `q` in the UI. Adapter also accepts `filters.track` and `filters.focus`. No bulk bar in the UI. | Same paths. Bulk may stay for API completeness. |
| Project list / editor | `/admin/projects...` | `GET` with `q`. Adapter also filters `filters.type`. | Same. |
| Event list / editor | `/admin/events...` | `GET` with `q` and `filters.kind`. Adapter also filters `filters.verification`. | Same. |
| Media | `/admin/media` | `GET /admin/media`, `POST /admin/media` (JSON, no bytes), `DELETE`. Album filter is client-side. | Same, plus real upload. `PATCH` exists in the adapter and is unused by the page. |
| Content editor | `/admin/content` | `GET/PUT /admin/home`. | Same. |
| Timeline | `/admin/timeline` | `GET/PUT /admin/milestones` with `{ milestones }`. Reorder only. The form does not edit titles. | Same. |
| About editor | `/admin/about` | `GET/PUT /admin/about`. Does not submit address, email, or website (it spreads the previous record). | Same. Service must not blank omitted address fields. |
| Users | `/admin/users` | `GET /admin/users`, `PATCH /admin/users/:id`, `POST /admin/users/invite`. | Same. |
| Settings | `/admin/settings` | `GET/PUT /admin/settings`. | Same. |
| Account | `/admin/account` | `POST /admin/account/password` (always 501 today). Button calls `POST /auth/session/expire`. | Password route becomes real. Expire route stays development-only. |
| UI states | `/admin/states` | Local components. | None. |
| Search box | admin top bar | `GET /admin/search?q=` | Same. |
| Sign out | account menu | `POST /auth/logout` | Same. |
| Notifications bell | admin top bar | Local component state. Not saved. | None, unless the owner wants real notices. Settings toggles are stored and unused. |

`GET /auth/session` is implemented in the adapter and documented in `docs/API.md`. No page calls it. The live `AuthProvider` must.

## 2. Endpoint inventory and reconciliation

Base path `/api/v1`. **57** handlers exist in `web/src/dev/transport.ts` and are listed in `docs/API.md` (the doc groups some of them in prose). **1** operational route is proposed and is not in that contract: health. **4** admin reads by id are proposed so editors are not capped at `pageSize=100`.

### 2.1 Auth (6 in the adapter)

| Method | Path | Called by the UI | Notes for the backend |
| --- | --- | --- | --- |
| POST | `/auth/login` | Yes | Drop `developmentAck` as a required field. Generic failure text. Rate limit. Set session cookie and `mn_csrf`. |
| POST | `/auth/logout` | Yes | Delete server session. Clear cookies. |
| GET | `/auth/session` | **No** | Return `{ authenticated, user }` or `{ authenticated: false }`. Needed on load. |
| POST | `/auth/password-reset/request` | Yes | Always the same body. Do not return `developmentResetPath`. |
| POST | `/auth/password-reset/complete` | Yes | Body `token`, `password`, `confirm`. Never echo the password. `passwordStored: true` only when a hash was written. |
| POST | `/auth/session/expire` | Yes, account page | Development only. Omit from production OpenAPI or return 404. |

### 2.2 Public (13)

| Method | Path | Called by the UI | Response the adapter returns |
| --- | --- | --- | --- |
| GET | `/public/home` | No (store) | `HomepageContent` |
| GET | `/public/about` | No | `AboutContent` |
| GET | `/public/milestones` | No | `Milestone[]` |
| GET | `/public/classes` | No | `PublicLesson[]` |
| GET | `/public/classes/:id` | No | `PublicLesson` or 404 |
| GET | `/public/trainees` | No | `PublicTrainee[]` |
| GET | `/public/trainees/:id` | No | `PublicTrainee` or 404 |
| GET | `/public/projects` | No | `PublicProject[]` |
| GET | `/public/projects/:id` | No | `PublicProject` or 404 |
| GET | `/public/events` | No | `PublicEvent[]` |
| GET | `/public/events/:id` | No | `PublicEvent` or 404 |
| GET | `/public/media` | No | listable `MediaItem[]` (full objects, including `listing` and `publicationStatus`) |
| POST | `/public/enquiries` | **Yes** | `{ id, delivered: false, message }` |

Public field omissions the server must copy (`web/src/domain/publicView.ts`):

| Type | Omit |
| --- | --- |
| Lesson | `internalNotes` |
| Trainee | `email`, `internalNotes`, `linkedin`, `portfolio`, `consentReceived` |
| Project | `internalNotes`, `repositoryUrl`, `demoUrl`, `shareAgreed`, `labOnlyConfirmed` |
| Event | `internalNotes` |
| Media | Adapter omits nothing. Recommend omitting `listing` and `publicationStatus` from the public DTO. The gallery does not render them. It does render `consent`. |

`isPubliclyListable`: `hidden` is excluded; `sample` is included even when the workflow is `draft`; `public` is included only for `published` or `scheduled`.

### 2.3 Admin collections (20)

For `classes`, `trainees`, `projects`, `events`:

| Method | Path | UI |
| --- | --- | --- |
| GET | `/admin/{resource}` | Yes. Page object. |
| POST | `/admin/{resource}` | Yes, editors. |
| PATCH | `/admin/{resource}/:id` | Yes. |
| DELETE | `/admin/{resource}/:id` | Yes. |
| POST | `/admin/{resource}/bulk` | **Only the class list** sends it. Adapter implements it for all four. |

Bulk: `{ ids: string[], action: "publish" | "delete" }`. Publish sets `publicationStatus` to `published` and, if listing was `hidden`, sets listing to `sample`. It does not check trainee consent. The backend publish action **should** refuse to mark a trainee `public` without consent, and should not upgrade `hidden` trainees who lack consent. That is stricter than the adapter. Flagged below.

There is no `GET /admin/{resource}/:id`. Proposed addition, four routes, admin `content.read`.

### 2.4 Media (4)

| Method | Path | UI |
| --- | --- | --- |
| GET | `/admin/media` | Yes. Bare array, not a page. |
| POST | `/admin/media` | Yes. JSON metadata. File bytes are not in the body. |
| PATCH | `/admin/media/:id` | **Not called.** Adapter can set consent and then auto-list as `sample` / `published`. |
| DELETE | `/admin/media/:id` | Yes. |

### 2.5 Singletons, users, account, search (14)

| Method | Path | Permission in the adapter | UI |
| --- | --- | --- | --- |
| GET | `/admin/home` | `content.read` | Yes |
| PUT | `/admin/home` | `content.write` | Yes |
| GET | `/admin/about` | `content.read` | Yes |
| PUT | `/admin/about` | `content.write` | Yes |
| GET | `/admin/milestones` | `content.read` | Yes |
| PUT | `/admin/milestones` | `content.write` | Yes. Body `{ milestones: Milestone[] }`. |
| GET | `/admin/settings` | `settings.manage` | Yes |
| PUT | `/admin/settings` | `settings.manage` | Yes. Validates `siteName`, `contactEmail`. |
| GET | `/admin/users` | `users.read` | Yes. Bare array. |
| PATCH | `/admin/users/:id` | `users.manage` | Yes. Body `{ role }`. |
| POST | `/admin/users/invite` | `users.manage` | Yes. Returns `delivered: false`. |
| GET | `/admin/account` | `account.manage` | **Not called.** Account page uses the session snapshot. |
| POST | `/admin/account/password` | `account.manage` | Yes. Adapter returns 501 `pending`. |
| GET | `/admin/search` | `content.read` | Yes. Max 8 hits: `{ type, id, title, href }`. |

### 2.6 Proposed and not in `docs/API.md`

| Method | Path | Why |
| --- | --- | --- |
| GET | `/api/v1/health` | Deploy and uptime checks. No auth. |
| GET | `/admin/classes/:id` and the same for trainees, projects, events | Editors currently scan a 100-row page. |
| GET | `/admin/enquiries` | Only if the owner wants an inbox. Not in the UI. |

Not proposed unless the owner asks: a public stats endpoint, a modules endpoint, an announcements collection, an audit read API, SMS webhooks.

### 2.7 Differences to resolve before coding the contract

1. **Public pages do not use the public GET routes.** The routes exist so the adapter can be tested. Cutover means changing `usePublicContent` and the admin overview to `api()`. Until that change, a live backend is invisible to the marketing site.
2. **`developmentAck`** is required by the adapter and the login form. It is not a production credential field.
3. **Reset response leaks a token** via `developmentResetPath`. Production must not.
4. **Login errors name the fixture emails.** Production must not.
5. **`GET /admin/media` and `GET /admin/users` and all public lists are arrays.** Other admin lists are pages. Keep both shapes so the current client does not break.
6. **Sort is unvalidated** in the adapter. Allowlist it.
7. **Filter encoding** is `filters.moduleId=network`, not JSON.
8. **Trainee tracks** differ between the form (General) and the fixtures (GRC & awareness).
9. **Workflow options differ by form.** Classes: draft, in review, scheduled, published. Trainees: no scheduled. Projects: no scheduled. Events: no in review. The database enum can hold all four; DTO validation should match the form that sends the value, or the forms should be aligned. Recommend one enum and accepting all four on every resource so scheduled events keep working.
10. **Event `body`, `startTime`, `endTime`, `image`** exist on the type. The editor does not edit `body` or times; it resubmits `initial.body` and a default image. PATCH must merge, not null the body.
11. **Project `listing`** is not on the form. The adapter sets `sample` when status becomes `published`, otherwise keeps the previous listing or `hidden`.
12. **Class `cover`** is not on the form. Merge the previous value.
13. **`shareAgreed` does not reveal URLs.** The public mapper always strips them. The project page says they stay private until a share agreement exists, which is stricter than the flag.
14. **Bulk publish skips the consent rule** that single-trainee save enforces.
15. **Media PATCH auto-publishes** when consent is verified. The page never calls it.
16. **Foundation stats, modules, phases, contact cards, hero facts, anniversary essay** are not API data.
17. **`docs/API.md` says lists accept `q`, `page`, `pageSize`, `sort`, `dir`, `filters`.** That is true for the four admin collections. It is not true for public lists or media.
18. **Enquiries are stored and never listed.**
19. **No audit log**, despite the overview placeholder.
20. **`code` `pending` (501)** is a client-visible state for unfinished features. Real implementations should stop returning it for password change once hashes exist. Email flows can keep `delivered: false` with HTTP 200 so the current toasts stay correct.

`web/tests/transport.test.ts` already marks cookie sessions, CSRF, server-side authorization, persistence, media upload, and password email as `it.todo`. Those become backend tests, not more frontend todos.

## 3. Validation rules to port into DTOs

From `devTransport` and the forms. Messages should stay, because the UI prints `fieldErrors` next to inputs.

| Write | Rules |
| --- | --- |
| Login | Email format. Password required, minimum 8. Do not log it. |
| Class | Title required, min 6. Module required. Week 1–18. Date required. Summary required, min 20. |
| Trainee | Display name required. Email required. LinkedIn and portfolio optional URLs (`http`/`https`). Public listing forced to sample without consent. |
| Project | Title min 6. Type required. Abstract min 30. Repository and demo optional URLs. |
| Event | Title, place, summary (min 20). Source URL required when `verified` is true, otherwise optional. |
| Media create | Alt text required. |
| Enquiry | Name, email, message min 20, `consent === true`. |
| Settings | Site name required. Contact email valid. |
| Role patch | Role is one of the three. Actor cannot remove their own administrator role. |
| Password change / reset | New password min 8. Confirmation must match. Reset token must exist and not be expired. |
| Bulk | `ids` non-empty. `action` is `publish` or `delete`. |
| Homepage / about / milestones | Bound lengths (propose 500 for short fields, 5000 for mission/vision/notes) so a paste cannot fill the 500 MB free database. Not in the adapter today. |

Reject privileged fields from anonymous clients: `role`, `fixture`, `delivered` on create, storage keys, consent on a public route.

## 4. Directory layout (proposal only)

### What is wrong with a literal move today

The React app is `web/`, not `frontend/`. It imports CSS from the repository root and serves images through a symlink:

- `web/src/main.tsx` imports `../../css/*.css`
- `web/vite.config.ts` sets `server.fs.allow` to the parent of `web/`
- `web/public/assets` → `../../assets`
- `Photo` requests `/assets/img/{stem}-800.webp` and the 1600 pair

`origin/main` and `origin/prototype` already keep the static HTML under `prototype/`. This `frontend` branch does not. It was cut from `4ccdc05`, before that move, so the HTML, `css/`, `js/`, and `assets/` still sit at the root next to `web/`.

### Target tree

```
prototype/          static HTML reference (already the shape of origin/main)
frontend/           today’s web/, self-contained
  css/              today’s root css/  (or src/styles/prototype/)
  public/assets/    today’s assets/ as real files, not a symlink out of the package
  src/              unchanged alias `@/`
  package.json
backend/            new, Stage 2
docs/               stays at the repo root so both apps share it
```

### Safe sequence (a later PR, after approval)

Do this on a branch from `frontend`, with the app still building, before backend feature work depends on paths.

1. `git mv` the root prototype HTML, `admin/`, `js/`, `_shots/`, `design-system.html`, `motion-spec.html`, and `index-of-screens.html` into `prototype/`. Leave `css/` and `assets/` until the app points at them. Do not edit the visual CSS.
2. Remove the symlink `web/public/assets` (it is not a real directory). `git mv assets web/public/assets`. URLs stay `/assets/...` because Vite serves `public/` at the site root.
3. `git mv css web/css`. Change the four imports in `web/src/main.tsx` from `../../css/` to `../css/`. Shrink `server.fs.allow` so the dev server no longer needs the repository parent.
4. `git mv web frontend`.
5. Update `README.md` commands from `cd web` to `cd frontend`. Update Playwright’s `webServer` command if the config moved with the app (it did). Update any doc paths.
6. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` inside `frontend/`. Open the home page and a lesson and confirm hero and gallery images still load from `/assets/img/...`.
7. Only then add `backend/` in the foundation milestone.

`git mv` keeps history. A copy would look like a new tree and make review harder.

Do not do this in the same commit as the first Express server. If image paths break, the revert should not also revert the server.

`docs/` stays at the root. The brief’s later docs (`api-reference.md`, `database.md`, `security.md`, `deployment.md`) belong there too. `backend/README.md` is the short operational page and links to `docs/`.

## 5. Branch and pull-request flow

Observed on 24 Oct 2026:

| Branch | Role | Push? |
| --- | --- | --- |
| `main` | `origin/main` holds `prototype/` only (merge `3cc42fa`). The brief says main stays empty; the remote is not empty. | Never from this work. |
| `prototype` | Static prototype under `prototype/`. | Do not retarget it. |
| `frontend` | React app. Integration target for UI changes. | Feature branches, then PR into `frontend`. |
| `backend` | Empty tree at `2dd4167`. Backend work targets this branch. | PRs into `backend`. |

Recommended flow:

1. **This pull request** is the Stage 1 review. Branch from `frontend`. Base `backend`. The diff against empty `backend` includes the existing frontend, not only these two files, because the branches diverged at `4ccdc05` and `backend` then deleted the prototype. Merging it puts the current app onto `backend`. Do that only if you want `backend` to contain the app plus the plan. It does not put anything on `main`.
2. **Layout PR** (section 4), after you approve the move. Base `frontend`. Small, reviewable, app still green.
3. **Foundation PR** and each feature PR. Branch from the updated `frontend` (so `frontend/` and `backend/` both exist) and open the PR against `backend`. If `backend` does not yet contain the frontend tree, merge or rebase the layout onto it first so the PR diff is the server, not the whole site again.
4. Frontend edits that point `VITE_API_MODE` at the server are a **frontend** PR. They land after the endpoint they call is on `backend`.
5. No force-push. No secrets. One milestone, one pull request, small commits inside it.

Local `main` on this machine was still `4ccdc05` at the start of the run (behind `origin/main`). Do not reset it as part of feature work.

## 6. Milestones

Each row is a review point. Do not start the next until the previous tests pass and you have looked at the diff.

| # | Milestone | Done when |
| --- | --- | --- |
| 0 | This plan | You have answered the questions in section 9 or accepted the defaults in section 10. |
| 1 | Layout | `frontend/` builds and tests. `prototype/` still opens. `backend/` does not exist yet, or exists only as a README pointer. |
| 2 | Foundation | Express app, strict TypeScript, env validation, `/api/v1/health`, error shape, request log, CORS, TypeORM data source, `synchronize: false`, first migration (empty or extensions only), Vitest, `.env.example`, Swagger shell at `/api/docs`. No feature routes beyond health. |
| 3 | Auth | Argon2id, session cookie, CSRF, login rate limit, logout, `GET /auth/session`, no open registration, seed for the first administrator from env. Tests: anonymous, wrong password, viewer versus editor versus administrator, expired session. |
| 4 | Curriculum | Lessons CRUD, list filters, pagination, allowlisted sort, public projection, publication predicate. Frontend class list and editor pointed at the API in a follow-up or the same milestone if you want them together. |
| 5 | Trainees | Private email, consent rule, public profile. |
| 6 | Projects | Private URLs. |
| 7 | Events | Body JSON, verified-source rule, anniversary flag. |
| 8 | Gallery | Storage provider, metadata in Postgres, static seeds for the 21 photos, upload validation, delete calls the provider. `Photo` learns absolute `src`. |
| 9 | Content singletons | Homepage, about, milestones, settings. |
| 10 | Accounts and mail | Password change, reset email, invite, enquiries. Unconfigured provider returns `delivered: false` and is labelled unconfigured. |
| 11 | Public cutover | Pages stop importing the fixture store for records the API serves. Drafts are not in the client bundle. Loading, empty, and error states checked on home, classes, gallery, contact, and one admin editor. |
| 12 | Docs and deploy prep | `docs/api-reference.md`, `docs/database.md`, `docs/security.md`, `docs/deployment.md`, root README. OpenAPI matches routes. No automatic deploy. |

Audit writes can piggy-back on milestones 4–10 (one row per mutation) without an admin screen. An audit screen is out of scope until you ask.

## 7. Testing

Framework: Vitest for the backend, same as the frontend, so there is one runner to learn. Supertest (or the built-in Node test via `app` injected with a listener) for HTTP. TypeORM against a **separate** database named in `DATABASE_URL` only when `NODE_ENV=test`.

| Layer | What |
| --- | --- |
| Unit | Publication predicate, permission map, consent rule, password confirmation, reset token expiry, DTO failures. No database. |
| Repository | Insert and unique constraints, transaction rollback on a failed bulk delete. Real Postgres. |
| HTTP | 422 field errors, 401, 403 for viewer/editor/administrator, 404, duplicate email, invalid sort, CSRF rejection, login lockout. |
| Providers | Email and storage fakes. Tests assert the service records `delivered: false` or rolls back metadata when `put()` throws. |
| Frontend | Existing Vitest and Playwright stay green. Add a live-mode test only when a test server is available. Do not point Playwright at production. |

Procedure to document in `backend/README.md`: start Postgres (local Docker or a Supabase branch that is **not** production), export `DATABASE_URL`, run migrations, run `npm test`, drop nothing automatically. A failed test must not truncate a database whose name does not end in `_test`.

Before a milestone is called done: format, lint, `tsc --noEmit`, unit and integration tests, and `npm run build` actually executed. Record failures in the pull request.

The frontend checks to re-run after the layout milestone and after cutover: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e` from `frontend/`.

## 8. Deployment and free-tier services

No accounts were created in this run. No service was deployed. Limits below were read from the vendor’s site on 24 Oct 2026. They are not a promise of uptime, backups, or a permanent free plan. Re-check the linked page before relying on a number.

### 8.1 Supabase Postgres — recommended database

Source: [supabase.com/pricing](https://supabase.com/pricing), fetched this run.

Use a Supabase project as managed Postgres (the pricing page says a project can be a standalone Postgres database and that Auth, Storage, Realtime, and Edge Functions are optional). This app does **not** use Supabase Auth or Supabase Storage. TypeORM connects with the project connection string.

Free plan, as stated on that page:

- $0 per month
- 500 MB database size per project (shared CPU, 500 MB RAM)
- 5 GB egress and 5 GB cached egress
- 1 GB file storage (unused if media lives on Cloudinary)
- 50,000 monthly active users on Supabase Auth (unused by this design)
- Unlimited API requests (Supabase’s own API, not this Express app)
- **Paused after 1 week of inactivity**
- **Limit of 2 active free projects**
- Automatic backups: table on that page lists backups as “Not included” on Free, and “7 days” on Pro
- Log retention (API and database): 1 day on Free

Paid plans are not paused for inactivity. Pro starts at $25 per month on that page. Do not add a card or a paid project without explicit approval.

Connection setup guide linked from that page: [Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres). Confirm the TLS query parameter from that guide during setup. This plan does not repeat a `sslmode` value it did not re-read there.

A paused free project rejects connections until someone resumes it in the dashboard. The public site will fail its health check while paused. That is acceptable for a class project and unacceptable for an event week unless the project is upgraded or kept active.

### 8.2 Render — recommended API host, with eyes open

Sources: [render.com/pricing](https://render.com/pricing) and [render.com/docs/free](https://render.com/docs/free), fetched this run.

Free web service compute, from those pages:

- $0 compute, 512 MB RAM (`free` plan id; the glossary also describes it as 0.1 CPU / 512 MB RAM)
- Spins down after **15 minutes** without inbound HTTP or WebSocket traffic. Next request takes about a minute and shows a loading page.
- **750 free instance hours** per workspace per calendar month. Spun-down time does not consume hours. Unused hours do not roll over. Exhausting them suspends free web services until next month.
- Ephemeral disk. Local uploads disappear on spin-down, restart, or redeploy. Free web services cannot attach a persistent disk.
- Hobby workspace includes **5 GB bandwidth** per month, then $0.15 per GB. Without a payment method, exceeding bandwidth suspends free services for the rest of the month.
- Hobby standard build pipeline: **500 minutes** per month, then $5 per 1,000 minutes. Without a payment method (or at the spend limit), new builds are disabled for the rest of the month. Running services keep the old build.
- Outbound SMTP ports **25, 465, and 587 are blocked** on free web services (port 25 is blocked on all services). Resend’s HTTPS API avoids that. Do not plan on a local SMTP relay.
- Free web services cannot receive private-network traffic. They may send private-network requests to Render data stores and paid services in the same region.
- Render may suspend a free web service that sends an unusually high volume of traffic to the public internet, and the docs list “accessing an external database” as an example. Supabase is an external database. A small bootcamp site is unlikely to trip this; it is still a reason not to treat the pair as production.
- Custom domains and managed TLS are supported on the free web service. Rollbacks only to the two most recent deploys.
- Hobby workspace: 1 seat, 25 services, custom domains (2 included, then $0.25 per domain per month).

Free Render Postgres, same docs:

- One free database per workspace, 256 MB RAM, 100 connections, **1 GB** storage
- **Expires 30 days after creation**, then a 14-day grace period to upgrade, then deletion
- No backups and no managed pooling
- May restart or go offline for maintenance at any time

Do **not** use free Render Postgres for this project. Thirty days is shorter than the bootcamp. Use Supabase (or a paid database you explicitly approve). Use Render only for the Node process and, if you want, a static site for `frontend/`.

Static sites on Render are free and still count against bandwidth and pipeline minutes.

The frontend can be a Render static site or any other static host. `FRONTEND_URL` must be the exact origin. Cookie rules in the architecture doc depend on whether that origin matches the API.

### 8.3 Cloudinary — recommended for new uploads only

Source: [cloudinary.com/pricing](https://cloudinary.com/pricing), fetched this run.

Free plan on that page:

- $0, described as “Free forever”
- 3 users / 1 account
- **25 monthly credits**

The same page defines a credit as interchangeable across:

- 1,000 transformations, or
- 1 GB managed storage, or
- 1 GB image bandwidth

It marks **2 GB video bandwidth** as “paid plans only”. The page also says the dashboard shows the exact breakdown. Verify the free account’s bandwidth counter in the console before a public launch, because the credit paragraph is the pricing page’s formula rather than a separate free-plan quota table.

The 21 bundled photographs should stay as static files (section 4 and the architecture doc). Cloudinary is for editor uploads. Avoid on-the-fly transformations (`f_auto`, responsive widths) until credit use is understood; each new derived asset counts. Deliver the original upload URL when possible.

Signup, when you are ready: the pricing page is the public entry. This run did not create an account.

### 8.4 Resend — recommended for transactional email

Source: [resend.com/pricing](https://resend.com/pricing), fetched this run.

Transactional Free plan on that page:

- $0 per month
- **3,000 emails per month**
- **100 emails per day**
- 3 domains, 3 inboxes
- 30-day data retention
- 1 webhook endpoint
- Ticket support
- The overage column is “—” for Free. The FAQ says pay-as-you-go overage is a paid-plan option. If you do not enable a paid plan, exceeding the quota stops extra sends rather than billing you. Re-read that FAQ before a large invite.

Password reset and invitations must use a verified domain (SPF, DKIM, DMARC are listed as included on all plans). Sending from an unverified address will fail; the app should surface `delivered: false` and keep working.

Signup: [resend.com](https://resend.com). No account was created here.

### 8.5 SMS — optional, not selected

No SMS provider was verified in this run. Do not block auth or the public site on SMS. Africa-facing gateways (for example Hubtel or Africa’s Talking) and global gateways (for example Twilio) need a current price check and a sender ID that works for Ghana before anyone promises texts. The `SmsProvider` interface can exist and throw “unconfigured”. Core flows must not call it.

### 8.6 Deploy checklist (documentation, not this run)

Write this into `docs/deployment.md` during milestone 12:

- Node 22 (or the LTS you pin), `npm ci`, `npm run build`, `node dist/main.js`
- `PORT` from the host. Render sets `PORT`.
- `DATABASE_URL` with TLS, migrations as a release command, never `synchronize`
- `FRONTEND_URL`, cookie secret, `Secure` cookies, CORS credentials
- Health check path `/api/v1/health`
- Initial admin command, password from the host’s secret store
- Cloudinary and Resend keys. Missing keys boot the app in an unconfigured provider mode for email and uploads, and fail the boot only for `DATABASE_URL`, `SESSION_SECRET`, and `FRONTEND_URL` in production
- Backups: free Supabase does not include automatic backups on the pricing table read this run. Say so. A `pg_dump` run by a person is the recovery plan until a paid plan exists
- Logs: do not print secrets. Render free log retention was not copied beyond what section 8.2 cites; confirm retention in the dashboard
- Rollback: redeploy the previous build. Database rollback is a **forward** migration that undoes a change, not `migration:revert` against production, unless you have a fresh backup and explicit approval
- Troubleshooting: paused Supabase project, spun-down Render service, CSRF cookie missing on a cross-origin deploy, SMTP ports blocked (use HTTPS email)

No paid resources, no cards, no production deploy, without a separate explicit approval.

## 9. Questions for the owner

Defaults in section 10 apply if you would rather not answer line by line. A “yes, use the defaults” is enough to start milestone 1.

1. **Publication.** Keep `isPubliclyListable` (sample rows are visible even as drafts) or switch to “published or scheduled only”? The second hides content the site shows today.
2. **Layout.** Approve the move in section 4 (`web/` → `frontend/`, CSS and assets inside it, prototype HTML into `prototype/`)?
3. **This pull request’s base is `backend`.** Merging it copies the current frontend onto the empty `backend` branch. Is that what you want, or should `backend` stay empty until the layout PR?
4. **`origin/main` is not empty.** It contains `prototype/` after pull request 3. Confirm we still never push to `main`.
5. **First administrator.** Which email should the seed accept? You will set the password in the host environment, not in chat.
6. **Cookies.** One site (API and static files under one registrable domain, `SameSite=Lax`) or two hosts (`SameSite=None; Secure`)? One site is simpler and safer.
7. **Project links.** When `shareAgreed` is true, should the public project page show `repositoryUrl` and `demoUrl`? Today it never does.
8. **Media consent.** Should “consent verified” auto-publish, as the unused adapter PATCH does, or only clear the pending flag?
9. **Bulk publish** currently bypasses trainee consent. Confirm the server should refuse that.
10. **Tracks.** Is the third track “General” (the form) or “GRC & awareness” (the fixtures)?
11. **Modules, phases, foundation stats.** Leave them as frontend constants, or store them so editors can change them?
12. **Lesson files and trainers.** In scope for a later milestone, or explicitly out?
13. **Announcements.** Is the single homepage banner enough? The brief’s folder list includes `announcements/`.
14. **Enquiries.** Store and email only, or add an admin inbox?
15. **Audit log.** Write rows from the first content milestone, or wait?
16. **Schedule clock.** Keep the fixed date `2026-10-24` that the fixtures use for “this week”, or use the real current date in `Africa/Accra`?
17. **Upload cap.** Is 5 MB and jpeg/png/webp acceptable?
18. **SMS.** Any real need this year?
19. **Frontend host.** Render static site next to the API, or somewhere else? Needed for `FRONTEND_URL` and cookies.
20. **Viewer role.** Keep it for production, or only editor and administrator?

Content questions already open in `docs/research.md` and the root README (hackathon link to the bootcamp, curriculum length, photo-to-event mapping, logo vector, display permission for foundation counters) stay open. They do not block the schema. Seed data should keep the current labels, including “to be confirmed”.

## 10. Defaults if you approve the plan as written

- Publication predicate stays identical to `web/src/domain/publish.ts`.
- Layout move is a separate approved PR (milestone 1), not part of the server foundation.
- `backend` may receive the frontend tree when you merge the Stage 1 PR; later server PRs target `backend`. `main` is untouched.
- Session cookies, HttpOnly, CSRF cookie `mn_csrf`, Argon2id, no public registration.
- `shareAgreed` does **not** reveal URLs until you say so.
- Consent verification does **not** auto-publish.
- Bulk publish honours the consent rule.
- Trainee track check constraint allows Blue team, Red team, General, and GRC & awareness until you delete one.
- Modules, phases, and foundation stats stay in the frontend.
- No lesson-file table, no trainer table, no announcements collection, no enquiry inbox, no SMS.
- Audit rows are written but not exposed.
- Schedule status uses the real clock in `Africa/Accra`. The fixed `APP_TODAY` remains a frontend test fixture.
- Upload limit 5 MB; jpeg, png, webp.
- Bundled WebP files stay static. Cloudinary is for new uploads only.
- Database: Supabase free Postgres. API: Render free web service. Email: Resend free. All three are best-effort and can pause, sleep, or expire features as section 8 says.
- Node 22 LTS for the first `engines` pin.
