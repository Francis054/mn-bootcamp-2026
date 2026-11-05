# Architecture

The public site and admin live in `frontend/`. Stylesheets are imported from `frontend/src/styles/`. Fonts, photos and the logo are served from `frontend/public/assets`.

Home hero photos are `figure.hm-1`, `figure.hm-2` and `figure.hm-3`, and the lime corner is `span.hm-frame`. `frontend/src/styles/pages.css` absolutely positions `figure` inside `.hero__media`, so those elements have to stay figures and a span. The main portrait uses the prototype’s light parallax shift, which is skipped when `prefers-reduced-motion` is set.

## Boundaries

- `src/domain` — types, permissions, publication rules, validation, public projections.
- `src/api/client.ts` — the only function pages use to talk to an API. It prefixes `/api/v1` and chooses a transport from the environment.
- `src/dev/transport.ts` — in-process development adapter. It is not a backend.
- `src/api/liveTransport.ts` — `fetch` with `credentials: 'include'` and an optional non-HttpOnly `mn_csrf` cookie sent as `X-CSRF-Token`. It throws until `VITE_API_BASE_URL` is set. The session cookie must stay HttpOnly and is never read.
- `src/auth/AuthProvider.tsx` — session snapshot and route gate. The gate is a user-experience aid. The adapter, and later the backend, re-checks permission on every protected call.
- `src/dev/session.ts` — memory only. No token and no localStorage session. Reloading the page signs you out and resets content.

## Modes

| Variable | Development | Production build |
| --- | --- | --- |
| `VITE_USE_MOCK_API` | unset, or `true` for the in-browser adapter | unset. The live API is used |
| `VITE_AUTH_MODE` | `development` unless set to `disabled` | unset. `disabled` refuses a mock session |
| `VITE_API_BASE_URL` | empty. The dev server proxies `/api/v1` | empty. The site and the API share one host |

`VITE_USE_MOCK_API=true` is the only switch that loads the in-browser fixture store. A production build leaves it unset.

## Roles

Defined once in `src/domain/permissions.ts`.

- Trainee: `portal.access`, `portal.write`, `account.manage`
- Trainer: `account.manage`
- Viewer: `content.read`, `account.manage`
- Editor: viewer, plus `content.write`, `media.upload`, and `media.write`
- Administrator: editor, plus `users.read`, `users.manage`, `settings.manage`

`content.read` opens the admin shell and `/api/v1/admin`. Trainee and trainer do not have it. `portal.access` opens `/portal` and `GET /api/v1/portal/me`. The API enforces the same map as this file. After sign-in, a trainee goes to `/portal` and a staff account goes to `/admin`. The public header links to trainee sign-in. It does not link to the admin panel. A trainee’s portfolio (projects, labs, and case studies) is edited at `/portal` and appears on the public profile only after approval. A CV is uploaded at `/portal` as one PDF. The public profile says only whether that CV can be downloaded or requested. Someone can ask for an on-request CV, and can message a trainee who agreed to contact, without seeing an email address. The profile PDF leaves both the email and the CV out. It does not link to the admin area and it does not include a file address.

Fixture accounts: `viewer@example.test`, `editor@example.test`, `administrator@example.test`. Display names are Sample Viewer, Sample Editor and Sample Administrator. They are not people.

## Public versus admin data

`isPubliclyListable` allows `listing: sample` (a labelled placeholder) and `listing: public` only when the workflow is published or scheduled. `listing: hidden` never reaches a public page. Public mappers delete internal notes, trainee email and links, and project repository URLs before a public component sees the record.

The fixture module is still in the client bundle because there is no server to withhold drafts. When a backend exists, remove the fixtures from the client and fetch published projections only. Code-splitting the admin does not, by itself, keep drafts out of the bundle while the store is shared.

## Content rules

Verified facts come from `docs/research.md`. Anything else is labelled sample or to be confirmed. The hackathon’s connection to the bootcamp stays “to be confirmed”. People in photographs are not named. Foundation-wide counters are not presented as bootcamp results, and display permission stays TBC until the about editor records it.

## Known limits

The API in `backend/` is Express and TypeORM, not a frontend-only prototype. Sessions are opaque cookies. Passwords are Argon2id. Public pages read published rows. The in-browser development adapter is used only when `VITE_USE_MOCK_API=true`.

- “This week” and “past” use the real clock (`appToday` in `frontend/src/domain/format.ts`). Unit tests pin that clock to 24 October 2026.
- Calendar files for confirmed dates are still built in the browser.
- Two prototype colours were darkened in `frontend/src/styles/app.css` (the muted statement clause and the TBC chip) so they meet WCAG AA. Layout, type and the green-and-white identity are unchanged.
- Render deploys `main`. `dev` can be ahead of `main`. Free Render may not run migrations. See `docs/deployment.md`.
