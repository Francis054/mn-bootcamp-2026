# Maxim Nyansa Foundation · 2026 Cybersecurity Bootcamp

This branch holds the two applications side by side.

- `frontend/` is the website: Vite, React and TypeScript. It calls the API at the same origin under `/api/v1`.
- `backend/` is the HTTP API: Express, TypeORM and Postgres.
- `docs/` holds the client notes, the API notes, the website architecture, the phase 1 audit, and the research notes.

The static HTML prototype stays on the `prototype` branch.

Deploy notes are in `docs/deployment.md`, `docs/security.md`, `docs/database.md`, and `docs/api-reference.md`. The click-by-click list is `DEPLOY-CHECKLIST.txt`.

## Run locally from scratch

This is for a first run on Windows or Mac, using Visual Studio Code. It uses a PostgreSQL database on your own computer. It does not use the hosted Supabase database.

1. Install Node.js 22 or newer from https://nodejs.org. In VS Code, open Terminal → New Terminal and run `node -v`. You want a version that starts with `v22`.
2. Install PostgreSQL from https://www.postgresql.org/download/ (the installer from EDB works on both Windows and Mac). Remember the password you choose for the `postgres` user. Leave the server on `localhost` port `5432`.
3. Create an empty database named `mn_bootcamp_dev`. In the SQL shell that came with PostgreSQL (`psql` or SQL Shell), sign in as `postgres` and run:

```sql
CREATE DATABASE mn_bootcamp_dev;
```

4. In VS Code, open this repository on the `dev` branch (File → Open Folder).
5. In the terminal:

```bash
cd backend
npm install
```

6. Copy the blank example env file. On Mac, or in VS Code’s bash terminal, run `cp .env.example .env`. On Windows Command Prompt, run `copy .env.example .env`. Do not commit `.env`.
7. Open `backend/.env` and set only these values. Replace the database password with the local one. If that password contains `@`, `#`, `?`, or a space, percent-encode it in the URL. `SESSION_SECRET` can be any text of at least 32 characters; it is only for this computer.

```text
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://postgres:your-local-password@127.0.0.1:5432/mn_bootcamp_dev
DATABASE_SSL=false
FRONTEND_URL=http://127.0.0.1:5173
SESSION_SECRET=local-only-change-this-to-32-characters-min
```

Leave Cloudinary and Resend blank. Local development keeps photos and mail in memory.

8. Still in `backend/`:

```bash
npm run migration:run
npm run seed
npm run admin:create -- you@example.com
```

`npm run seed` loads labelled sample lessons for local development, then imports the Cybersecurity Bootcamp timetable from `data/seed/bootcamp-timetable-and-outline.xlsx`. Do not run it against the hosted database. On a database that should not receive sample lessons, run `npm run migration:run` and then `npm run timetable:import` instead. `npm run admin:create` asks for a password twice and never prints it. The password needs at least 12 characters, with a letter and a number. The command finishes with `Administrator account is ready.`

9. Start the API and leave that terminal open:

```bash
npm run dev
```

10. Open a second terminal in VS Code:

```bash
cd frontend
npm install
npm run dev
```

11. Open http://localhost:5173. The API is proxied at `/api/v1`. Sign in at http://localhost:5173/admin/login with the mailbox and password from step 8.

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
docs/                API reference, deployment, security, database, client notes
```
