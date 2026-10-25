# Site images

The community badge, the Maxim Nyansa Foundation logo, and the photographs that used to be written into the page templates are image slots. An administrator can replace a file, change its alt text, or put the original file back. Gallery photos, trainee portraits, work photos, lesson covers, project pictures, and event pictures stay on their own records. They are not slots.

The community logo is the approved badge (black hat and ethical hat, lime ring). The Maxim Nyansa Foundation wordmark is the parent organisation. It is only the small plate: inside the badge, beside the name in the header and footer, on the sign-in form, in the admin sidebar, on the about page, and in the loader footer. It is never the main logo.

While the community slot is still the bundled badge, the page draws the bare artwork and overlays the current foundation logo and the badge tagline. Uploading a community logo replaces that whole picture, and the overlay is not drawn. Uploading a foundation logo updates every plate, including the one inside the badge, without a redeploy.

## Slots

| Key | Label | Where it shows | Original file |
| --- | --- | --- | --- |
| `community-logo` | Community logo | Header, footer, sign-in panel, admin sidebar, seals, empty states, the loading screen, and the favicon | `/assets/logo/community-badge.webp` |
| `foundation-logo` | Maxim Nyansa Foundation logo | Plate inside the badge, header, footer, sign-in form, admin sidebar, about page, loader footer | `/assets/logo/maxim-nyansa-foundation-logo.png` |
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

The community slot also stores a tagline. The default is `STRONGER TOGETHER`. It is the banner on the original badge. An empty tagline hides the banner. A replacement community image ignores it.

These stay hard-coded on purpose:

- Gallery albums, the live homepage gallery, and the anniversary album come from the media API.
- The mock-only homepage gallery teaser is fixture data. It is not on the hosted site.
- Lesson covers, project images, and event images are fields on those records.
- Trainee profile photos and work photos already have their own upload screens.
- Net lines, the “10” mark, and the select chevron stay drawn graphics.
- The loading screen is drawn in the browser. It does not play a video file.
- `hat-black.svg`, `hat-ethical.svg`, and the older wordmark SVGs remain in `frontend/public/assets/logo/` from the previous mark. No page uses them as the community logo.

The class-row hover picture is `aria-hidden` because the row already has a title. The slot still stores a description for the admin list. The sign-in panel sits inside an `aria-hidden` aside, so that page sends an empty alt even though the slot keeps a description.

## Change a logo

Sign in as an administrator and open **Site images** under Pages.

**Community logo.** The preview is the live badge. Edit **Badge tagline** to change the banner (40 characters, one line). Save with no file to update the tagline and the alt text. Choose a JPEG, PNG, or WebP to replace the whole badge. A square file works best. After a replacement, the foundation plate and the tagline are not drawn on top. Reset to original puts the badge, the tagline, and the alt text back, and the plate is drawn again. SVG files are not accepted.

**Maxim Nyansa Foundation logo.** This is only the parent-organisation plate. The bundled file is 200 pixels wide. A larger PNG or WebP stays sharper in that small plate; the page uses `object-fit: contain` and does not stretch it past its own size. SVG files are not accepted, because an uploaded SVG on this origin would be unsafe. Reset puts the bundled wordmark back.

The header and the favicon use a crop of the upper emblem when the community slot is still the original badge, because the full badge is too small to read there. A replacement community logo is shown as uploaded, including in the browser tab icon once the page has loaded. The apple-touch icon and `og-image.png` shipped with the site are generated from the default badge. They change on the next build, not when an administrator uploads a file. The tab icon does follow the upload.

## Regenerate the static badge

The bare artwork is `frontend/scripts/brand/concept-a.jpg`. Poppins Black, used for the flattened banner and the on-page tagline, is `frontend/scripts/brand/Poppins-Black.ttf` (OFL, subset to `frontend/public/assets/fonts/Poppins-Black-latin.woff2`).

From `frontend/`:

```bash
python3 scripts/build-logos.py --badge-only
```

That writes, into `frontend/public/assets/logo/`:

- `community-badge-bare.webp` and `.png` — circular-masked concept-a, transparent outside the lime ring. The page paints this and overlays the live plate.
- `community-badge.webp` and `.png` — the same artwork plus the bundled foundation plate and `STRONGER TOGETHER`. This is the slot default and the no-JavaScript fallback.
- `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`, `community-badge-mark.png` — a crop of the hats and the lime ring.
- `og-image.png` — the full badge on a forest card.

`--badge-only` needs Pillow. The full `python3 scripts/build-logos.py` also redraws the older hat SVGs and needs CairoSVG, Shapely, and fontTools.

## What the public site does

`GET /api/v1/public/site-images` returns the stored slots, including `tagline`. The response is cached like the other public reads (`public, max-age=60, stale-while-revalidate=480`). The page paints the bundled file first. When the list arrives, it swaps in the stored address if that address is a same-origin asset, a same-origin upload, or `https`. A bad address, a failed request, or a file that will not load falls back to the bundled file. If that also fails, the frame stays at the original width and height and the broken icon is not shown.

The first paint of the badge uses the bundled foundation logo inside the overlay, so a slow response does not flash a different plate. A custom community URL replaces the overlay with that image.

The loading screen stays up until the first route is ready, and at least about 2.6 seconds on a first visit in the tab (about 0.9 seconds when `sessionStorage` already has `mn-boot-seen`). It gives up after 8 seconds so a failed request cannot block the site. `prefers-reduced-motion` shows the badge and the bar without the canvas. Repeat navigations inside the app use the shorter in-page loader.

## Admin

Editors can open the admin, but this page tells them it is for administrators. Each row is the label, a preview, the alt text, and an optional replacement file (JPEG, PNG, or WebP, at most the site upload limit, 5 MB unless `UPLOAD_MAX_BYTES` says otherwise). Reset to original deletes an uploaded file and puts the bundled picture back.

The upload uses the same storage as profile photos and the gallery. In production that is Cloudinary when it is configured. Without it, an upload is refused. The bundled files do not need Cloudinary.

## Add a slot

Do this in one change, with the same key in both catalogues:

1. Add the picture under `frontend/public/assets/` (or point `url` at an `https` address you already host).
2. Add the slot to `backend/src/modules/site-images/catalogue.ts` and to `frontend/src/domain/siteImages.ts`. Copy the key, label, description, url, alt, width, height, and fit. The backend unit test fails if those four strings (`key`, `url`, `alt`, `label`) disagree. Set `tagline` to `''` unless the slot is the community badge.
3. Render it with `<SiteImage slot="your-key" />`. The community badge is `<CommunityBadge />`, not a plain image, so the foundation plate stays live. Pass `sizes` when the file has an 800 and a 1600 webp pair. Pass `priority` when it is the first large picture on the page.
4. If migration `SiteImages1793923200000` has already been applied, add a new migration that inserts the row with `ON CONFLICT ("key") DO NOTHING`. Do not edit the shipped migration. `npm run seed` also inserts missing keys and does not overwrite a row an administrator has changed. Do not run seed on the hosted database.
5. Changing a label or a default url after a row exists needs an `UPDATE` in a new migration. Limit that update to rows still on the old default, so a custom upload is left alone.

Fit is `cover` or `contain`. Use `contain` for a logo and for the wide group photo, so the whole picture stays visible.

This migration has not shipped. Its insert is the badge catalogue above. Run `migration:run` before serving a new environment. Do not run `npm run seed` against the hosted database.
