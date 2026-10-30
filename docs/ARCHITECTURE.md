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
| `VITE_API_MODE` | `development-adapter` | `development-adapter` |
| `VITE_AUTH_MODE` | `development` | `disabled` |
| `VITE_API_BASE_URL` | empty | empty |

`VITE_AUTH_MODE=disabled` refuses to create a session. A hardcoded password is not accepted as production authentication. Development sign-in matches a fixture email, checks that the password is at least 8 characters, requires an acknowledgement checkbox, and then discards the password.

## Roles

Defined once in `src/domain/permissions.ts`.

- Trainee: `portal.access`, `portal.write`, `account.manage`
- Trainer: `account.manage`
- Viewer: `content.read`, `account.manage`
- Editor: viewer, plus `content.write`, `media.upload`, and `media.write`
- Administrator: editor, plus `users.read`, `users.manage`, `settings.manage`

`content.read` opens the admin shell and `/api/v1/admin`. Trainee and trainer do not have it. The API enforces the same map as this file.

Fixture accounts: `viewer@example.test`, `editor@example.test`, `administrator@example.test`. Display names are Sample Viewer, Sample Editor and Sample Administrator. They are not people.

## Public versus admin data

`isPubliclyListable` allows `listing: sample` (a labelled placeholder) and `listing: public` only when the workflow is published or scheduled. `listing: hidden` never reaches a public page. Public mappers delete internal notes, trainee email and links, and project repository URLs before a public component sees the record.

The fixture module is still in the client bundle because there is no server to withhold drafts. When a backend exists, remove the fixtures from the client and fetch published projections only. Code-splitting the admin does not, by itself, keep drafts out of the bundle while the store is shared.

## Content rules

Verified facts come from `docs/research.md`. Anything else is labelled sample or to be confirmed. The hackathon’s connection to the bootcamp stays “to be confirmed”. People in photographs are not named. Foundation-wide counters are not presented as bootcamp results, and display permission stays TBC until the about editor records it.

## Known limits

- No persistence, media storage, mail, or audit log.
- Password change and invitations always return pending and `delivered: false`.
- Enquiry messages stay in memory with `delivered: false`.
- Calendar files for confirmed dates are built in the browser. They are not an API.
- The platform is not production-ready until a real backend is connected and authentication, authorization, persistence, media, deployment and end-to-end behaviour have been verified.
- Two prototype colours were darkened in `frontend/src/styles/app.css` (the muted statement clause and the TBC chip) so they meet WCAG AA. Layout, type and the green-and-white identity are unchanged.
