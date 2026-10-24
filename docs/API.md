# Proposed API contract

**Status: PENDING IMPLEMENTATION.** No HTTP endpoint in this document exists. The development adapter answers the same paths inside the browser so the interface can be exercised. A production build does not call a network API unless `VITE_API_MODE=live` and `VITE_API_BASE_URL` are both set, and even then authentication stays disabled until `VITE_AUTH_MODE` is changed after the backend is verified.

Base path: `/api/v1`. Errors use one shape:

```json
{ "error": { "code": "validation", "message": "Check the highlighted fields.", "fieldErrors": { "title": "Give the class a title." } } }
```

`code` is one of `validation` (422), `unauthenticated` (401), `forbidden` (403), `not_found` (404), `rate_limited` (429), `server` (500), `pending` (501).

The backend must authenticate every request itself, enforce roles, and return only public fields on `/public/*`. The frontend route guard is not a security boundary. Sessions are expected to be HttpOnly, Secure, SameSite cookies, with a CSRF token available to the client as a non-HttpOnly cookie named `mn_csrf`.

## Auth

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/login` | Body: email, password, developmentAck. Password must not be logged or stored by the client. |
| POST | `/auth/logout` | Clears the server session. |
| GET | `/auth/session` | Returns the current user or unauthenticated. |
| POST | `/auth/password-reset/request` | Always `delivered: false` until mail exists. |
| POST | `/auth/password-reset/complete` | Must not echo the password. |
| POST | `/auth/session/expire` | Development helper only. |

## Public reads

`GET /public/home`, `/public/about`, `/public/milestones`, `/public/classes`, `/public/classes/:id`, and the same pattern for trainees, projects, events, plus `GET /public/media`.

`POST /public/enquiries` validates and, until a mailer exists, returns `delivered: false`.

## Admin

Lists accept `q`, `page`, `pageSize`, `sort`, `dir` and `filters`. Responses are `{ items, page, pageSize, total }`.

| Area | Paths |
| --- | --- |
| Classes, trainees, projects, events | `GET/POST /admin/{resource}`, `PATCH/DELETE /admin/{resource}/:id`, `POST /admin/{resource}/bulk` with `{ ids, action }` of `publish` or `delete` |
| Media | `GET/POST /admin/media`, `PATCH/DELETE /admin/media/:id`. Upload bytes are not implemented. |
| Homepage, about, milestones, settings | `GET/PUT` on `/admin/home`, `/admin/about`, `/admin/milestones`, `/admin/settings` |
| Users | `GET /admin/users`, `PATCH /admin/users/:id` with `{ role }`, `POST /admin/users/invite` (not delivered) |
| Account | `GET /admin/account`, `POST /admin/account/password` (pending until a credential store exists) |
| Search | `GET /admin/search?q=` |

Permissions required beyond `content.read`: writes need `content.write` or `media.write`; users need `users.read` / `users.manage`; settings need `settings.manage`.

## Tests that cannot pass yet

Cookie session issuance, CSRF rejection, server-side authorization independent of this adapter, persisted content across reload, real media upload, and password-reset email. Those are marked `it.todo` in `web/tests/transport.test.ts`.
