# Maxim Nyansa Foundation · 2026 Cyber Security Bootcamp: interactive design prototype

This is a high-fidelity, clickable prototype of the community site and its admin/CMS. It is plain HTML, CSS and vanilla JS. There is no build step, no backend and no tracking, and every font and image is bundled locally.

**This is a design prototype, not a live site.** Nothing you type is sent or stored.

## How to open it

1. Unzip the folder.
2. Double-click **`index-of-screens.html`**. This is the reviewer hub that links every screen. You can also start at `index.html`, which is the home page.
3. Optional: serve the folder locally instead, which gives the closest match to a real host.
   ```
   cd mn-bootcamp-2026 && python3 -m http.server 8000
   ```
   Then open http://localhost:8000/index-of-screens.html.

**To review responsiveness,** resize the window or use your browser's device mode. Tested widths are 390, 768 and 1440 px.

**To review motion fallbacks,** turn on "Reduce motion" in your OS. All motion respects `prefers-reduced-motion`.

**To test keyboard use,** use Tab, Shift+Tab, Enter, Space, Escape and the arrow keys (for tabs, the lightbox and the journey rail).

## Screens

### Public site (15)

| # | File | Screen |
|---|------|--------|
| P01 | index.html | Home: hero, cohort progress, three-month rail, latest classes, projects, gallery teaser, 10 years |
| P02 | bootcamp.html | Bootcamp overview: modules, format, who it is for |
| P03 | journey.html | Three-month journey: scroll-driven timeline |
| P04 | classes.html | Class archive: filters, sort, empty state |
| P05 | lesson.html?id=3 | Lesson detail |
| P06 | projects.html | Projects & labs |
| P07 | project.html?id=1 | Project case study |
| P08 | trainees.html | Trainee directory: search and filters (sample profiles) |
| P09 | trainee.html?id=1 | Trainee profile (sample) |
| P10 | events.html | Events and milestones |
| P11 | event.html?id=hackathon | Event detail (hackathon: details to be confirmed) |
| P12 | gallery.html | Gallery: masonry, filters, keyboard and swipe lightbox (`#open=N`) |
| P13 | anniversary.html | 10 Years of Impact (verified facts only) |
| P14 | about.html | About the Foundation: mission, vision, values, name |
| P15 | contact.html | Contact: verified details plus a simulated enquiry form |

### Admin / CMS (16)

These pages are under `admin/`: login, index (overview), classes, class-edit, trainees, trainee-edit, projects, project-edit, events, event-edit, media, content (homepage), timeline (anniversary), about, settings, and states (the UI-states catalogue).

The admin pages include:
- a collapsible sidebar, and a mobile drawer below 960 px
- a topbar and breadcrumbs
- filters, and tables that turn into cards on mobile
- bulk select
- a confirm-delete modal (focus-trapped, Escape to close)
- toasts, inline validation with an error summary, and a sticky save bar
- a "Prototype — sample data" label throughout

### Reference (3)

- `design-system.html`: colour, type scale, spacing and grid, radii and shadows, buttons in every state, inputs, cards, tabs, chips, badges, icons, feedback patterns and motion tokens
- `motion-spec.html`: every animation, with its trigger, duration, easing and reduced-motion fallback
- `index-of-screens.html`: the reviewer hub

## What is real and what is simulated

### Real (verified)

Every verified fact comes from `research.md` (the official site maximnyansa.com, the official LinkedIn posts and GNBCC). Pages mark these with a **✓ Verified** label. They are:
- the Foundation's name, mission, vision, values and the meaning of its name
- the founding year (2016) and the 10-year anniversary facts
- the address (Coral Avenue – Tantra Hills, Accra), email and website
- the 2026 application link (maximnyansaapplications.com) and the social accounts
- the official logo, used unaltered
- the brand lime #88CC00 and its neutrals
- the photos supplied by the team

### Simulated

- **Trainee names, profiles, classes, lessons, projects, schedules and sample stats** are illustrative. They carry **Sample** or **TBC** labels.
- **The entire admin is simulated.** Sign-in, saves, deletes, uploads and reordering only change the page in memory. Nothing is stored, and a reload resets everything.
- **The contact form sends nothing.**

### Placeholders

- **Sample data:** cohort names and profiles, the class list and lesson content, project write-ups and progress figures.
- **Project covers:** these use abstract generated art rather than photos.
- **Photos:** none of the people in the photos are named or identified anywhere in the prototype. The Safari Park photo is excluded.

## Open questions for the team

1. **Poster:** the bootcamp poster was not supplied. The visual direction is based on the photos and maximnyansa.com, so please send the poster if it should drive the look.
2. **Logo resolution:** the only official logo available is a 200×41 PNG. It is never shown larger than its native size. A vector or high-resolution version is needed for production and print.
3. **Photo consent:** consent is needed from everyone pictured before publishing. The mapping of photos to events is also an assumption and needs confirming.
4. **Hackathon:** dates, partners, format and results are shown as "details to be confirmed".
5. **Curriculum:** the length, order and weekly schedule of the modules need confirming.
6. **Foundation stats:** confirm that impact figures can be published, and which ones.
7. **Colour:** forest green, gold and terracotta are proposed extensions, not official brand colours.
8. **Figma:** importing the screens into Figma is optional, because this prototype is the design source. Screenshots are in `_shots/` (not included in the zip).
9. **Production build:** a real build needs a CMS or backend, authentication, hosting and a privacy and consent policy for trainee profiles.

## Structure

```
css/   tokens.css · components.css · pages.css · admin.css
js/    data.js (sample data) · components.js (header/footer/sidebar, toast, confirm, lightbox, tabs) · motion.js · admin.js
assets/fonts (Space Grotesk, Noto Sans, JetBrains Mono) · assets/img (responsive photos) · assets/logo
```
