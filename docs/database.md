# Database

The API uses PostgreSQL through TypeORM. `synchronize` is off. Schema changes are the migration files in `backend/src/database/migrations/`, applied in this order by `npm run migration:run`:

1. Baseline
2. Auth (users, sessions, login throttle, audit)
3. Curriculum (tracks, modules, phases, classes)
4. Trainees
5. Projects
6. Events
7. Gallery
8. Content (homepage, about, milestones, settings)
9. Accounts (password reset, invitations, enquiries)
10. Roles and optional links
11. Catalogue links
12. Work photos (trainee photos an administrator uploads)
13. Trainee profile photo (`photo_url` and `photo_storage_key`)
14. Timetable (`programmes`, `curriculum_blocks`, `curriculum_weeks`, `week_deliverables`, `trainers`, `week_trainers`, `class_sessions`, `session_trainers`)

The migrations table is `schema_migrations`. Passwords are stored as Argon2id hashes. Session cookies are stored as hashes. The cookie value itself is not stored.

## Local database

Use a database on your own computer. The root README section “Run locally from scratch” has the Windows and Mac steps. `DATABASE_SSL=false` is correct there. `npm run seed` is for that local database only. It inserts labelled sample lessons. Do not run it on the hosted database.

## Hosted database (Supabase)

The project is `mn-bootcamp-2026`, ref `psxzqwztgjkqnnncxddc`, region `eu-central-1`. The database password stays in the Supabase dashboard and in the Render environment. It is not written in this repository.

Use the **session pooler on port 5432**, not the transaction pooler on port 6543, and not the direct host. Supabase’s connection guide (checked 24 October 2026) says the direct host `db.[ref].supabase.co` is IPv6 on the free plan. Render’s free web service reaches the database over IPv4. The session pooler is the IPv4 path. TypeORM keeps a session and uses prepared statements, which the transaction pooler does not support. The username for the shared pooler is `postgres.psxzqwztgjkqnnncxddc`, not `postgres`.

Where to copy the string:

1. Open the Supabase project.
2. Click **Connect** at the top.
3. Choose **Session pooler** (port 5432).
4. Copy the host from that dialog. Do not invent the host from the region name. Supabase says a region can have more than one pooler, so the host is not something you can guess.
5. Replace `[YOUR-PASSWORD]` with the database password. Percent-encode `@`, `#`, `?`, a space, and other reserved characters.

Shape, with the password left out:

```text
postgresql://postgres.psxzqwztgjkqnnncxddc:YOUR_PASSWORD@HOST_FROM_THE_CONNECT_DIALOG:5432/postgres?sslmode=require
```

Paste that only into the Render **Environment** tab as `DATABASE_URL`. Do not paste it into git, a pull request, chat, or the static site.

## SSL

In production, `DATABASE_SSL` defaults to `true` when the variable is left empty. Set it to `true` anyway so the choice is visible.

The code turns that flag into Node’s TLS option `{ rejectUnauthorized: true }` in `backend/src/database/data-source.ts`. Certificate checks stay on. Do not set `DATABASE_SSL=false` to get past a certificate error. Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0`.

Supabase’s server certificate chains to Supabase’s own CA. That CA is not in Node’s built-in list. Startup then exits with `SELF_SIGNED_CERT_IN_CHAIN` until the process has the CA.

Download it from the Supabase dashboard:

1. Open the project.
2. Go to **Project Settings**, then **Database**.
3. Under **SSL Configuration**, click **Download certificate**.
4. Open the downloaded file in a text editor. It starts with `-----BEGIN CERTIFICATE-----` and ends with `-----END CERTIFICATE-----`.

On Render, add `DATABASE_SSL_CA` and paste the whole file, including those two lines. Render keeps line breaks. If the box stores the file as one line, put the two characters `\n` where each line break was. The app turns those into real line breaks. A single pair of quotes around the whole value is ignored. The certificate is not printed.

Keep `?sslmode=require` on `DATABASE_URL`. Supabase puts it there so a driver will not fall back to plaintext. Leave it. When `DATABASE_SSL` is empty outside production, `sslmode=require` (also `verify-ca` and `verify-full`) turns SSL on.

The driver would otherwise replace the TLS options with what it parses from that parameter, and the CA would be ignored. `uselibpqcompat=true` together with `sslmode=require` would also turn certificate checks off. Before connecting, the app removes `sslmode` and the other SSL query parameters from the URL it hands the driver, then sets TLS itself: encryption on, certificate check on, host name check on, and the CA from `DATABASE_SSL_CA` when you set it. You do not remove `sslmode=require` from the Render variable.

`npm run migration:run` uses that same path.

A database on your own computer does not need `DATABASE_SSL_CA`. Leave it blank and set `DATABASE_SSL=false`.

## What runs against production

Run `npm run migration:run` once, before the first real request, and again only when a new migration is added. The command reads `DATABASE_URL`, `DATABASE_SSL`, and `DATABASE_SSL_CA` from the environment and connects the same way the server does. It does not print the URL or the certificate.

Do not run `npm run seed` on the hosted database. After migration 14, load the real timetable with `npm run timetable:import` from `backend/`. That command reads `data/seed/bootcamp-timetable-and-outline.xlsx` and can be run again. It does not insert sample lessons. See `docs/timetable.md`.

Do not run `migration:revert` on the hosted database as a casual rollback. A reverted migration can drop columns. Roll back the Render deploy first, and read `docs/deployment.md` before touching the schema.
