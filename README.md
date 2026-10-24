# Maxim Nyansa Foundation · 2026 Cyber Security Bootcamp

This branch holds the two applications side by side.

- `frontend/` is the website: Vite, React and TypeScript. It calls the API at the same origin under `/api/v1`.
- `backend/` is the HTTP API: Express, TypeORM and Postgres.
- `docs/` holds the client notes, the API notes, the website architecture, the phase 1 audit, and the research notes.

The static HTML prototype stays on the `prototype` branch.

## Run the website

Start the API on port 3000 first, then:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api/v1` to `http://localhost:3000` (override the target with `VITE_API_PROXY`). Requests stay on relative URLs. The session is the HttpOnly cookie `mn_session`. Unsafe requests send `X-CSRF-Token` from the `mn_csrf` cookie. Nothing is stored in `localStorage` or `sessionStorage` except the sidebar collapse preference `mn-sb`.

Copy `frontend/.env.example` to `frontend/.env.local` only to turn the offline fixture store on with `VITE_USE_MOCK_API=true`. Leave that blank for the live API. Do not put secrets in env files.

Sign in at `/admin/login` with an account the API already has. The password is not kept in the browser. A `401` sends you back to the login page. Public pages render only what the API returns. An unpublished homepage says so, and Foundation counters stay hidden until they are published. The hackathon stays “to be confirmed” when the API says the date is unconfirmed.

```bash
cd frontend
npm run lint
npm run typecheck
npm test
npm run build
```

`npm test` sets `VITE_USE_MOCK_API=true` so the screen tests keep using fixture copy. `npm run test:e2e` does the same for Playwright. See `docs/client.md`.

## Run the API

```bash
cd backend
npm install
cp .env.example .env
```

Set `DATABASE_URL` in `.env`. Do not commit that file. `.env.example` stays blank. The commands, variables, and checks are in `backend/README.md`. The route notes are in `docs/API.md`.

```bash
cd backend
npm run lint
npm run typecheck
npm test
npm run build
```

`npm test` uses `TEST_DATABASE_URL` when it points at a Postgres database whose name ends with `_test`. Otherwise it starts PostgreSQL with Testcontainers when Docker is available.

## Structure

```
frontend/            Vite, React and TypeScript
frontend/src/styles/ tokens, components, pages, admin and app CSS
frontend/public/assets/ fonts, photos and the logo
backend/             HTTP API
docs/                client, API, architecture, audit and research notes
```
