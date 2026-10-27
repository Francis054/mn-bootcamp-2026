# Site images

The community badge, the Maxim Nyansa Foundation logo, and the photographs that used to be written into the page templates are image slots. An administrator can replace a file, change its alt text, or put the original file back. Gallery photos, trainee portraits, work photos, lesson covers, project pictures, and event pictures stay on their own records. They are not slots.

The community logo is a hand-drawn SVG: a person dressed in white, wearing a white hat. A forest disc and a lime ring keep that white figure readable on light and on dark. The Maxim Nyansa Foundation wordmark is the parent organisation. It is only the small plate beside the name in the header and footer, on the sign-in form, in the admin sidebar, on the about page, and in the loader footer. It is never the community logo, and it is not drawn on top of the mark.

While the community slot is still the bundled file, the page draws `white-hat.svg`. The tagline sits under the larger seals (hero, about, sign-in, and the site-image preview). Uploading a community logo replaces that figure, and the tagline is not drawn. Uploading a foundation logo updates the separate plate only.

## Slots

| Key | Label | Where it shows | Original file |
| --- | --- | --- | --- |
| `community-logo` | Community logo | Header, footer, sign-in panel, admin sidebar, seals, empty states, and the favicon. The boot screen uses a separate black-hat drawing. | `/assets/logo/community-badge.webp` |
| `foundation-logo` | Maxim Nyansa Foundation logo | Header, footer, sign-in form, admin sidebar, about page, loader footer | `/assets/logo/maxim-nyansa-foundation-logo.png` |
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

The community slot also stores a tagline. The default is `STRONGER TOGETHER`. It is the caption under the original mark on the larger seals. An empty tagline hides the caption. A replacement community image ignores it. The small header mark does not show it, so the figure stays clear at favicon size.

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

**Community logo.** The preview is the live white-hat mark. Edit **Badge tagline** to change the caption (40 characters, one line). Save with no file to update the tagline and the alt text. Choose a JPEG, PNG, or WebP to replace the whole mark. A square file works best. After a replacement, the tagline is not drawn. Reset to original puts the SVG, the tagline, and the alt text back. SVG uploads are not accepted. The shipped favicon and `og-image.png` are rasters of the default SVG. They change when that file is rasterised, not when an administrator uploads a replacement. The tab icon does follow the upload.

**Maxim Nyansa Foundation logo.** This is only the parent-organisation plate. The bundled file is 200 pixels wide. A larger PNG or WebP stays sharper in that small plate; the page uses `object-fit: contain` and does not stretch it past its own size. SVG files are not accepted, because an uploaded SVG on this origin would be unsafe. Reset puts the bundled wordmark back.

The header and the favicon use the same SVG, so the figure stays sharp from 16px up. A replacement community logo is shown as uploaded, including in the browser tab icon once the page has loaded.

## Regenerate the static mark

The drawing is `frontend/public/assets/logo/white-hat.svg`. Edit that file. Do not trace a photograph over it. `frontend/scripts/brand/concept-a.jpg` is the retired badge.

From `frontend/`:

```bash
python3 scripts/build-logos.py --badge-only
```

That rasterises the SVG into `frontend/public/assets/logo/`:

- `community-badge.webp` and `.png`, and the same pixels as `community-badge-bare.webp` and `.png` — the slot default, for clients that cannot use the SVG.
- `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`, `community-badge-mark.png` — the same emblem, scaled down.
- `og-image.png` — the emblem on a forest card.

`--badge-only` needs Pillow and CairoSVG. The full `python3 scripts/build-logos.py` also redraws the older hat SVGs and needs Shapely and fontTools. Those older files are not the community logo.

## What the public site does

`GET /api/v1/public/site-images` returns the stored slots, including `tagline`. The response is cached like the other public reads (`public, max-age=60, stale-while-revalidate=480`). The page paints the bundled file first. When the list arrives, it swaps in the stored address if that address is a same-origin asset, a same-origin upload, or `https`. A bad address, a failed request, or a file that will not load falls back to the bundled file. If that also fails, the frame stays at the original width and height and the broken icon is not shown.

The first paint draws the bundled SVG. A custom community URL replaces that drawing with the uploaded image.

The loading screen stays up until the first route is ready, and at least about 2.6 seconds on a first visit in the tab (about 0.9 seconds when `sessionStorage` already has `mn-boot-seen`). It gives up after 8 seconds so a failed request cannot block the site. The screen is a drawn black-hat figure beside a fake terminal. `prefers-reduced-motion` shows the finished `ACCESS GRANTED` frame without typing. Repeat navigations inside the app use the shorter in-page loader.

## Admin

Editors can open the admin, but this page tells them it is for administrators. Each row is the label, a preview, the alt text, and an optional replacement file (JPEG, PNG, or WebP, at most the site upload limit, 5 MB unless `UPLOAD_MAX_BYTES` says otherwise). Reset to original deletes an uploaded file and puts the bundled picture back.

The upload uses the same storage as profile photos and the gallery. In production that is Cloudinary when it is configured. Without it, an upload is refused. The bundled files do not need Cloudinary.

## Add a slot

Do this in one change, with the same key in both catalogues:

1. Add the picture under `frontend/public/assets/` (or point `url` at an `https` address you already host).
2. Add the slot to `backend/src/modules/site-images/catalogue.ts` and to `frontend/src/domain/siteImages.ts`. Copy the key, label, description, url, alt, width, height, and fit. The backend unit test fails if those four strings (`key`, `url`, `alt`, `label`) disagree. Set `tagline` to `''` unless the slot is the community mark.
3. Render it with `<SiteImage slot="your-key" />`. The community mark is `<CommunityBadge />`, not a plain image, so the original slot keeps the SVG. Pass `sizes` when the file has an 800 and a 1600 webp pair. Pass `priority` when it is the first large picture on the page.
4. If migration `SiteImages1794009600000` has already been applied, add a new migration that inserts the row with `ON CONFLICT ("key") DO NOTHING`. Do not edit the shipped migration. `npm run seed` also inserts missing keys and does not overwrite a row an administrator has changed. Do not run seed on the hosted database.
5. Changing a label or a default url after a row exists needs an `UPDATE` in a new migration. Limit that update to rows still on the old default, so a custom upload is left alone.

Fit is `cover` or `contain`. Use `contain` for a logo and for the wide group photo, so the whole picture stays visible.

This migration has not shipped. Its insert is the badge catalogue above. Run `migration:run` before serving a new environment. Do not run `npm run seed` against the hosted database.
