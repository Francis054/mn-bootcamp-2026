# API alignment notes

**Status: auth routes below are implemented in `backend/`.** The wider contract (classes, trainees, projects, events, media, and mail) still lives on the `frontend` branch in that branch's `docs/API.md`. This file is the note the website needs when `VITE_API_MODE=live`. It does not change the website. The website stays on the `frontend` branch.

Base path: `/api/v1`. Errors use the shape the website already parses:

```json
{ "error": { "code": "unauthenticated", "message": "The email or password is not correct." } }
```

`code` is `validation` (422), `unauthenticated` (401), `forbidden` (403), `not_found` (404), `rate_limited` (429), `server` (500), or `pending` (501). Field problems add `fieldErrors`.

## Cookies

| Cookie | Who can read it | Path | SameSite | Secure | Domain |
| --- | --- | --- | --- | --- | --- |
| `mn_session` | The server only (HttpOnly) | `/api/v1` | `Lax` | In production | Not set |
| `mn_csrf` | The page, so it can copy the value into `X-CSRF-Token` | `/` | `Lax` | In production | Not set |

The website already sends `credentials: 'include'` and copies `mn_csrf` into `X-CSRF-Token` when the cookie is present. Keep that. Sign-in is the one change that does not require the header, because the first visit has no cookie yet. Sign-out does require the header once `mn_session` is present. A mismatch is `403` with code `forbidden`.

The Vite dev server should keep proxying `/api/v1` to this process so the browser stays on one origin. Do not point the browser at a second origin.

## Auth routes that exist now

### `POST /auth/login`

Body: `{ "email", "password", "developmentAck"? }`.

`developmentAck` is accepted and ignored. The website can keep sending `true` until the checkbox is removed. It is not required. A `role` field in the body is rejected.

Empty email: `422`, field message `Enter your email address.` Empty password: `Enter your password.` Shorter than 8 characters: `Use at least 8 characters.`

Success `200`:

```json
{ "user": { "id", "email", "displayName", "initials", "hue", "role" }, "expiresAt": "2026-10-24T12:00:00.000Z" }
```

`role` is `viewer`, `editor`, or `administrator`. `expiresAt` is an ISO-8601 string. The session token is not in this JSON. It is only in `mn_session`.

Wrong password and unknown mailbox both return `401` and the message `The email or password is not correct.` The server does not name fixture addresses.

Five failures for one mailbox, or too many from one address, return `429` and `Too many sign-in attempts. Wait a minute and try again.` A correct password during the lock gets the same `429`.

### `POST /auth/logout`

Deletes the server session and clears both cookies. `204` with no body. Send `X-CSRF-Token` when `mn_session` is present.

### `GET /auth/session`

No CSRF header. This is the call `AuthProvider` should make on load, because a reload starts with an empty memory.

```json
{ "authenticated": false }
```

or

```json
{ "authenticated": true, "user": { "id", "email", "displayName", "initials", "hue", "role" }, "expiresAt": "2026-10-24T12:00:00.000Z" }
```

There is no `mode: "development"` and no `provider: "development-adapter"`. A missing, idle, or expired session is `authenticated: false`, not an error. A protected route then returns `401`.

Idle time is 30 minutes. The session also ends 12 hours after sign-in. Both can be changed with environment variables. They are not part of the JSON contract.

## What the website should change later

- Call `GET /auth/session` when the app loads, and keep the user from that response.
- Stop requiring `developmentAck` once `VITE_AUTH_MODE` is no longer the development adapter.
- Show the generic sign-in error. Do not expect the three fixture addresses in the message.
- Read `expiresAt` as an ISO string.
- Keep sending `X-CSRF-Token` from `mn_csrf` on sign-out and on later changes.
- Treat `403` with code `forbidden` as "this role cannot do that", and `401` as "sign in again".

The permission names match `web/src/domain/permissions.ts`. A viewer can read content and manage their own account. An editor can also change content and media. An administrator can also manage users and settings. The server enforces that. The React route guard does not.

## Not in this milestone

These paths from the frontend contract are not implemented. They still answer `404` with code `not_found`:

- `POST /auth/password-reset/request`
- `POST /auth/password-reset/complete`
- `POST /auth/session/expire` (development-only on the website; it will not be a production route)
- `POST /admin/account/password`
- every content, media, and user-admin route

There is no public registration route. The first administrator is created with `npm run admin:create` in `backend/`, from a private password. That command is not an HTTP route and it is not in the OpenAPI document. OpenAPI for the routes above is at `/api/docs`.
