# Maxim Nyansa Foundation · 2026 Cyber Security Bootcamp

**`web/`** is the application frontend: Vite, React and TypeScript. It keeps the prototype’s CSS, logo and motion, and it calls the bootcamp API at the same origin under `/api/v1`. See `docs/API.md`.

The static HTML prototype is not on this branch. It remains on the `prototype` branch.

## Run the application

The site and the API are separate trees. This branch is the website. Run the API from the backend branch on port 3000, then:

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api/v1` to `http://localhost:3000` (override the target with `VITE_API_PROXY` if needed). Requests stay on relative URLs. The session is the HttpOnly cookie `mn_session`. Unsafe requests send `X-CSRF-Token` from the `mn_csrf` cookie. Nothing is stored in `localStorage` or `sessionStorage` except the sidebar collapse preference `mn-sb`.

Copy `web/.env.example` to `web/.env.local` only to turn the offline fixture store on with `VITE_USE_MOCK_API=true`. Leave that blank for the live API. Do not put secrets in env files.

Sign in at `/admin/login` with an account the API already has. The password is not kept in the browser. A `401` sends you back to the login page. Public pages render only what the API returns. An unpublished homepage says so, and Foundation counters stay hidden until they are published. The hackathon stays “to be confirmed” when the API says the date is unconfirmed.

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

`npm test` sets `VITE_USE_MOCK_API=true` so the screen tests keep using fixture copy. `npm run test:e2e` does the same for Playwright.

## Structure

```
web/                 Vite, React and TypeScript
web/src/styles/      tokens, components, pages, admin and app CSS
web/public/assets/   fonts, photos and the logo
docs/                API, architecture, audit and research notes
```
