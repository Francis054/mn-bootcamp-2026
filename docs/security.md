# Security

Nothing in this file is a secret. The values live in the Render Environment tab for the API, and only there.

## One origin

The browser talks to one host. Pages and `/api/v1` share that host, so the session cookie is a first-party cookie. `*.onrender.com` is a public suffix: a cookie set by the API’s own `onrender.com` hostname is not sent to the website’s `onrender.com` hostname. That is why the site must not call the API on a second host.

Cookies:

| Cookie | JavaScript | Path | SameSite | Secure | Domain |
| --- | --- | --- | --- | --- | --- |
| `mn_session` | HttpOnly, never read | `/api/v1` | Lax | Yes when `NODE_ENV=production` | Not set (this host only) |
| `mn_csrf` | Readable, copied into `X-CSRF-Token` | `/` | Lax | Yes when `NODE_ENV=production` | Not set |

`Secure` is on only when `NODE_ENV` is `production`. A production process must set that. The session secret is required in production and must be at least 32 characters. It is used to hash the cookie. It is never logged. Generate it locally with `openssl rand -base64 32` and paste it into Render. Do not reuse the example string from the checklist.

`FRONTEND_URL` is the one allowed browser origin, scheme plus host, with no path. CORS allows a request with no `Origin` (a health check or curl) or an `Origin` equal to that value, and it allows credentials. Any other origin is refused. After you add a custom domain, change `FRONTEND_URL` to that `https` origin and redeploy the API. Host-only cookies mean `www` and the apex are different sites. Pick one and redirect the other.

`TRUST_PROXY` defaults to `true` in production. The app trusts one proxy hop so the rate limiter sees the visitor address. Leave it `true` behind Render.

## Requests

- JSON bodies are capped at 1 MB. Uploads default to 5 MB and cannot be set above 10 MB (`UPLOAD_MAX_BYTES`).
- Page reads, including public pages and `GET /api/v1/auth/session`, allow 600 requests per 60 seconds per visitor. If `RATE_LIMIT_MAX` is set higher than 600, reads use that higher number instead. Sign-in, password reset, uploads, and other writes stay on `RATE_LIMIT_MAX` (300 per 60 seconds per visitor when it is unset). `GET /api/v1/health` is not counted. Leave `TRUST_PROXY` true on Render so each visitor is counted separately, not as one shared address. The limit is stored under both the current name and the older `max` name, so an older copy of the rate-limit library cannot fall back to 5 requests.
- Sign-in failures lock a mailbox after 5 failures for 60 seconds, and an address after 30 failures. The error does not say whether the mailbox exists.
- Unsafe methods that present `mn_session` must send `X-CSRF-Token` equal to `mn_csrf`. A mismatch is 403.
- The website does not store a session token in `localStorage` or `sessionStorage`. The sidebar key `mn-sb` is a layout preference only. A copy of published public pages is kept in `sessionStorage` for eight minutes so a refresh can show the last page while the API wakes up. Sign-in, admin, and failed responses are not stored.
- A `401` on an admin call returns the visitor to `/admin/login`. Login and password reset stay on the form. `GET /auth/session` returns `{ authenticated: false }` for an anonymous visitor and does not count as an expired session.

## Passwords and accounts

Stored passwords need at least 12 characters, a letter, and a number. They cannot be the mailbox or a short list of common passwords. The login form still asks for 8 characters, which is only the sign-in check.

`npm run admin:create` reads the mailbox from an argument, `--email`, or `ADMIN_EMAIL`. It reads the password from `ADMIN_BOOTSTRAP_PASSWORD` or from a hidden prompt. It refuses `--password` so the password does not land in shell history. It prints `Administrator account is ready.` or `Administrator password updated.` It does not print the mailbox or the password. Do not put `ADMIN_BOOTSTRAP_PASSWORD` in git, and do not leave it in the Render environment after the command finishes.

Roles and permissions. The same map is in `backend/src/modules/auth/permissions.ts` and `frontend/src/domain/permissions.ts`. `content.read` is the gate for the whole `/api/v1/admin` router. A trainee or a trainer does not have it, so they cannot open that router or read another trainee's email, notes, consent, or drafts. The React admin shell uses the same check.

| Role | Permissions |
| --- | --- |
| Trainee | `portal.access`, `portal.write`, `account.manage` |
| Trainer | `account.manage` |
| Viewer | `content.read`, `account.manage` |
| Editor | viewer, plus `content.write`, `media.upload`, `media.write` |
| Administrator | editor, plus `users.read`, `users.manage`, `settings.manage` |

`portal.access` and `portal.write` are reserved for the trainee's own area. No portal route uses them yet. `account.manage` is the person's own password. The only password route today is `POST /api/v1/admin/account/password`, which also requires `content.read`, so a trainee or trainer cannot call it. The public reset flow still works. Gallery upload is `media.upload` and sits on the admin router, so only an editor or an administrator can upload. An editor confirms consent, then publishes. An administrator can confirm consent and publish in one step. There is no separate publish permission. The server checks the role. The React gate is only a convenience. Consent rules stay: a trainee profile cannot be published without recorded consent, and a photo PATCH still cannot verify consent and publish together.

## Mail and photos

Resend is used only when both `RESEND_API_KEY` and `EMAIL_FROM` are set. In production, if either is missing, the process still boots and reports that nothing was sent. Cloudinary is used only when the cloud name, API key, and API secret are all set. In production, if they are missing, uploads are refused and the process still boots. Do not put those secrets in `frontend/` environment variables. Vite copies `VITE_` variables into the public JavaScript bundle.

## Logs

The logger redacts cookies, authorization headers, `DATABASE_URL`, `DATABASE_SSL_CA`, `SESSION_SECRET`, `ADMIN_BOOTSTRAP_PASSWORD`, and password fields. Do not add those values to a log line, a health response, or an error message.

## Supabase Data API

The website and the API do not use `supabase-js`, the anon key, or the Data API. TypeORM connects with `DATABASE_URL`. On project `mn-bootcamp-2026` (ref `psxzqwztgjkqnnncxddc`) that user is `postgres.psxzqwztgjkqnnncxddc` on the session pooler, which is the `postgres` role. Supabase documents that role as having `bypassrls` (see the security-definer section of their [row level security guide](https://supabase.com/docs/guides/database/postgres/row-level-security)). The same role runs `npm run migration:run`, so it owns the tables.

Migration `PublicRls1794096000000` enables row level security on every ordinary table and partitioned table in `public`, including `schema_migrations`. It does not set `FORCE ROW LEVEL SECURITY`. The table owner bypasses row level security when force is unset, including a role that is not a superuser and does not have `bypassrls`. `anon` and `authenticated` do not bypass it. No policies are added, so those roles receive no rows. The migration also revokes every table and sequence privilege in `public` from `anon` and `authenticated`, and clears the default privileges that would grant a later table to them. `REVOKE ALL ON ALL TABLES` covers views in `public` as well. `service_role` is unchanged. Supabase documents that role as bypassing row level security. Nothing in this repository uses it. Do not put that key in the website.

A table created by a later migration is not granted to `anon` or `authenticated`, because the default privileges are cleared for `postgres`. Enable row level security in that later migration as well. Supabase does not allow `postgres` to create the event trigger that would do it automatically.

The Security Advisor may then report `rls_enabled_no_policy` at info level for each table. That is the locked state. Do not add a policy whose expression is `true`. That would publish the table on the Data API again.

Passwords are Argon2id hashes in `users.password_hash`. The login cookie and the reset or invite token are stored only as hashes (`sessions.id`, `access_tokens.token_hash`). Mailboxes on `users`, `trainees`, and `enquiries` are columns the product uses. The public trainee response leaves the mailbox off. `login_throttles.subject_key` stores the prefix `email:` plus the mailbox for sign-in failures, and `ip:` plus the client address. Password-reset throttles store a SHA-256 digest instead. This migration does not rewrite those rows.

Production deploys from `main`. The free Render service may not run migrations. Until `schema_migrations` contains `PublicRls1794096000000`, paste the block below into the Supabase SQL editor. It is the migration, and it is safe to run more than once. Pasting it does not insert the migration row. The next `npm run migration:run` records the row and runs the same statements again.

```sql
DO $lock_public$
DECLARE
  public_table text;
  target_role text;
  grantor_role text;
BEGIN
  FOR public_table IN
    SELECT c.relname
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', public_table);
  END LOOP;

  FOR target_role IN
    SELECT r.rolname
    FROM pg_catalog.pg_roles AS r
    WHERE r.rolname IN ('anon', 'authenticated')
    ORDER BY r.rolname
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM %I',
      target_role
    );
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %I',
      target_role
    );
  END LOOP;

  FOR grantor_role IN
    SELECT r.rolname
    FROM pg_catalog.pg_roles AS r
    WHERE r.rolname IN (CURRENT_USER, 'postgres')
      AND (
        r.rolname = CURRENT_USER
        OR pg_catalog.pg_has_role(CURRENT_USER, r.rolname, 'MEMBER')
      )
    ORDER BY r.rolname
  LOOP
    FOR target_role IN
      SELECT r.rolname
      FROM pg_catalog.pg_roles AS r
      WHERE r.rolname IN ('anon', 'authenticated')
      ORDER BY r.rolname
    LOOP
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM %I',
        grantor_role,
        target_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM %I',
        grantor_role,
        target_role
      );
    END LOOP;
  END LOOP;
END
$lock_public$;
```

Confirm it. Every ordinary table should show `rls_on = true`, and the privilege query should return no rows.

```sql
SELECT c.relname AS table_name, c.relrowsecurity AS rls_on, c.relforcerowsecurity AS forced
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
```

Then open Database → Security Advisor and choose Rerun. `rls_disabled_in_public` and `sensitive_columns_exposed` should be gone. `rls_enabled_no_policy` may remain as info. Leave it.
