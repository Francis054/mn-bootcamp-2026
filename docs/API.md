# API alignment notes

**Status: auth, curriculum, and trainee routes below are implemented in `backend/`.** The rest of the contract (projects, events, media, and mail) still lives on the `frontend` branch in that branch's `docs/API.md`. This file is the note the website needs when `VITE_API_MODE=live`. It does not change the website. The website stays on the `frontend` branch.

Base path: `/api/v1`. Errors use the shape the website already parses:

```json
{
  "error": {
    "code": "unauthenticated",
    "message": "The email or password is not correct."
  }
}
```

`code` is `validation` (422), `unauthenticated` (401), `forbidden` (403), `not_found` (404), `rate_limited` (429), `server` (500), or `pending` (501). Field problems add `fieldErrors`.

## Cookies

| Cookie       | Who can read it                                        | Path      | SameSite | Secure        | Domain  |
| ------------ | ------------------------------------------------------ | --------- | -------- | ------------- | ------- |
| `mn_session` | The server only (HttpOnly)                             | `/api/v1` | `Lax`    | In production | Not set |
| `mn_csrf`    | The page, so it can copy the value into `X-CSRF-Token` | `/`       | `Lax`    | In production | Not set |

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

The permission names match `web/src/domain/permissions.ts`. A viewer can read content and manage their own account. An editor can also change content and media, which includes creating, editing, publishing, and deleting classes and trainee profiles. An administrator can do that too, and can also manage users and settings. The server enforces that. The React route guard does not. There is no separate publish permission in the website's map, so this API does not invent one.

## Curriculum routes that exist now

Public lists return a row only when `publicationStatus` is `published` and `listing` is not `hidden`. That is stricter than the website's `isPubliclyListable`, which still shows a sample draft. The website should switch to this rule when it calls the API. A missing or unpublished class is `404` with `That page is not available.`

| Method           | Path                                                          | Who                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET              | `/public/classes` and `/public/classes/:id`                   | Anyone. `PublicLesson`: the lesson without `internalNotes`.                                                                                                      |
| GET              | `/public/modules` and `/public/modules/:id`                   | Anyone. Same fields as `ModuleInfo`: `id`, `name`, `short`, `icon`, `summary`.                                                                                   |
| GET              | `/public/phases` and `/public/phases/:id`                     | Anyone. `id` is a number. `modules` is the display names of modules that are themselves public.                                                                  |
| GET              | `/public/tracks` and `/public/tracks/:id`                     | Anyone. `id`, `name`, `summary`. Names are `Blue team`, `Red team`, and `GRC & Awareness`.                                                                       |
| GET              | `/admin/classes`                                              | `content.read`. Page `{ items, page, pageSize, total }`.                                                                                                         |
| GET              | `/admin/classes/:id`                                          | `content.read`. Full lesson, including a draft and `internalNotes`.                                                                                              |
| POST             | `/admin/classes`                                              | `content.write`.                                                                                                                                                 |
| PATCH            | `/admin/classes/:id`                                          | `content.write`. Omitted fields stay as they are.                                                                                                                |
| DELETE           | `/admin/classes/:id`                                          | `content.write`. `{ deleted: true, id }`.                                                                                                                        |
| POST             | `/admin/classes/:id/publish` and `/unpublish`                 | `content.write`. Publish does not change `listing`. Unpublish sets `draft`.                                                                                      |
| POST             | `/admin/classes/bulk`                                         | `content.write`. Body `{ ids, action }` of `publish` or `delete`. Response `{ ok, action, count, rejected }`. Missing ids are in `rejected` and are not changed. |
| GET/POST         | `/admin/tracks`, `/admin/modules`, `/admin/phases`            | Same permissions. Admin lists are arrays, not pages.                                                                                                             |
| GET/PATCH/DELETE | `/admin/{tracks,modules,phases}/:id`                          | Same permissions.                                                                                                                                                |
| POST             | `/admin/{tracks,modules,phases}/:id/publish` and `/unpublish` | `content.write`.                                                                                                                                                 |

The class list query uses `filters.moduleId`, `filters.scheduleStatus`, and `filters.publicationStatus` as separate query keys, which is how `liveTransport` already sends them. `sort=week` sorts as a number. If `sort` is omitted, the list is ordered by week ascending. An unknown sort is `422`.

`scheduleStatus` is calculated from the class date and today's date in Africa/Accra. It is not stored.

Field messages for a class match the form: `Give the class a title.`, `Use at least 6 characters.`, `Choose a module.`, `Enter a week from 1 to 18.`, `Pick a date.`, `Write a short summary for the class card.`, `Use at least 20 characters.`

`npm run seed` inserts labelled sample rows when those ids are missing. It is not an HTTP route and it is not in the OpenAPI document. It does not insert foundation-wide counters. It also inserts twelve labelled trainee profiles. Those profiles are published and have `consentReceived: false`, so `GET /public/trainees` does not return them.

Modules and phases are editable. Foundation-wide counters stay for the settings milestone (`GET/PUT /admin/settings` and the homepage singleton). They are not implemented here.

## Trainee routes that exist now

A public trainee needs `publicationStatus: published`, a listing other than `hidden`, and `consentReceived: true`. A sample label does not publish a draft. The public object matches `PublicTrainee`: it omits `email`, `internalNotes`, `linkedin`, `portfolio`, and `consentReceived`. It also omits `consentReceivedAt`, `consentRecordedBy`, and `consentWithdrawnAt`. A missing or private profile is `404` with `That page is not available.`

The admin object matches `Trainee` and adds those three consent fields. `consentRecordedBy` is the account id of the editor who recorded consent, not a mailbox. Clearing `consentReceived` sets `publicationStatus` to `draft` in the same request, including when the body also asks for `published`. The listing is left as the editor sent it. The adapter's rewrite from `public` to `sample` is not copied.

`published` is rejected with `Consent is required before this profile can be published.` while consent is false. Publish does not change `listing`.

The track check is `Blue team`, `Red team`, or `GRC & Awareness`. `General` and `GRC & awareness` are `422` with `Choose Blue team, Red team, or GRC & Awareness.`

| Method   | Path                                          | Who                                                                                                                                                          |
| -------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET      | `/public/trainees` and `/public/trainees/:id` | Anyone. `PublicTrainee`.                                                                                                                                     |
| GET      | `/admin/trainees`                             | `content.read`. Page `{ items, page, pageSize, total }`.                                                                                                     |
| GET      | `/admin/trainees/:id`                         | `content.read`. Full profile, including a draft, the email, and the notes.                                                                                   |
| POST     | `/admin/trainees`                             | `content.write`.                                                                                                                                             |
| PATCH    | `/admin/trainees/:id`                         | `content.write`. Omitted fields stay as they are. Withdrawal unpublishes immediately.                                                                        |
| DELETE   | `/admin/trainees/:id`                         | `content.write`. `{ deleted: true, id }`.                                                                                                                    |
| POST     | `/admin/trainees/:id/publish` and `/unpublish` | `content.write`. Publish requires consent and does not change `listing`. Unpublish sets `draft` and leaves consent as it is.                                 |

There is no `POST /admin/trainees/bulk`. The class list is the only bulk action. The trainee list in the website has no bulk bar.

The list query uses `filters.track` and `filters.focus` as separate query keys. Search matches `displayName`, `track`, and skills. It does not match `email`. The default page size is 8 and the default sort is `displayName`. An unknown sort is `422`.

Field messages match the form: `Enter a display name.`, `Enter your email address.`, `Enter a valid email address, like name@example.com.`, `Enter a full link starting with https://`. A duplicate email is `422` with `A trainee with that email already exists.` The address is not repeated in the error.

A module that still has trainee profiles cannot be deleted until those profiles are moved or deleted.

Projects are the next milestone. `linksShareConsent` and the public project URL rule are not implemented here.

## Not in this milestone

These paths from the frontend contract are not implemented. They still answer `404` with code `not_found`:

- `POST /auth/password-reset/request`
- `POST /auth/password-reset/complete`
- `POST /auth/session/expire` (development-only on the website; it will not be a production route)
- `POST /admin/account/password`
- `POST /admin/trainees/bulk`
- projects, events, media, and the homepage, about, and settings singletons

There is no public registration route. The first administrator is created with `npm run admin:create` in `backend/`, from a private password. That command is not an HTTP route and it is not in the OpenAPI document. OpenAPI for the routes above is at `/api/docs`.
