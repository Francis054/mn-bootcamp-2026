# Deployment

Nothing in this repository is deployed by these notes. No accounts are created from here, and no paid resources are required. The click-by-click list for a first launch is `DEPLOY-CHECKLIST.txt` at the repository root. This page is the reason those steps look the way they do.

Checked against vendor docs on 24 October 2026. Prices and limits change. The checklist names the page each limit came from.

## One public origin

The browser must see the website and `/api/v1` on the same host. The session cookie is host-only and `SameSite=Lax`. A second hostname would not receive it. `onrender.com` is a public suffix, so two `*.onrender.com` services do not share cookies either.

Recommended layout, on free tiers:

- A Render **Static Site** builds `frontend/` and serves the pages.
- A Render **Web Service** on the Free instance runs `backend/`.
- The static site has a **rewrite** (not a redirect) from `/api/v1/*` to `https://<the-api-service>.onrender.com/api/v1/*`.
- A second rewrite sends every other missing path to `/index.html`, so a refresh of `/admin/login` still loads the React app.

Render’s redirect and rewrite docs (https://render.com/docs/redirects-rewrites) say a redirect answers `301` and the browser changes URL. A rewrite does not. The site serves the destination content at the original path, and “the browser can’t detect that content was served from a different path or URL.” The destination may be a full public URL. Put the `/api/v1/*` rule above the `/*` rule. Render uses the first match, and it serves a real file instead of a rule when a file exists at that path.

This was read from those docs. It was not proven by a live Render request, because this work does not deploy. The checklist includes a check: `curl -sI` on `https://<site>/api/v1/health` must not be a `301` or `302`, and after sign-in the cookies must belong to the site host, with no `Domain` attribute. If that check fails, stop. Do not point the website at the API host. The code will not send `SameSite=None` cookies, and CORS allows only `FRONTEND_URL`.

The API service has to be public. A rewrite to a private Render service is reported to return 502, because a static site is files on a CDN and cannot join the private network.

If the rewrite check fails, the next free option that keeps one origin is a single Web Service that serves both the built `frontend/dist` files and the API. This repository does not do that today. It would be a code change: the Express app would serve `index.html` for non-API routes and the API would stay on `/api/v1`. Two origins, with the browser calling the API host directly, is the pattern in Render’s hybrid tutorial and it does not fit these cookies.

## Services

Both services deploy the `main` branch of `Francis054/mn-bootcamp-2026`.

API web service:

- Root directory `backend`
- Environment `Node`
- `NODE_VERSION=22` (the package asks for Node 22 or newer)
- Build: `npm ci --include=dev && npm run build`
- Start: `npm start` (`node dist/main.js`)
- Instance type Free
- Health check path `/api/v1/health` (HTTP, on the API service itself, not through the static site)

`--include=dev` is there because `tsc` and `tsx` are devDependencies. Render’s default `NODE_ENV=production` applies at runtime only (https://render.com/docs/environment-variables). If you also set `NODE_ENV=production` in the Environment tab, npm would otherwise skip those tools during the build. The running process still needs `NODE_ENV=production` so cookies are `Secure` and `SESSION_SECRET` is required.

Migrations: Render’s deploy docs say the pre-deploy command is available for paid web services, private services, and background workers (https://render.com/docs/deploys). The Free instance may not show that box. If it does, set it to `npm run migration:run`. If it does not, run that command once from your computer or from the service Shell, with the production `DATABASE_URL` in that shell only. Do not run `npm run seed`.

`PublicRls1794096000000` turns on row level security for every table in `public` and revokes the Supabase Data API roles. Production deploys from `main`, and a free Render service may not run migrations during that deploy. Until `schema_migrations` contains `PublicRls1794096000000`, paste the SQL from `docs/security.md` into the Supabase SQL editor. Running `npm run migration:run` afterwards is safe: the statements can run more than once, and that command records the migration row. Then rerun the Security Advisor. Do not revert this migration on the hosted database.

Static site:

- Root directory `frontend`
- Build: `npm ci && npm run build`
- Publish directory: `dist`
- Do not set `VITE_USE_MOCK_API`. A production build with that flag unset calls the live API. `VITE_` values are baked in at build time and are public. Do not put secrets there.
- Rewrites, in this order:
  1. Source `/api/v1/*`, destination `https://<api-service>.onrender.com/api/v1/*`, action Rewrite
  2. Source `/*`, destination `/index.html`, action Rewrite

The free `*.onrender.com` URL is enough to launch. Add a custom domain later, on the static site. Render shows a CNAME for `www` and an A or ALIAS record for the apex. HTTPS is provisioned after DNS verifies. Then set the API’s `FRONTEND_URL` to that one `https` origin. Cookies do not cover both `www` and the apex, so redirect one to the other.

## Environment

Every API variable is listed in `DEPLOY-CHECKLIST.txt` with an example shape and where it is pasted. The blank template is `backend/.env.example`. The running process reads them in `backend/src/config/env.ts`. `ADMIN_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` are read only by `npm run admin:create`, not by the server.

`PORT` is injected by Render. Do not set it to 3000 on the service.

Create the first administrator only after migrations, in private, once. Do not commit the password. Do not run the seed.

## Free-tier limits

These are the published limits as checked on 24 October 2026. They are not a promise that the vendor still offers them next month.

- Render free web services spin down after 15 minutes without inbound traffic and take about a minute to wake. A workspace gets 750 free instance hours a month. Hours count only while a service is running. A spun-down service does not use them. One web service left running all month uses 720 hours in a 30-day month and 744 in a 31-day month, so a single always-on free service fits, with a few hours left. A second free web service that also stays up all month does not. Static sites do not use these hours. Rollbacks on the free web service go back only to the two most recent previous deploys. Source: https://render.com/docs/free, checked 24 October 2026.
- Supabase free projects pause after a week of low database activity. The pricing page says “paused after 1 week of inactivity,” a 500 MB database, and 2 active projects. The pausing guide says a warning email comes about a week before, and a paused project can be restored from the dashboard. Sources: https://supabase.com/pricing and https://supabase.com/docs/guides/platform/free-project-pausing
- Cloudinary’s free plan includes 25 credits a month. One credit is 1,000 transformations, or 1 GB of storage, or 1 GB of image bandwidth. On the free plan, video bandwidth is also 1 GB per credit. Transformations and bandwidth use a rolling 30 days, not a calendar month. Sources: https://cloudinary.com/pricing and https://cloudinary.com/documentation/billing_and_plans
- Resend’s free plan is 100 emails per UTC day and 3,000 per month. Received mail counts too, and each To, Cc, or Bcc recipient counts as one email. Sources: https://resend.com/pricing and https://resend.com/docs/knowledge-base/account-quotas-and-limits

Supabase free backup retention was not confirmed for this note. Look at the project’s Backups page before you rely on one.

## Staying awake

`backend/scripts/keep-alive.mjs` is plain Node 22 with no dependencies. It sends one GET to `KEEPALIVE_URL` (the full public health URL, such as `https://YOUR-SITE.onrender.com/api/v1/health`), retries twice, and gives each try 60 seconds so a cold start can finish. It logs the status and the latency. The log line is the origin and the path. It does not print a query string, a password, or a token. If `KEEPALIVE_URL` is unset, it says so and exits 0, so the workflow can be merged before the site exists.

`.github/workflows/keep-alive.yml` runs that script on the cron `*/14 * * * *` (every 14 minutes, inside Render’s 15-minute idle window) and when someone starts it by hand. The URL comes from the GitHub Actions variable `KEEPALIVE_URL`, not from a secret, because the address is public. The workflow’s only permission is `contents: read`.

GitHub runs a scheduled workflow only from the repository’s default branch, and only if the workflow file is on that branch (https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule, checked 24 October 2026). The workflow and the script are on `main`, and `main` is the default branch, so the schedule runs once `KEEPALIVE_URL` is set. Do not change the default branch.

The same GitHub page says a schedule can start late when Actions is busy, especially at the start of each hour, and a queued run can be dropped. A cold start is still possible now and then. A free pinger outside GitHub, every 5 minutes, is a more reliable backup. cron-job.org and UptimeRobot are two that can GET the same health URL. On a public repository, GitHub also turns a schedule off after 60 days with no repository activity.

`KEEPALIVE_URL` is not a Render environment variable. The API does not read it.

## After it is up

Smoke tests and rollback steps are in the checklist. Rolling back a Render deploy does not undo a migration that already ran.

Editing after launch is also in the checklist. Classes, trainees, projects, and events are published from their Workflow field. Homepage, about, timeline, and settings screens save a draft only. Photos need verified consent and a separate publish call. The public counters stay hidden until settings are published with `foundationStats`.
