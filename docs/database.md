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

The code turns that flag into Node’s TLS option `{ rejectUnauthorized: true }` in `backend/src/database/data-source.ts`. There is no environment variable for a CA file. The process checks the server certificate against Node’s built-in certificate list. It does not load the Supabase CA you can download from Database settings.

Supabase’s own guide asks for `sslmode=require` on the URL so the driver will not fall back to plaintext. Put that on `DATABASE_URL` as well. `require` encrypts the connection. The app’s `rejectUnauthorized: true` also checks the certificate.

If the process fails at startup with a certificate error, stop. Do not set `DATABASE_SSL=false` to get past it. This build has no setting for a custom CA.

## What runs against production

Run `npm run migration:run` once, before the first real request, and again only when a new migration is added. The command reads `DATABASE_URL` from the environment. It does not print the URL.

Do not run `npm run seed` on the hosted database.

Do not run `migration:revert` on the hosted database as a casual rollback. A reverted migration can drop columns. Roll back the Render deploy first, and read `docs/deployment.md` before touching the schema.
