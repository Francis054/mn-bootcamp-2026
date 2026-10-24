# Backend implementation plan (Stage 1)

**Status: decisions recorded, Stage 2 not started.** This run does not add server code, does not move `web/`, and does not deploy anything. The design it refers to is `docs/backend-architecture.md`.

The owner answered the Stage 1 questions on 24 Oct 2026. Section 9 is that record. Section 10 is what is still open. Implementation still needs a separate explicit approval.

Approved work after that approval lands one milestone at a time. Each milestone gets its own small commits, tests, and a note of what is still fake.

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
| Project | `/projects/:id` | Public project. Links are not rendered. | `GET /public/projects/:id`. The public DTO includes `repositoryUrl` and `demoUrl` only when `linksShareConsent` is true and the project is published. |
| Trainees | `/trainees` | Public trainees. | `GET /public/trainees`. |
| Trainee | `/trainees/:id` | Public trainee plus related projects. | `GET /public/trainees/:id` and `/public/projects`. |
| Events | `/events` | Public events. Past/upcoming is computed with `APP_TODAY` (24 Oct 2026 UTC). | `GET /public/events`. Server should compute schedule fields in `Africa/Accra` or return the raw date and let the client keep the clock. See questions. |
| Event | `/events/:id` | Public event. `.ics` built in the browser when `calendarDownload` is set. | `GET /public/events/:id`. No calendar endpoint. |
| Gallery | `/gallery` | Public media. The caption currently adds “consent record pending” because sample rows with pending consent are listable. | `GET /public/media` returns published photos whose consent is `verified`. Pending and withdrawn photos are absent. |
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

Base path `/api/v1`. **57** handlers exist in `web/src/dev/transport.ts` and are listed in `docs/API.md` (the doc groups some of them in prose). Not in that adapter, and now part of this plan: `GET /api/v1/health`, four `GET /admin/{resource}/:id` routes, and `POST /admin/media/:id/withdraw-consent`.

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
| Project | `internalNotes`, `labOnlyConfirmed`, `linksShareConsent` and its audit columns. Include `repositoryUrl` and `demoUrl` only when consent is recorded and `publicationStatus` is `published`. The current `toPublicProject` always strips the URLs. That changes. |
| Event | `internalNotes` |
| Media | `listing`, `publicationStatus`, consent bookkeeping. The gallery today prints consent on the public caption because the adapter returns the full object. The live public DTO does not include pending consent. |

Public filter for the live API (this replaces `isPubliclyListable`):

- `publication_status` must be `published`. Draft, `in_review`, and `scheduled` are not returned. They are not previewed by a public token. An authorized admin reads them from `/admin/*`.
- `listing: hidden` is not returned.
- `listing: sample` is a label for development seed data. It does not make a draft public. The production seed does not insert sample rows.
- Trainee profiles also require `consentReceived`.
- Media also requires `consent = verified`.
- Project URLs additionally require `linksShareConsent`. The project itself can be published without that flag; the URLs are then omitted.

### 2.3 Admin collections (20)

For `classes`, `trainees`, `projects`, `events`:

| Method | Path | UI |
| --- | --- | --- |
| GET | `/admin/{resource}` | Yes. Page object. |
| POST | `/admin/{resource}` | Yes, editors. |
| PATCH | `/admin/{resource}/:id` | Yes. |
| DELETE | `/admin/{resource}/:id` | Yes. |
| POST | `/admin/{resource}/bulk` | **Only the class list** sends it. Adapter implements it for all four. |

Bulk: `{ ids: string[], action: "publish" | "delete" }`. The adapter sets `publicationStatus` to `published` and, if listing was `hidden`, sets listing to `sample`, with no consent check. The backend publish action refuses rows that are not allowed to go live: a trainee with `consentReceived` false, a photo whose consent is not `verified`. It does not treat publish as link consent. A partial failure returns which ids were rejected and does not publish those ids. Hidden rows stay hidden unless the editor sets a non-hidden listing in the same authorized write.

There is no `GET /admin/{resource}/:id`. Proposed addition, four routes, admin `content.read`.

### 2.4 Media (4)

| Method | Path | UI |
| --- | --- | --- |
| GET | `/admin/media` | Yes. Bare array, not a page. |
| POST | `/admin/media` | Yes. JSON metadata. File bytes are not in the body. |
| PATCH | `/admin/media/:id` | **Not called by the page.** On the server, setting consent to `verified` must not publish. Setting `published` is rejected unless consent is already `verified`. |
| POST | `/admin/media/:id/withdraw-consent` | **Not in the adapter or `docs/API.md`.** Required by the consent decision. See the architecture doc. |
| DELETE | `/admin/media/:id` | Yes. Also deletes provider bytes for uploaded objects. |

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
| GET | `/admin/classes/:id` and the same for trainees, projects, events | Editors currently scan a 100-row page. Also how an admin previews a draft without using the public URL. |
| POST | `/admin/media/:id/withdraw-consent` | Unpublish, clear the public URL, delete or revoke provider delivery, audit. |
| GET | `/admin/enquiries` | Only if the owner wants an inbox. Not in the UI. Still open. |

Not proposed unless the owner asks: a public stats endpoint, a modules endpoint, an announcements collection, an audit read API, SMS webhooks.

### 2.7 Differences to resolve before coding the contract

1. **Public pages do not use the public GET routes.** The routes exist so the adapter can be tested. Cutover means changing `usePublicContent` and the admin overview to `api()`. Until that change, a live backend is invisible to the marketing site.
2. **`developmentAck`** is required by the adapter and the login form. It is not a production credential field.
3. **Reset response leaks a token** via `developmentResetPath`. Production must not.
4. **Login errors name the fixture emails.** Production must not.
5. **`GET /admin/media` and `GET /admin/users` and all public lists are arrays.** Other admin lists are pages. Keep both shapes so the current client does not break.
6. **Sort is unvalidated** in the adapter. Allowlist it.
7. **Filter encoding** is `filters.moduleId=network`, not JSON.
8. **Trainee tracks.** Decided: the third track is `GRC & Awareness`. The form still says “General” and the fixtures still say “GRC & awareness”. A later pull request into `frontend` aligns both. This run does not edit them.
9. **Workflow options differ by form.** Classes: draft, in review, scheduled, published. Trainees: no scheduled. Projects: no scheduled. Events: no in review. The database enum can hold all four; DTO validation should match the form that sends the value, or the forms should be aligned. Recommend one enum and accepting all four on every resource so scheduled events keep working.
10. **Event `body`, `startTime`, `endTime`, `image`** exist on the type. The editor does not edit `body` or times; it resubmits `initial.body` and a default image. PATCH must merge, not null the body.
11. **Project `listing`** is not on the form. The adapter sets `sample` when status becomes `published`, otherwise keeps the previous listing or `hidden`.
12. **Class `cover`** is not on the form. Merge the previous value.
13. **Project URLs.** Decided. Add `linksShareConsent` (plus when and which admin recorded it). Public responses include `repositoryUrl` and `demoUrl` only when that flag is true and the project is `published`. `shareAgreed` on the current form is replaced by this field in the frontend cutover. The current public mapper always strips the URLs; that is the behaviour until cutover, not the live rule.
14. **Bulk publish.** Decided. It must enforce the same consent gates as a single publish. The adapter does not.
15. **Media consent.** Decided. Verification does not publish. Publish requires verified consent. Withdrawal is `POST /admin/media/:id/withdraw-consent`. The adapter’s PATCH auto-publishes and must not be copied.
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
| Trainee | Display name required. Email required. Track is `Blue team`, `Red team`, or `GRC & Awareness`. LinkedIn and portfolio optional `https` URLs. `published` is rejected when `consentReceived` is false. |
| Project | Title min 6. Type required. Abstract min 30. Repository and demo URLs, when present, pass the checks in the architecture doc. `linksShareConsent` is optional and defaults false. It is not implied by `published`. |
| Event | Title, place, summary (min 20). Source URL required when `verified` is true, otherwise optional. |
| Media create | Alt text required. New row is `pending` and `draft`. |
| Media publish | Rejected unless consent is `verified`. |
| Media withdraw | No body fields from the client that choose a public URL or a role. |
| Enquiry | Name, email, message min 20, `consent === true`. |
| Settings | Site name required. Contact email valid. |
| Role patch | Role is one of the three. Actor cannot remove their own administrator role. |
| Password change / reset | New password min 8. Confirmation must match. Reset token must exist and not be expired. |
| Bulk | `ids` non-empty. `action` is `publish` or `delete`. |
| Homepage / about / milestones | Bound lengths (propose 500 for short fields, 5000 for mission/vision/notes) so a paste cannot fill the 500 MB free database. Not in the adapter today. |

Reject privileged fields from anonymous clients: `role`, `fixture`, `delivered` on create, storage keys, consent on a public route.

## 4. Directory layout

The owner wants a `frontend/` directory and a `backend/` directory, on separate branches, connected by the API contract. This run does not move files.

### What is wrong with a literal move today

The React app is `web/`, not `frontend/`. It imports CSS from the repository root and serves images through a symlink:

- `web/src/main.tsx` imports `../../css/*.css`
- `web/vite.config.ts` sets `server.fs.allow` to the parent of `web/`
- `web/public/assets` → `../../assets`
- `Photo` requests `/assets/img/{stem}-800.webp` and the 1600 pair

`origin/main` and `origin/prototype` already keep the static HTML under `prototype/`. This `frontend` branch does not. It was cut from `4ccdc05`, before that move, so the HTML, `css/`, `js/`, and `assets/` still sit at the root next to `web/`.

### Target, split across branches

These two trees are never committed on top of each other.

On the `frontend` branch, after a layout pull request into `frontend`:

```
frontend/           today’s web/, self-contained
  css/              today’s root css/
  public/assets/    today’s assets/ as real files, not a symlink out of the package
  src/              unchanged alias `@/`
  package.json
```

The static HTML reference already lives under `prototype/` on `main` and on the `prototype` branch. The layout pull request moves the root HTML on the `frontend` branch into `prototype/` as well, so that branch stops carrying a second copy at the root. It does not merge that result into `backend`.

On the `backend` branch, when Stage 2 is approved:

```
backend/            Express + TypeORM application
docs/backend-architecture.md
docs/backend-implementation-plan.md
```

Later backend docs (`api-reference.md`, `database.md`, `security.md`, `deployment.md`) are written on the `backend` branch next to the code they describe. The React app is not imported as a package and is not copied into this branch.

### Safe sequence for the frontend layout

Do this on a branch from `frontend`, with the app still building. It is independent of the first Express commit.

1. `git mv` the root prototype HTML, `admin/`, `js/`, `_shots/`, `design-system.html`, `motion-spec.html`, and `index-of-screens.html` into `prototype/`. Leave `css/` and `assets/` until the app points at them. Do not edit the visual CSS.
2. Remove the symlink `web/public/assets` (it is not a real directory). `git mv assets web/public/assets`. URLs stay `/assets/...` because Vite serves `public/` at the site root.
3. `git mv css web/css`. Change the four imports in `web/src/main.tsx` from `../../css/` to `../css/`. Shrink `server.fs.allow` so the dev server no longer needs the repository parent.
4. `git mv web frontend`.
5. Update `README.md` commands from `cd web` to `cd frontend`. Update Playwright’s `webServer` command if the config moved with the app (it did). Update any doc paths.
6. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` inside `frontend/`. Open the home page and a lesson and confirm hero and gallery images still load from `/assets/img/...`.
7. In that same frontend pull request, change the trainee track control and the fixtures to `GRC & Awareness`. Do not do it in this planning change.

`git mv` keeps history. A copy would look like a new tree and make review harder.

`backend/` is added later, on a branch from `backend`, after Stage 2 is explicitly approved. It is not added by merging the frontend layout.

## 5. Branch flow and same-origin integration

Observed when this plan was revised:

| Branch | Role | What a pull request into it may contain |
| --- | --- | --- |
| `main` | Holds `prototype/` after pull request 3. Pull request 2 (`frontend` into `main`) is open. | Nothing from this work. Do not push. |
| `prototype` | Static prototype under `prototype/`. | Nothing from this work. |
| `frontend` | React app, today in `web/`, later in `frontend/`. | UI, CSS, and fixture alignment only. |
| `backend` | Empty at `2dd4167`, then these planning docs. Later, `backend/` only. | API, migrations, seeds, and backend docs. Not the React app. |

Pull request 4 was branched from `frontend` and targeted `backend`. Its diff is commit `574b8db` (the whole frontend) plus commit `c57f445` (the first draft of these two documents). There is no server code in it. It was closed without merging so `backend` does not gain a second copy of the app. The replacement pull request is branched from `backend` and contains only the revised documents. History on `main`, `frontend`, `prototype`, and `backend` was not rewritten.

How the two branches meet without duplicating source:

1. **Contract.** Public and admin paths, error shape, and DTO fields in these documents are the contract. Each side tests against that contract. The frontend does not import the backend package. The backend does not import `web/`.
2. **Local integration.** Run the API from a `backend` worktree and the Vite app from a `frontend` worktree. Vite proxies `/api/v1` to the API, so the browser stays on one origin (`http://127.0.0.1:5173/api/v1/...`). `git worktree add` is the way to have both checkouts. It does not commit either tree into the other branch.
3. **Production.** `https://example.org/` is the static build of the `frontend` branch. `https://example.org/api/v1` is the same host’s reverse proxy to the API build of the `backend` branch. Two services, one public origin. A sample proxy snippet can be added later as `backend/deploy/proxy.example.conf`. That file is configuration, not a copy of the frontend.
4. **Cookies.** Because the browser only talks to one origin, session cookies stay `SameSite=Lax` and host-only, as the architecture doc describes. No cross-origin credential mode.
5. **Pull requests.** Layout and track-label changes target `frontend`. Server milestones target `backend`. No force-push. No secrets. One milestone, one pull request.

Do not merge `frontend` into `backend` or the reverse in order to “see the whole app”. A merge would be the duplication this decision rejects.

## 6. Milestones

Each row is a review point. Do not start the next until the previous tests pass and you have looked at the diff.

| # | Milestone | Done when |
| --- | --- | --- |
| 0 | This plan | Decisions in section 9 are recorded. Stage 2 has not been approved. The open items in section 10 do not block the foundation, except the administrator email, which blocks only the first real account. |
| 1 | Frontend layout | Pull request into `frontend`. `frontend/` builds and tests. Track strings say `GRC & Awareness`. No files are added to `backend`. |
| 2 | Foundation | Pull request into `backend`. Express app under `backend/`, strict TypeScript, env validation, `/api/v1/health`, error shape, request log, same-origin cookie settings, TypeORM, `synchronize: false`, Vitest, `.env.example`, Swagger at `/api/docs`. No feature routes beyond health. |
| 3 | Auth | Argon2id, `SameSite=Lax` session cookie, CSRF, login rate limit, logout, `GET /auth/session`, no open registration, `admin:create` from env or prompt. Tests: anonymous, wrong password, viewer versus editor versus administrator, expired session. The command is not run with a real address until section 10 is filled in. |
| 4 | Curriculum | Lessons CRUD. Public list and detail return `published` only. Drafts are on the admin route. |
| 5 | Trainees | Private email. `published` requires `consentReceived`. Track check constraint includes `GRC & Awareness`. |
| 6 | Projects | `linksShareConsent` and URL checks. Public URLs only when consent and published. Tests for omitted URLs, rejected private hosts, and a failed GitHub visibility check. |
| 7 | Events | Body JSON, verified-source rule, anniversary flag. Scheduled events stay off the public route. |
| 8 | Gallery | Storage provider. Consent does not publish. Publish requires verified consent. Withdrawal unpublishes, calls provider delete, and is tested when the provider fails. `Photo` learns absolute `src` in the frontend pull request that consumes this. |
| 9 | Content singletons | Homepage, about, milestones, settings. Public copies are the published singletons only. |
| 10 | Accounts and mail | Password change, reset email, invite, enquiries. Unconfigured provider returns `delivered: false` and is labelled unconfigured. |
| 11 | Public cutover | Frontend pull request. Live mode stops using `isPubliclyListable` and stops shipping drafts. Admin preview uses the admin GET, not the public URL, while a row is unpublished. Loading, empty, and error states checked on home, classes, gallery, contact, and one admin editor, against a local API via the Vite proxy. |
| 12 | Docs and deploy prep | `docs/api-reference.md`, `docs/database.md`, `docs/security.md`, `docs/deployment.md`, root README. OpenAPI matches routes. No automatic deploy. |

Audit writes can piggy-back on milestones 4–10 (one row per mutation) without an admin screen. An audit screen is out of scope until you ask.

## 7. Testing

Framework: Vitest for the backend, same as the frontend, so there is one runner to learn. Supertest (or the built-in Node test via `app` injected with a listener) for HTTP. TypeORM against a **separate** database named in `DATABASE_URL` only when `NODE_ENV=test`.

| Layer | What |
| --- | --- |
| Unit | Published-only predicate, permission map, trainee consent, project URL checks, password confirmation, reset token expiry, DTO failures. No database. |
| Repository | Insert and unique constraints, transaction rollback on a failed bulk publish. Real Postgres. |
| HTTP | 422 field errors, 401, 403 for viewer/editor/administrator, 404 for drafts on public routes, duplicate email, invalid sort, CSRF rejection, login lockout. Project URLs absent without consent. Media publish rejected while consent is pending. Withdrawal removes the public row. |
| Providers | Email and storage fakes. A storage delete failure on withdrawal leaves the photo unpublished and reports that delivery removal failed. |
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

The owner’s hosting decision is one public origin, with the two builds behind a proxy: the site at `/` and the API at `/api/v1`. Render can host the two processes; a reverse proxy in front of them is what makes the origin match. `FRONTEND_URL` is that origin. Cookies are `SameSite=Lax`, as specified in the architecture doc. Which vendor terminates the public name is still an open choice. Render remains a candidate, not a decision to deploy.

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
- `FRONTEND_URL` (the one public origin), cookie secret, `Secure` and `SameSite=Lax` cookies, no cross-origin credential header
- Health check path `/api/v1/health`
- Initial admin command, password from the host’s secret store
- Cloudinary and Resend keys. Missing keys boot the app in an unconfigured provider mode for email and uploads, and fail the boot only for `DATABASE_URL`, `SESSION_SECRET`, and `FRONTEND_URL` in production
- Backups: free Supabase does not include automatic backups on the pricing table read this run. Say so. A `pg_dump` run by a person is the recovery plan until a paid plan exists
- Logs: do not print secrets. Render free log retention was not copied beyond what section 8.2 cites; confirm retention in the dashboard
- Rollback: redeploy the previous build. Database rollback is a **forward** migration that undoes a change, not `migration:revert` against production, unless you have a fresh backup and explicit approval
- Troubleshooting: paused Supabase project, spun-down Render service, proxy not forwarding `/api/v1` (the browser then never hits the API), CSRF cookie `Path` not visible to the page, SMTP ports blocked (use HTTPS email)

No paid resources, no cards, no production deploy, without a separate explicit approval.

## 9. Decisions recorded (24 Oct 2026)

These replace the questions that were open in the first draft of this plan. Stage 2 is still not approved.

1. **Public content is published content.** Drafts, in-review rows, and scheduled rows are returned only to an authorized admin. Development samples are labelled seed data and are not part of the production seed. The frontend rule that shows a sample even when it is a draft does not apply to the live API.
2. **One public origin.** `https://example.org/` serves the frontend. `https://example.org/api/v1` is the API, including when those are separate processes behind a proxy. Cookies are host-only and `SameSite=Lax`. The design does not use cross-origin credentials.
3. **Project links** are public only when `linksShareConsent` is true and an authorized admin has published the project. URLs are validated. Private-host and non-public GitHub URLs are not placed on the public DTO. Internal notes are never public.
4. **Photo consent does not publish.** Public delivery needs verified consent and a separate publish action. Withdrawing consent unpublishes the photo and deletes or revokes its public delivery. The admin row remains as the record of withdrawal. The path is tested, including a provider failure.
5. **The third trainee track is `GRC & Awareness`** (Governance, Risk and Compliance, plus cybersecurity awareness). The frontend form and fixtures are aligned in a later `frontend` pull request.
6. **The first administrator** is created by a one-off command that reads the mailbox and password from a private environment variable or a prompt. The value is never committed, never pasted into chat, and never logged. Whose mailbox is used is still open (section 10).
7. **Branches stay separate.** The frontend stays on `frontend` (and later in `frontend/`). The API stays on `backend` (and later in `backend/`). Pull request 4, which would have copied the frontend onto `backend`, is closed without merging. Integration uses the contract, two worktrees, and a same-origin proxy.

Also fixed as consequences of those decisions, not as new product choices: bulk publish uses the same consent gates; admin preview of a draft uses the admin API rather than the public URL; `main`, `frontend`, `prototype`, and `backend` are not force-pushed.

## 10. Still open

These do not start Stage 2. The foundation can be built without them, except the mailbox, which is required before the first real administrator exists.

1. **Administrator email.** Not chosen. Use a Foundation-controlled mailbox if the Foundation authorizes one. Otherwise use the owner’s dedicated admin mailbox for development. Supply it through `ADMIN_EMAIL` when the command is run. Do not put it in this document.
2. **Modules, phases, and foundation stats.** Leave them as frontend constants, or store them so an editor can change them?
3. **Lesson files and trainers.** In a later milestone, or out of scope?
4. **Announcements.** The homepage banner is the planned model. A separate list is not, unless you ask for one.
5. **Enquiries.** Store and email only, or add an admin inbox?
6. **Audit screen.** Writes are planned from the first content milestone. A screen that reads them is not, unless you ask.
7. **Schedule clock.** Keep the fixture date `2026-10-24` for “this week”, or use the real clock in `Africa/Accra`?
8. **Upload cap.** The proposal remains 5 MB and jpeg/png/webp until you set another limit.
9. **SMS.** No provider is selected and no core flow depends on it. Say if a later milestone should send texts.
10. **Which host terminates `example.org`.** The shape is decided (one origin, two processes). Render is still only a candidate. No account is created from this plan.
11. **Viewer role.** Keep it in production, or only editor and administrator?
12. **Stage 2 approval.** A separate explicit go-ahead, after this revision.

Content questions in `docs/research.md` and the root README stay open: the hackathon’s link to the bootcamp, curriculum length, which photo belongs to which event, a vector logo, and permission to display foundation-wide counters. Seed copy keeps the current “to be confirmed” labels.

Working assumptions until those are answered, and only where a milestone needs a default: modules and phases stay constants; no lesson-file table and no trainer table; no announcements collection; no enquiry inbox; audit rows are written and not listed; upload limit 5 MB; no SMS; Node 22 LTS; bundled WebP files stay static; Supabase, Render, Cloudinary, and Resend remain the free-tier candidates in section 8, with the limits and the reliability warnings already stated there. The schedule clock stays the real `Africa/Accra` time on the server, while `APP_TODAY` remains a frontend test fixture. Say if any of these assumptions should change.
