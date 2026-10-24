# How the site talks to the API

The React app in `web/` calls the bootcamp API at the **same origin** under `/api/v1`. Requests use relative URLs such as `/api/v1/public/classes`. The browser bundle does not contain a host name.

The session is the HttpOnly cookie `mn_session` (path `/api/v1`). JavaScript never reads it and never writes a token to `localStorage` or `sessionStorage`. Unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`) copy the readable `mn_csrf` cookie into the `X-CSRF-Token` header when that cookie is present. `GET` does not send the header. Login and the public enquiry form have no session yet, so they do not send a CSRF header. Every `fetch` uses `credentials: 'include'`.

A `401` on an admin call clears the in-memory user and sends the visitor to `/admin/login`. A `401` on login or password reset stays on the form. `GET /auth/session` returns `{ authenticated: false }` for an anonymous visitor and does not count as an expired session.

Set `VITE_USE_MOCK_API=true` to use the in-browser fixture store instead. Leave it unset for the live API, including production builds. Vitest sets the flag so the screen tests still see fixture copy.

## Local development

1. Start the API on port 3000 (its `PORT` default). Point it at a local Postgres database. Do not set Resend or Cloudinary credentials for this check.
2. From `web/`, run `npm install` and `npm run dev`. Vite proxies `/api/v1` to `http://localhost:3000`. Override that target with `VITE_API_PROXY` if the API is on another port. That variable is read by the dev server only.
3. Open http://localhost:5173. Public pages show whatever `/api/v1/public/*` returns. An unpublished homepage says “The homepage is not published yet.” Foundation counters stay hidden until `GET /public/foundation-stats` returns rows.
4. Sign in at `/admin/login` with an account created by `npm run admin:create` in `backend/`. The password is not stored in the browser.

```bash
cd web
npm run typecheck
npm run lint
npm test
npm run build
```

## Paths the site calls

| Area | Paths |
| --- | --- |
| Session | `POST /auth/login`, `POST /auth/logout`, `GET /auth/session`, `POST /auth/password-reset/request`, `POST /auth/password-reset/complete` |
| Public reads | `GET /public/home`, `/public/about`, `/public/milestones`, `/public/foundation-stats`, `/public/classes`, `/public/trainees`, `/public/projects`, `/public/events`, `/public/media` |
| Enquiry | `POST /public/enquiries` with `name`, `email`, `topic`, `message`, `consent`, and the honeypot `company` (left empty) |
| Admin lists | `GET /admin/classes`, `/admin/trainees`, `/admin/projects`, `/admin/events` with `q`, `page`, `pageSize`, `sort`, `dir`, `filters.*` |
| Admin writes | `POST` / `PATCH` / `DELETE` on those resources, `POST /admin/classes/bulk` |
| Media | `GET /admin/media`, `POST /admin/media` as JSON metadata or `multipart/form-data` (`alt`, `caption`, `album`, `file`), `POST /admin/media/:id/withdraw-consent`, `DELETE /admin/media/:id` |
| Content | `GET` / `PUT` `/admin/home`, `/admin/about`, `/admin/milestones`, `/admin/settings` |
| Accounts | `GET /admin/users`, `PATCH /admin/users/:id` with `{ role }`, `POST /admin/users/invite` with `{ email, role }`, `POST /admin/account/password` with `{ current, next, confirm }` |

Stored passwords use at least 12 characters. The login form still asks for at least 8, which is the login check.

Admin search does not call `GET /admin/search`. It queries the four list endpoints and opens the matching admin editor. `POST /auth/session/expire` is only used by the mock adapter. A live session ends when the API returns 401 or the user signs out.

Errors keep this shape:

```json
{ "error": { "code": "validation", "message": "Check the highlighted fields.", "fieldErrors": { "title": "Give the class a title." } } }
```

`code` is one of `validation` (422), `unauthenticated` (401), `forbidden` (403), `not_found` (404), `rate_limited` (429), `server` (500), `pending` (501).

The third trainee track is `GRC & Awareness`.
