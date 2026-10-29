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
| POST | `/api/v1/public/trainee-signup` |
| POST | `/api/v1/public/trainee-signup/verify` |
| POST | `/api/v1/public/trainee-signup/resend` |
| GET | `/api/v1/portal/me` |
| GET, PATCH | `/api/v1/portal/profile` |
| POST, DELETE | `/api/v1/portal/profile/photo` |
| POST | `/api/v1/portal/profile/submit` |
| PUT | `/api/v1/portal/consents` |
| GET | `/api/v1/admin/review-queue` |
| PATCH | `/api/v1/admin/review-queue/{traineeId}` |
| POST | `/api/v1/admin/review-queue/{traineeId}/approve` |
| POST | `/api/v1/admin/review-queue/{traineeId}/reject` |
| GET, POST | `/api/v1/portal/portfolio` |
| POST | `/api/v1/portal/portfolio/reorder` |
| GET, PATCH, DELETE | `/api/v1/portal/portfolio/{id}` |
| POST | `/api/v1/portal/portfolio/{id}/submit` |
| POST | `/api/v1/portal/portfolio/{id}/images` |
| DELETE | `/api/v1/portal/portfolio/{id}/images/{mediaId}` |
| POST | `/api/v1/portal/portfolio/{id}/videos` |
| POST | `/api/v1/portal/portfolio/{id}/videos/grant` |
| POST | `/api/v1/portal/portfolio/{id}/videos/file` |
| POST | `/api/v1/portal/portfolio/{id}/videos/complete` |
| DELETE | `/api/v1/portal/portfolio/{id}/videos/{mediaId}` |
| POST | `/api/v1/portal/portfolio/{id}/media/reorder` |
| GET | `/api/v1/public/trainees/{id}/portfolio` |
| GET | `/api/v1/admin/review-queue/items` |
| PATCH, DELETE | `/api/v1/admin/review-queue/items/{id}` |
| POST | `/api/v1/admin/review-queue/items/{id}/approve` |
| POST | `/api/v1/admin/review-queue/items/{id}/reject` |
| GET, POST | `/api/v1/portal/skills` |
| PATCH, DELETE | `/api/v1/portal/skills/{id}` |
| POST | `/api/v1/portal/skills/{id}/submit` |
| GET, POST | `/api/v1/portal/events` |
| PATCH, DELETE | `/api/v1/portal/events/{id}` |
| POST | `/api/v1/portal/events/{id}/submit` |
| POST, DELETE | `/api/v1/portal/events/{id}/certificate` |
| GET | `/api/v1/public/trainees/{id}/skills` |
| GET | `/api/v1/public/trainees/{id}/events` |
| GET | `/api/v1/admin/review-queue/skills` |
| PATCH, DELETE | `/api/v1/admin/review-queue/skills/{id}` |
| POST | `/api/v1/admin/review-queue/skills/{id}/approve` |
| POST | `/api/v1/admin/review-queue/skills/{id}/reject` |
| GET | `/api/v1/admin/review-queue/events` |
| PATCH, DELETE | `/api/v1/admin/review-queue/events/{id}` |
| POST | `/api/v1/admin/review-queue/events/{id}/approve` |
| POST | `/api/v1/admin/review-queue/events/{id}/reject` |
| GET, POST | `/api/v1/admin/trainees/{traineeId}/skills` |
| PATCH, DELETE | `/api/v1/admin/trainees/{traineeId}/skills/{id}` |
| GET, POST | `/api/v1/admin/trainees/{traineeId}/events` |
| PATCH, DELETE | `/api/v1/admin/trainees/{traineeId}/events/{id}` |
| POST | `/api/v1/admin/trainees/{traineeId}/events/{id}/certificate` |
| GET | `/api/v1/progress/trainees` |
| GET | `/api/v1/admin/pending-registrations` |
| POST | `/api/v1/admin/pending-registrations/{id}/approve` |
| POST | `/api/v1/admin/pending-registrations/{id}/reject` |
| GET | `/api/v1/admin/trainee-accounts` |
| POST | `/api/v1/admin/trainee-accounts/{id}/disable` |
| POST | `/api/v1/admin/trainee-accounts/{id}/enable` |
| POST | `/api/v1/admin/trainee-accounts/{id}/resend-invite` |
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
| GET | `/api/v1/public/site-images` |
| GET | `/api/v1/public/site-images/{key}` |
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
| GET, POST `/api/v1/admin/trainees` | GET, PATCH, DELETE, plus POST `.../publish` and `.../unpublish` | Publish requires consent. POST `/api/v1/admin/trainees/photo` uploads the profile photo. |
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

## Work photos

An administrator uploads pictures of a trainee working. Other roles cannot add, publish, or remove them. A new photo is a hidden draft. Publish makes it public. It then appears for that trainee, and for the project when one was chosen.

| Method | Path |
| --- | --- |
| GET | `/api/v1/public/work-photos` |
| GET | `/api/v1/public/work-photos/{id}/file` |
| GET | `/api/v1/admin/work-photos` |
| POST | `/api/v1/admin/work-photos` |
| GET | `/api/v1/admin/work-photos/{id}` |
| GET | `/api/v1/admin/work-photos/{id}/file` |
| DELETE | `/api/v1/admin/work-photos/{id}` |
| POST | `/api/v1/admin/work-photos/{id}/publish` |
| POST | `/api/v1/admin/work-photos/{id}/unpublish` |

`POST` is `multipart/form-data` with `traineeId`, optional `projectId`, `alt`, optional `caption`, and `file`. JPEG, PNG, and WebP only. The public list accepts optional `traineeId` and `projectId`.

## Site images

The logo and the built-in page photographs. Anyone can read them. The list uses the same public cache as the other public reads. Only an administrator can change one. The keys are fixed in the catalogue. Create stores a catalogue key that is missing from the database. It does not invent a new key. There is no delete.

| Method | Path |
| --- | --- |
| GET | `/api/v1/public/site-images` |
| GET | `/api/v1/public/site-images/{key}` |
| GET | `/api/v1/admin/site-images` |
| POST | `/api/v1/admin/site-images` |
| PATCH | `/api/v1/admin/site-images/{key}` |
| POST | `/api/v1/admin/site-images/{key}/image` |
| POST | `/api/v1/admin/site-images/{key}/reset` |

`POST /admin/site-images` is JSON `{ "key" }`. `PATCH` is JSON `{ "alt" }`. Alt may be empty. `POST .../image` is `multipart/form-data` with `file` and `alt`, using the same storage as profile photos and the gallery. JPEG, PNG, and WebP only, at most `UPLOAD_MAX_BYTES`. Reset puts the bundled file back and removes an uploaded object. See `docs/site-images.md`.

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

## Trainee CVs

One current PDF per trainee, at most 5 MB and 10 pages. A replacement deletes the previous file. A new file waits for review. The public trainee payload adds `cv` with `available` and `mode` only. It never includes a file address. A public download works only when the profile is public, the CV is approved, and the trainee chose public. The link lasts five minutes and the PDF is sent as an attachment. Asking for an on-request CV is not part of this API yet.

| Method | Path | Who |
| --- | --- | --- |
| GET, POST, PATCH, DELETE | `/api/v1/portal/cv` | The signed-in trainee |
| GET | `/api/v1/portal/cv/file` | The signed-in trainee |
| POST | `/api/v1/public/trainees/{id}/cv-link` | Anyone, only for a public approved CV |
| GET | `/api/v1/public/cv/{token}` | Anyone with a live signed link |
| GET | `/api/v1/admin/review-queue/cvs` | Staff who can read the admin area |
| POST | `/api/v1/admin/review-queue/cvs/{id}/approve` | Editor or administrator |
| POST | `/api/v1/admin/review-queue/cvs/{id}/reject` | Editor or administrator |
| GET | `/api/v1/admin/trainees/{traineeId}/cv` | Staff who can read the admin area |
| GET | `/api/v1/admin/trainees/{traineeId}/cv/file` | Administrator |
| POST, DELETE | `/api/v1/admin/trainees/{traineeId}/cv` | Administrator |

`POST` upload is `multipart/form-data` with `file` and an optional `visibility` of `private`, `on_request`, or `public`. These responses are not cached.
