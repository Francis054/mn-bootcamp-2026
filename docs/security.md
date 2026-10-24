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
- A general rate limit defaults to 300 requests per 60 seconds per address. `GET /api/v1/health` is not counted.
- Sign-in failures lock a mailbox after 5 failures for 60 seconds, and an address after 30 failures. The error does not say whether the mailbox exists.
- Unsafe methods that present `mn_session` must send `X-CSRF-Token` equal to `mn_csrf`. A mismatch is 403.
- The website does not store a token in `localStorage` or `sessionStorage`. The sidebar key `mn-sb` is a layout preference only.
- A `401` on an admin call returns the visitor to `/admin/login`. Login and password reset stay on the form. `GET /auth/session` returns `{ authenticated: false }` for an anonymous visitor and does not count as an expired session.

## Passwords and accounts

Stored passwords need at least 12 characters, a letter, and a number. They cannot be the mailbox or a short list of common passwords. The login form still asks for 8 characters, which is only the sign-in check.

`npm run admin:create` reads the mailbox from an argument, `--email`, or `ADMIN_EMAIL`. It reads the password from `ADMIN_BOOTSTRAP_PASSWORD` or from a hidden prompt. It refuses `--password` so the password does not land in shell history. It prints `Administrator account is ready.` or `Administrator password updated.` It does not print the mailbox or the password. Do not put `ADMIN_BOOTSTRAP_PASSWORD` in git, and do not leave it in the Render environment after the command finishes.

Roles: viewer (`content.read`, `account.manage`), editor (those plus `content.write` and `media.write`), administrator (those plus `users.read`, `users.manage`, `settings.manage`). There is no separate publish permission. The server checks the role. The React gate is only a convenience.

## Mail and photos

Resend is used only when both `RESEND_API_KEY` and `EMAIL_FROM` are set. In production, if either is missing, the process still boots and reports that nothing was sent. Cloudinary is used only when the cloud name, API key, and API secret are all set. In production, if they are missing, uploads are refused and the process still boots. Do not put those secrets in `frontend/` environment variables. Vite copies `VITE_` variables into the public JavaScript bundle.

## Logs

The logger redacts cookies, authorization headers, `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_BOOTSTRAP_PASSWORD`, and password fields. Do not add those values to a log line, a health response, or an error message.
