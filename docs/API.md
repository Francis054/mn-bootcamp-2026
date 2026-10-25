# API alignment notes

The route list that matches the running process is in `docs/api-reference.md`. The same list is served as OpenAPI at `/api/docs/openapi.json`. A test fails if those two lists drift apart.

**Status: auth, accounts, curriculum, trainee, project, event, media, content singleton, enquiry, and site image routes below are implemented in `backend/`.** The website that calls them is `frontend/`.

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

The permission names match `frontend/src/domain/permissions.ts`. A trainee or a trainer can read content, upload media, and manage their own account. A viewer can read content and manage their own account. An editor can also change content and publish media. Content changes use `content.write` and cover classes, trainee profiles, projects, events, the homepage, the about page, and the timeline. Photo uploads use `media.upload`. Publishing a photo, confirming consent, and deleting a photo use `media.write`. Settings, including the foundation counters, use `settings.manage`. Invitations, role changes, and the enquiry inbox use `users.manage`. Listing accounts uses `users.read`. Only an administrator has those last permissions. The server enforces that. The React route guard does not. There is no separate publish permission. An administrator may send `{ confirmConsent: true }` on `POST /admin/media/:id/publish` to verify consent and publish together. Any other role that sends `confirmConsent` is refused. An empty publish body still requires consent that was verified earlier and does not change the listing.

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

| Method | Path                                           | Who                                                                                                                          |
| ------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/public/trainees` and `/public/trainees/:id`  | Anyone. `PublicTrainee`.                                                                                                     |
| GET    | `/admin/trainees`                              | `content.read`. Page `{ items, page, pageSize, total }`.                                                                     |
| GET    | `/admin/trainees/:id`                          | `content.read`. Full profile, including a draft, the email, and the notes.                                                   |
| POST   | `/admin/trainees`                              | `content.write`.                                                                                                             |
| PATCH  | `/admin/trainees/:id`                          | `content.write`. Omitted fields stay as they are. Withdrawal unpublishes immediately.                                        |
| DELETE | `/admin/trainees/:id`                          | `content.write`. `{ deleted: true, id }`.                                                                                    |
| POST   | `/admin/trainees/photo`                        | `content.write`. One JPEG, PNG, or WebP. Returns `{ photoUrl, storageKey }`. A viewer, trainee, or trainer is refused. |
| POST   | `/admin/trainees/:id/publish` and `/unpublish` | `content.write`. Publish requires consent and does not change `listing`. Unpublish sets `draft` and leaves consent as it is. |
| GET    | `/public/uploads/:key`                         | Anyone. The image bytes when the photo is kept in memory. Cloudinary photos are not served here. |

There is no `POST /admin/trainees/bulk`. The class list is the only bulk action. The trainee list in the website has no bulk bar.

The list query uses `filters.track` and `filters.focus` as separate query keys. Search matches `displayName`, `track`, and skills. It does not match `email`. The default page size is 8 and the default sort is `displayName`. An unknown sort is `422`.

Field messages match the form: `Enter a display name.`, `Enter your email address.`, `Enter a valid email address, like name@example.com.`, `Enter a full link starting with https://`. A duplicate email is `422` with `A trainee with that email already exists.` The address is not repeated in the error.

A module that still has trainee profiles cannot be deleted until those profiles are moved or deleted. A trainee who is still listed on a project cannot be deleted until they are removed from that project.

`linksShareConsent` is the agreement that lets a published project show its code and demo links. It is separate from profile consent. Clearing it does not unpublish the profile. The timestamps and the account id that recorded it stay on the admin trainee. They are not on `PublicTrainee`.

`photoUrl` is the profile photo. It is null until an editor saves one. `POST /admin/trainees/photo` stores the file and returns `photoUrl` and `photoStorageKey`. The profile save sends both. `photoUrl: null` removes the photo and deletes the stored file. `photoStorageKey` stays off the public profile. `GET /public/uploads/:key` serves a photo kept in memory. When Cloudinary is configured, `photoUrl` is the https address Cloudinary returns.

## Project routes that exist now

A public project needs `publicationStatus: published` and a listing other than `hidden`. A sample label does not publish a draft. The public object matches `PublicProject`: it omits `internalNotes`, `labOnlyConfirmed`, and `shareAgreed`. It also omits `traineeIds`. A missing or private project is `404` with `That page is not available.`

`repositoryUrl` and `demoUrl` are added to that public object only when the project is published, the listing is not hidden, at least one trainee is linked, and every linked trainee has `linksShareConsent: true`. Clearing that flag on a trainee removes both links from the next public read. The project stays published. `shareAgreed` is stored for the current form and does not publish the links. Publish does not set link consent and does not change `listing`. The adapter's rewrite of a published listing to `sample` is not copied.

A stored link must be `https`, at most 500 characters, with no user or password in the address, and not a private or loopback host. `javascript:` and `data:` are refused. A GitHub repository (`github.com`) is checked with one unauthenticated GET and no redirects. Any answer other than 200, including a network failure, omits `repositoryUrl`. The admin project then includes `repositoryLinkNote`. Demo links are not fetched. The admin list leaves `repositoryLinkNote` null so the list does not call GitHub.

The admin object matches `Project` and adds `traineeIds`, `repositoryLinkNote`, and `updatedAt`. `team` stays a list of display names. It does not create the trainee relation. Send `traineeIds` for that.

| Method | Path                                           | Who                                                                               |
| ------ | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| GET    | `/public/projects` and `/public/projects/:id`  | Anyone. `PublicProject`, with links only when consent and publication allow them. |
| GET    | `/admin/projects`                              | `content.read`. Page `{ items, page, pageSize, total }`.                          |
| GET    | `/admin/projects/:id`                          | `content.read`. Full project, including a draft, the notes, and the links.        |
| POST   | `/admin/projects`                              | `content.write`.                                                                  |
| PATCH  | `/admin/projects/:id`                          | `content.write`. Omitted fields stay as they are.                                 |
| DELETE | `/admin/projects/:id`                          | `content.write`. `{ deleted: true, id }`.                                         |
| POST   | `/admin/projects/:id/publish` and `/unpublish` | `content.write`. Publish does not change `listing`. Unpublish sets `draft`.       |

There is no `POST /admin/projects/bulk`. The class list is the only bulk action.

The list query uses `q`, `page`, `pageSize`, `sort`, `dir`, and `filters.type`. Search matches the title and the type. The default page size is 8. An unknown sort is `422`. An unknown type filter is `422` with `Choose a type.`

Field messages match the form: `Give the project a title.`, `Use at least 6 characters.`, `Choose a type.`, `Write an abstract of at least 30 characters.`, `Use at least 30 characters.` A link that is not `https`, or that contains a password, is `Enter a full link starting with https://.` A private or loopback host is `Use a public https address.` The rejected address is not repeated in the error.

A module that still has projects cannot be deleted until those projects are moved or deleted.

`npm run seed` also inserts six labelled projects. They are `in_review` or `draft`, with blank links, so `GET /public/projects` does not return them.

## Event routes that exist now

A public event needs `publicationStatus: published` and a listing other than `hidden`. A sample label does not publish a draft. A row with `publicationStatus: scheduled` stays off `/public/events` until its start. The start is a clock on `date` in Africa/Accra. Ghana does not use daylight saving, so that clock is UTC. An empty `startTime` means midnight. `dateTbc: true` means the date is not confirmed: `startTime` and `endTime` must be blank, and the scheduled row does not become public on its own.

The public object matches `PublicEvent`. It omits `internalNotes`. It keeps `body`, `source`, `sourceUrl`, `showOnAnniversary`, and the times. A missing or private event is `404` with `That page is not available.` There is no `.ics` route.

The admin object matches `BootcampEvent` and adds `updatedAt`. PATCH leaves out a field to keep the stored value, including `body`. An omitted body on create becomes `{ kind: "placeholder", text }` from the summary. Publish does not change `listing` and does not clear `dateTbc`.

`verified: true` requires `sourceUrl`. The link must be `https`, at most 500 characters, with no user or password, and not a private or loopback host. The rejected address is not repeated in the error.

| Method | Path                                         | Who                                                                                  |
| ------ | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| GET    | `/public/events` and `/public/events/:id`    | Anyone. `PublicEvent`. Scheduled rows appear only once their Accra start has passed. |
| GET    | `/admin/events`                              | `content.read`. Page `{ items, page, pageSize, total }`.                             |
| GET    | `/admin/events/:id`                          | `content.read`. Full event, including a draft and the notes.                         |
| POST   | `/admin/events`                              | `content.write`.                                                                     |
| PATCH  | `/admin/events/:id`                          | `content.write`. Omitted fields stay as they are.                                    |
| DELETE | `/admin/events/:id`                          | `content.write`. `{ deleted: true, id }`.                                            |
| POST   | `/admin/events/:id/publish` and `/unpublish` | `content.write`. Publish does not change `listing`. Unpublish sets `draft`.          |

There is no `POST /admin/events/bulk`. The class list is the only bulk action.

The list query uses `q`, `page`, `pageSize`, `sort`, `dir`, `filters.kind`, and `filters.verification`. Search matches the title and the place. The default sort is `date` ascending. The default page size is 8. `filters.verification` is `verified`, `tbc`, or `sample`. An unknown sort is `422`.

Field messages match the form: `Give the event a name.`, `Enter a venue, or “Venue to be confirmed”.`, `Write a summary of at least 20 characters.`, `Use at least 20 characters.` A source link that is not `https` is `Enter a full link starting with https://`. A private host is `Use a public https address.` A clock uses `Use 24-hour time, like 17:00.` An end that is not later the same day is `End the event after it starts.`

`npm run seed` inserts six labelled events. The hackathon has `dateTbc: true`, place `Venue to be confirmed`, and blank times. The midpoint is `scheduled` and `sample: true`. Each internal note starts with `Sample event.`

## Media routes that exist now

A public photo needs `publicationStatus: published`, a listing other than `hidden`, and `consent: verified`. A sample label does not publish a draft. Pending and withdrawn photos stay off `/public/media`. Verifying consent does not publish the photo. Publish is a second request, and it is refused until consent is already verified. One request that verifies consent and sets `publicationStatus: published` is `422` with `Verifying consent does not publish the photo.`

The public object is `id`, `file`, `src`, `width`, `height`, `caption`, `alt`, and `album`. It omits `listing`, `publicationStatus`, consent, and the storage key. A missing or private photo is `404` with `That page is not available.`

`GET /admin/media` is an array, not a page. Album filtering stays in the browser. The admin object matches the website's `MediaItem` and adds `withdrawn` consent, `consentVerifiedAt`, `consentRecordedBy` (the account id, not the mailbox), `consentWithdrawnAt`, `storageProvider`, and `updatedAt`.

A JSON `POST /admin/media` cannot set `src`, `consent`, or `publicationStatus`. The new row is pending, draft, and hidden, with an empty `src`. A multipart post stores one JPEG, PNG, or WebP. The bytes are sniffed. The file name and the part content type are not trusted, and the stored `file` is `upload`. The cap is `UPLOAD_MAX_BYTES`, 5 MB unless the host sets another whole number up to 10 MB. Development and tests store the bytes in memory. Production uses Cloudinary when `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are all set, and refuses uploads when none of them are set. This API does not rewrite image bytes to remove EXIF. The plan does not ask for that. Static seed rows point at no uploaded object. A request does not delete a file from git.

`POST /admin/media/:id/withdraw-consent` sets consent to `withdrawn`, the workflow to `draft`, and the listing to `hidden`, clears `src`, and deletes an uploaded object. The admin row stays. If storage cannot delete the object, the photo is already off the public site, the storage key is kept, and the response is `Delivery removal failed. The photo is already off the public site. Try again.` The audit row stores the action and the photo id. It does not store the alt text, the caption, the address, or the bytes.

| Method | Path                                                | Who                                                                                          |
| ------ | --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| GET    | `/public/media` and `/public/media/:id`             | Anyone. `PublicMedia`. Published, visible, and verified only.                               |
| GET    | `/admin/media`                                      | `content.read`. An array of every photo, including drafts.                                  |
| GET    | `/admin/media/:id`                                  | `content.read`. Full photo, including a draft and consent bookkeeping.                      |
| POST   | `/admin/media`                                      | `media.upload`. JSON metadata or one multipart image. A trainee or trainer can upload.     |
| PATCH  | `/admin/media/:id`                                  | `media.write`. Omitted fields stay as they are. Verified consent does not publish.          |
| DELETE | `/admin/media/:id`                                  | `media.write`. `{ deleted: true, id }`. An upload is removed from storage first.            |
| POST   | `/admin/media/:id/publish` and `/unpublish`         | `media.write`. An empty body does not change `listing`. An administrator may send `confirmConsent` and `listing`. |
| POST   | `/admin/media/:id/withdraw-consent`                 | `media.write`. Unpublishes immediately and deletes an uploaded object.                      |

There is no `POST /admin/media/bulk`. The class list is the only bulk action.

Field messages: `Describe the image without naming anyone.`, `Use at most 300 characters.`, `Choose an album.`, `Use a JPEG, PNG, or WebP image.`, `Use an image of at most 5 MB.` A withdrawal sent as `consent: withdrawn` on PATCH is `Use the withdrawal action to remove consent.`

`npm run seed` inserts three labelled placeholders, `sample-banner`, `sample-bench`, and `sample-mark`. They are not photographs of people. Consent is pending and the workflow is draft, so `GET /public/media` does not return them.

## Content routes that exist now

Public homepage, about, timeline, and foundation counters are the published copies. A draft stays on the admin routes. Saving an edit does not publish. `publicationStatus` on a write is ignored. Publish copies the draft to the public document. Unpublish leaves the draft in place and takes the public copy down.

`GET /public/home` is `HomepageContent`, including `announcement` and `showAnnouncement`. That pair is the homepage banner. There is no announcements collection. `showAnnouncement: false` keeps the words in the document. The public object omits `publicationStatus`. A missing publish is `404` with `That page is not available.`

`GET /public/about` is `AboutContent`. A PUT that omits `address`, `email`, or `website` leaves those fields as they are. `figuresPermission` records whether the counters may be presented as display-ready. It does not publish the counters.

`GET /public/milestones` is an array. The array order is the timeline order. The public array is empty until publish. `GET /admin/milestones` is `{ milestones, publicationStatus }` so the editor can show whether the current draft is live. `PUT /admin/milestones` still takes and returns the array.

Foundation counters live on settings. `GET /admin/settings` adds `foundationStats` and `publicationStatus` to the website's settings shape. `GET /public/foundation-stats` returns the published counters, or `[]` when settings are not published. It does not include the contact email. The seed counters are labelled samples with value `0`.

| Method | Path | Who |
| --- | --- | --- |
| GET | `/public/home` | Anyone. Published homepage only. |
| GET | `/public/about` | Anyone. Published about page only. |
| GET | `/public/milestones` | Anyone. Published timeline, or an empty array. |
| GET | `/public/foundation-stats` | Anyone. Published counters, or an empty array. |
| GET | `/admin/home`, `/admin/about` | `content.read`. The draft, plus `publicationStatus`. |
| PUT | `/admin/home`, `/admin/about` | `content.write`. Omitted fields stay. Does not publish. |
| POST | `/admin/home/publish` and `/unpublish` | `content.write`. The same pair exists for about and milestones. |
| GET | `/admin/milestones` | `content.read`. `{ milestones, publicationStatus }`. |
| PUT | `/admin/milestones` | `content.write`. Body `{ milestones }`. |
| GET | `/admin/settings` | `settings.manage`. |
| PUT | `/admin/settings` | `settings.manage`. Site name is required. Contact email must be valid. Omitted counters stay. |
| POST | `/admin/settings/publish` and `/unpublish` | `settings.manage`. Publish also publishes the counters. |

Field messages include `Enter a site name.`, `Enter your email address.`, `Enter a valid email address, like name@example.com.`, `Enter a link or a site path.`, and `Choose a theme.` A script URL is refused and is not repeated in the error.

`npm run seed` inserts the four singletons as drafts. The homepage lead is the public sentence. Two timeline descriptions start with `Sample copy for the development seed.` The counters are `Sample counter` rows with value `0`. Run the command again and it leaves an edited row alone. It does not insert enquiries. Opening an admin content screen also creates a missing draft, so a database that was never seeded can still be edited and published.

## Account routes that exist now

Password changes, resets, and invitations store a hash. The stored password uses the same 12-character rule as `npm run admin:create`. The website form still says 8 characters. A shorter password is `422` with `Use at least 12 characters.`

`POST /auth/password-reset/request` body `{ email }`. Success is always:

```json
{
  "accepted": true,
  "delivered": false,
  "message": "If an account exists for that address, a reset message will be sent."
}
```

There is no `developmentResetPath`. A missing mailbox and a real mailbox return that same JSON. A badly formed address is `422`. Too many requests is `429` with `Too many requests. Wait a minute and try again.` That `429` also does not say whether the mailbox exists.

`POST /auth/password-reset/complete` body `{ token, password, confirm }`. This accepts a reset link and an invitation link. Success:

```json
{
  "completed": true,
  "passwordStored": true,
  "message": "The password is saved. Sign in with the new password."
}
```

A missing, used, or expired token is field `token`: `This reset link is missing, used or expired.` Empty password is `Choose a new password.` A mismatch is `The two passwords do not match.` A rejected password does not use the token up. Success signs every session for that account out.

`POST /admin/account/password` needs `account.manage` and `X-CSRF-Token`. Body `{ current, next, confirm }`. Empty current is `Enter your current password.` A wrong current password is `The current password is not correct.` Success signs out the other sessions and keeps this one.

`GET /admin/users` needs `users.read`. The body is an array of public accounts. It has no password hash. A viewer and an editor receive `403`.

`PATCH /admin/users/:id` needs `users.manage`. Body `{ role }`. An unknown role is `Choose viewer, editor, trainer, trainee, or administrator.` Removing your own administrator role is `422`, message `You cannot remove your own administrator access from this session.`, field `role` `Ask another administrator to change your role.` A missing account is `404` `User not found.`

`POST /admin/users/invite` needs `users.manage`. Body `{ email, role }`. The role is required. `Choose a role.` when it is missing. The current website sends only `{ email }`, so that call is `422` until the form sends a role. An existing mailbox is `422` `An account with that mailbox already exists.` and the address is not repeated. Success is `{ delivered, message }`. `delivered` is true only when the mail provider accepted the invitation. The account exists either way.

## Enquiry routes that exist now

`POST /public/enquiries` is public. No captcha service. Body `{ name, email, topic, message, consent, company? }`.

Field messages: `Enter your name.`, `Enter your email address.`, `Enter a valid email address, like name@example.com.`, `Choose a topic.`, `Write a short message.`, `Use at least 20 characters.`, `Tick to confirm you understand this message is not delivered.`

Topics: `The 2026 bootcamp`, `Partnering or volunteering`, `Media and photos`, `Something else`.

A non-empty `company` is the honeypot. The response looks like a save, `delivered` is false, and nothing is stored. An empty `company` is a normal enquiry. Posts from one address are rate-limited with the same `429` sentence as a reset.

Success is `{ id, delivered, message }`. `message` is a status sentence, not the text the person wrote. `delivered` is true only when a notification to the settings contact email was accepted. If mail is not configured, the enquiry is still stored and `delivered` is false, with `The message is saved. No email was sent.`

`GET /admin/enquiries` needs `users.manage`. The body is an array, newest first, with `id`, `name`, `email`, `topic`, `message`, `createdAt`, `handled`, and `notified`. A viewer and an editor receive `403`. `PATCH /admin/enquiries/:id` body `{ handled }`. `DELETE /admin/enquiries/:id` returns `{ deleted: true, id }`. Those changes need `X-CSRF-Token`.

The audit row stores the action and the enquiry id. It does not store the mailbox, the token, or the message.

## Not in this milestone

These paths from the frontend contract are not implemented. They still answer `404` with code `not_found`:

- `POST /auth/session/expire` (development-only on the website; it will not be a production route)
- `POST /admin/trainees/bulk`
- `POST /admin/projects/bulk`
- `POST /admin/events/bulk`
- `POST /admin/media/bulk`
- `GET /admin/search`

There is no public registration route. The first administrator is created with `npm run admin:create` in `backend/`, from a private password. That command is not an HTTP route and it is not in the OpenAPI document. OpenAPI for the routes above is at `/api/docs`. Text messages are not part of this API.
