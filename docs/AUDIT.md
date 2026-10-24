# Phase 1 audit

Inspected before any application code was added. The static prototype has since been removed from this branch. It remains on the `prototype` branch.

## What existed

- Plain HTML, CSS and vanilla JavaScript. No `package.json`, no framework, no test runner, no backend, no API client.
- 15 public pages at the root, 16 admin pages in `admin/`, plus `design-system.html`, `motion-spec.html` and `index-of-screens.html`.
- Design system in `css/tokens.css`, `css/components.css`, `css/pages.css`, `css/admin.css`.
- Behaviour in `js/components.js`, `js/motion.js`, `js/data.js`, `js/admin.js`.
- Assets: official logo PNG, local Space Grotesk / Noto Sans / JetBrains Mono, 42 event photos as 800/1600 WebP pairs.
- Content is a mixture of verified Foundation facts and clearly labelled samples. The admin sign-in accepts any plausible email and never checks an account.

## Gaps

- No real routes: pages are separate files and query-string ids.
- Admin saves, deletes, uploads and sign-in only mutate the current document.
- No authentication boundary, no roles, no session expiry, no password reset.
- No typed models, no shared error shape, no environment-based API base URL.
- Forms validate in the browser and then pretend to save.

## What was reused

- CSS tokens, components, page and admin styles, unchanged.
- Logo treatment: community wordmark plus the official logo on a white plate, never redrawn or upscaled past its 200×41 asset.
- Icon paths, motion tokens, reduced-motion rules, and the hero network drawing.
- Fixture copy already marked sample or to be confirmed, including the unconfirmed hackathon link.

## Stack decision

A Vite + React + TypeScript single-page app now lives in `frontend/`. Next.js was not used: there is no server, and a Next app would imply API routes that do not exist. The static prototype HTML is on the `prototype` branch.

## Checklist

| Phase | Result |
| --- | --- |
| 1 Audit | This note |
| 2 Public pages | Routed React pages for home, bootcamp, journey, classes, lesson, trainees, profiles, projects, events, gallery, about, anniversary, contact |
| 3 Admin | Overview, lists, editors, media, timeline, about, content, users, settings, account, UI states |
| 4 Auth | Login, reset request, reset completion, session expired, forbidden, logout. Development adapter only |
| 5 API boundary | `api()` client, dev transport, live transport stub, `docs/API.md` marked pending |
| 6 QA | Typecheck, lint, unit tests, Playwright and axe. See the pull request for results |
| 7 Docs | README, this audit, architecture, API contract |
