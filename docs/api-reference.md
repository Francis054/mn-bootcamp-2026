# API reference

Base path: `/api/v1`. The process serves this same list as OpenAPI 0.9.0 at `/api/docs/openapi.json`, with Swagger UI at `/api/docs`. `backend/tests/unit/openapi-routes.test.ts` fails if a router method is missing from that document, or if the document lists a method the routers do not register.

`/api/docs` and `/api/docs/openapi.json` are documentation pages. They are not operations inside the OpenAPI `paths` object.

Paths below use `{id}` for one path segment. Unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`) need the session cookie and a matching `X-CSRF-Token` header once `mn_session` is present. Sign-in and the public enquiry do not, because there is no session yet. `GET` does not send the CSRF header.

Errors use `{ "error": { "code", "message", "fieldErrors"? } }`. `code` is `validation` (422), `unauthenticated` (401), `forbidden` (403), `not_found` (404), `rate_limited` (429), `server` (500), or `pending` (501).

## Health and session

| Method | Path |
| --- | --- |
| GET | `/api/v1/health` |
| POST | `/api/v1/auth/login` |
| POST | `/api/v1/auth/logout` |
| GET | `/api/v1/auth/session` |
| POST | `/api/v1/auth/password-reset/request` |
| POST | `/api/v1/auth/password-reset/complete` |
| POST | `/api/v1/admin/account/password` |

`GET /api/v1/health` returns 200 when the database answers and 503 when it does not. The body is `{ status, database, uptimeSeconds }` with `status` of `ok` or `degraded` and `database` of `up` or `down`.

Login sets `mn_session` (HttpOnly, path `/api/v1`) and `mn_csrf` (readable, path `/`). Neither cookie sets `Domain`. `SameSite` is `Lax`. `Secure` is set when `NODE_ENV=production`. The password in the login body is checked at 8 characters. Stored passwords need 12 characters, a letter, and a number.

## Public reads

These return published rows only. A hidden listing is omitted. Trainee profiles also need consent. Photos also need verified consent. A scheduled event stays off the public list until its Africa/Accra start.

| Method | Path |
| --- | --- |
| GET | `/api/v1/public/home` |
| GET | `/api/v1/public/about` |
| GET | `/api/v1/public/milestones` |
| GET | `/api/v1/public/foundation-stats` |
| GET | `/api/v1/public/tracks` |
| GET | `/api/v1/public/tracks/{id}` |
| GET | `/api/v1/public/modules` |
| GET | `/api/v1/public/modules/{id}` |
| GET | `/api/v1/public/phases` |
| GET | `/api/v1/public/phases/{id}` |
| GET | `/api/v1/public/classes` |
| GET | `/api/v1/public/classes/{id}` |
| GET | `/api/v1/public/trainees` |
| GET | `/api/v1/public/trainees/{id}` |
| GET | `/api/v1/public/projects` |
| GET | `/api/v1/public/projects/{id}` |
| GET | `/api/v1/public/events` |
| GET | `/api/v1/public/events/{id}` |
| GET | `/api/v1/public/media` |
| GET | `/api/v1/public/media/{id}` |
| POST | `/api/v1/public/enquiries` |

The phase id is one digit from 1 to 9. The enquiry body is `name`, `email`, `topic`, `message`, `consent`, and the honeypot `company` (leave it empty).

An unpublished homepage or about page is 404. The website shows “The homepage is not published yet.” Foundation counters are an empty list until settings are published with rows.

## Admin content

Drafts are saved with `PUT`. The public site reads the published copy, which changes only on `POST .../publish`. The admin screens for the homepage, about page, timeline, and settings include Publish and Unpublish. See `DEPLOY-CHECKLIST.txt`.

| Method | Path |
| --- | --- |
| GET | `/api/v1/admin/home` |
| PUT | `/api/v1/admin/home` |
| POST | `/api/v1/admin/home/publish` |
| POST | `/api/v1/admin/home/unpublish` |
| GET | `/api/v1/admin/about` |
| PUT | `/api/v1/admin/about` |
| POST | `/api/v1/admin/about/publish` |
| POST | `/api/v1/admin/about/unpublish` |
| GET | `/api/v1/admin/milestones` |
| PUT | `/api/v1/admin/milestones` |
| POST | `/api/v1/admin/milestones/publish` |
| POST | `/api/v1/admin/milestones/unpublish` |
| GET | `/api/v1/admin/settings` |
| PUT | `/api/v1/admin/settings` |
| POST | `/api/v1/admin/settings/publish` |
| POST | `/api/v1/admin/settings/unpublish` |

Settings, including `foundationStats`, require `settings.manage`. Other content writes require `content.write`.

## Admin catalogue, people, projects, events

List routes accept `q`, `page`, `pageSize`, `sort`, and `dir`. There is no `GET /admin/search`. Class bulk is the only bulk route: `POST /api/v1/admin/classes/bulk` with `{ ids, action }` where `action` is `publish` or `delete`.

Each resource below has the same shape: list and create on the collection, then get, patch, delete, publish, and unpublish on `{id}`.

| Methods on the collection | Methods on `/{id}` | Extra |
| --- | --- | --- |
| GET, POST `/api/v1/admin/tracks` | GET, PATCH, DELETE, plus POST `.../publish` and `.../unpublish` | |
| GET, POST `/api/v1/admin/modules` | GET, PATCH, DELETE, plus POST `.../publish` and `.../unpublish` | |
| GET, POST `/api/v1/admin/phases` | GET, PATCH, DELETE, plus POST `.../publish` and `.../unpublish` | |
| GET, POST `/api/v1/admin/classes` | GET, PATCH, DELETE, plus POST `.../publish` and `.../unpublish` | POST `/api/v1/admin/classes/bulk` |
| GET, POST `/api/v1/admin/trainees` | GET, PATCH, DELETE, plus POST `.../publish` and `.../unpublish` | Publish requires consent |
| GET, POST `/api/v1/admin/projects` | GET, PATCH, DELETE, plus POST `.../publish` and `.../unpublish` | |
| GET, POST `/api/v1/admin/events` | GET, PATCH, DELETE, plus POST `.../publish` and `.../unpublish` | |

## Gallery

| Method | Path |
| --- | --- |
| GET | `/api/v1/admin/media` |
| POST | `/api/v1/admin/media` |
| GET | `/api/v1/admin/media/{id}` |
| PATCH | `/api/v1/admin/media/{id}` |
| DELETE | `/api/v1/admin/media/{id}` |
| POST | `/api/v1/admin/media/{id}/publish` |
| POST | `/api/v1/admin/media/{id}/unpublish` |
| POST | `/api/v1/admin/media/{id}/withdraw-consent` |

`POST` accepts JSON metadata or `multipart/form-data` with `alt`, `caption`, `album`, and `file`. A new photo starts unpublished. `PATCH` with `{ "consent": "verified" }` records consent and does not publish. Publish is refused until consent is verified. The public gallery also requires `listing` other than `hidden`.

## Accounts

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/api/v1/admin/users` | `users.read` |
| PATCH | `/api/v1/admin/users/{id}` | `users.manage`, body `{ role }` |
| POST | `/api/v1/admin/users/invite` | `users.manage`, body `{ email, role }` |
| GET | `/api/v1/admin/enquiries` | `users.manage` |
| PATCH | `/api/v1/admin/enquiries/{id}` | `users.manage` |
| DELETE | `/api/v1/admin/enquiries/{id}` | `users.manage` |

There is no public registration. There is no `POST /auth/session/expire`.
