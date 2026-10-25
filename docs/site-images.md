# Site images

The community hat logo, the parent-organisation plate, and the photographs that used to be written into the page templates are image slots. An administrator can replace the file, change the alt text, or put the original file back. Gallery photos, trainee portraits, work photos, lesson covers, project pictures, and event pictures stay on their own records. They are not slots.

The black hat facing the ethical hat is the community logo. The Maxim Nyansa Foundation PNG is the parent organisation. It is only the plate next to the community mark.

## Slots

| Key | Label | Where it shows | Original file |
| --- | --- | --- | --- |
| `community-logo` | Community logo (black hat vs ethical hat) | Homepage and bootcamp seals, empty states, the not-found page, and the about page | `/assets/logo/logo-mark.svg` |
| `community-logo-icon` | Community logo, compact icon (black hat vs ethical hat) | Header, footer, sign-in brand, and admin sidebar chip | `/assets/logo/logo-icon.svg` |
| `community-wordmark` | Community wordmark on dark (black hat vs ethical hat) | Sign-in panel, over the photograph | `/assets/logo/logo-wordmark-on-dark.svg` |
| `foundation-logo` | Parent organisation logo (Maxim Nyansa Foundation) | Header and footer plate, sign-in form, admin sidebar, about page | `/assets/logo/maxim-nyansa-foundation-logo.png` |
| `home-hero-main` | Homepage hero, main photo | Homepage hero, large frame | `/assets/img/participant-portrait-1600.webp` |
| `home-hero-side` | Homepage hero, side photo | Homepage hero, upper small frame | `/assets/img/hack-coding-team-1600.webp` |
| `home-hero-accent` | Homepage hero, accent photo | Homepage hero, lower small frame | `/assets/img/vr-headset-moment-1600.webp` |
| `home-class-peek-1` | Homepage class row, first hover photo | Pointer preview on the first featured class. Later rows repeat these four. | `/assets/img/electronics-lab-1600.webp` |
| `home-class-peek-2` | Homepage class row, second hover photo | Second featured class row | `/assets/img/hack-coding-team-1600.webp` |
| `home-class-peek-3` | Homepage class row, third hover photo | Third featured class row | `/assets/img/vr-demo-group-1600.webp` |
| `home-class-peek-4` | Homepage class row, fourth hover photo | Fourth featured class row | `/assets/img/presenters-yellow-room-1600.webp` |
| `bootcamp-banner` | Bootcamp overview banner | Bootcamp overview page | `/assets/img/electronics-lab-1600.webp` |
| `about-banner` | About page banner | About page | `/assets/img/anniversary-group-outdoor-1600.webp` |
| `sign-in-panel` | Sign-in panel photo | Sign-in page panel | `/assets/img/electronics-lab-1600.webp` |

These stay hard-coded on purpose:

- Gallery albums, the live homepage gallery, and the anniversary album come from the media API.
- The mock-only homepage gallery teaser is fixture data. It is not on the hosted site.
- Lesson covers, project images, and event images are fields on those records.
- Trainee profile photos and work photos already have their own upload screens.
- Net lines, the “10” mark, and the select chevron stay drawn graphics.
- The boot loader keeps `hat-black.svg` and `hat-ethical.svg` as bundled files. The same two files are in the static HTML that shows before the app loads and in the React loader, so the first paint does not wait on a slot.
- The favicon (`logo-icon-app.svg`), the apple-touch icon, and the social preview image stay in `index.html`.
- `logo-wordmark.svg` is the light wordmark file. No page places it. The sign-in panel uses the dark wordmark slot.

The class-row hover picture is `aria-hidden` because the row already has a title. The slot still stores a description for the admin list. The sign-in panel sits inside an `aria-hidden` aside, so that page sends an empty alt even though the slot keeps a description.

## What the public site does

`GET /api/v1/public/site-images` returns the stored slots. The response is cached like the other public reads (`public, max-age=60, stale-while-revalidate=480`). The page paints the bundled file first. When the list arrives, it swaps in the stored address if that address is a same-origin asset, a same-origin upload, or `https`. A bad address, a failed request, or a file that will not load falls back to the bundled file. If that also fails, the frame stays at the original width and height and the broken icon is not shown.

## Admin

Sign in as an administrator and open **Site images** under Pages. Each row is the label, a preview, the alt text, and an optional replacement file (JPEG, PNG, or WebP, at most the site upload limit, 5 MB unless `UPLOAD_MAX_BYTES` says otherwise). Save with no file updates only the alt text. Reset to original deletes an uploaded file and puts the bundled picture back. Editors can open the admin, but this page tells them it is for administrators.

The upload uses the same storage as profile photos and the gallery. In production that is Cloudinary when it is configured. Without it, an upload is refused. The bundled files do not need Cloudinary.

## Add a slot

Do this in one change, with the same key in both catalogues:

1. Add the picture under `frontend/public/assets/` (or point `url` at an `https` address you already host).
2. Add the slot to `backend/src/modules/site-images/catalogue.ts` and to `frontend/src/domain/siteImages.ts`. Copy the key, label, description, url, alt, width, height, and fit. The backend unit test fails if those four strings (`key`, `url`, `alt`, `label`) disagree.
3. Render it with `<SiteImage slot="your-key" />`. Pass `sizes` when the file has an 800 and a 1600 webp pair. Pass `priority` when it is the first large picture on the page.
4. If migration `SiteImages1793923200000` has already been applied, add a new migration that inserts the row with `ON CONFLICT ("key") DO NOTHING`. Do not edit the shipped migration. `npm run seed` also inserts missing keys and does not overwrite a row an administrator has changed. Do not run seed on the hosted database.
5. Changing a label or a default url after a row exists needs an `UPDATE` in a new migration. Limit that update to rows still on the old default, so a custom upload is left alone.

Fit is `cover` or `contain`. Use `contain` for a logo and for the wide group photo, so the whole picture stays visible.
