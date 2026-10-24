import { Router } from 'express';
import request, { type Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runAdminCreate } from '../../src/commands/admin-create.js';
import { createApp } from '../../src/app.js';
import type { AppContainer } from '../../src/composition/container.js';
import { AppContainer as Container } from '../../src/composition/container.js';
import { requireAuth, requireRole } from '../../src/modules/auth/require-auth.js';
import { sessionTokenHash } from '../../src/modules/auth/tokens.js';
import { testEnv } from '../support/app-env.js';
import { readError, readRecord } from '../support/read-json.js';
import { revertOurMigrations } from '../support/migrations.js';
import { openTestDatabase } from '../support/test-database.js';

const PASSWORD = 'Correct-horse-1';
const ADMIN_EMAIL = 'admin@example.test';
const VIEWER_EMAIL = 'viewer@example.test';
const EDITOR_EMAIL = 'editor@example.test';
const LOCK_EMAIL = 'locked@example.test';

describe('authentication', () => {
  let container: AppContainer | undefined;
  let closeDatabase: (() => Promise<void>) | undefined;
  let databaseUrl = '';

  beforeAll(async () => {
    const database = await openTestDatabase();
    databaseUrl = database.url;
    closeDatabase = database.close;
    container = await Container.create(
      testEnv({
        databaseUrl: database.url,
        databaseSsl: false,
        logLevel: 'silent',
        loginIpFailureLimit: 100,
      }),
    );
    await container.dataSource.runMigrations();
    await container.users.createUser({
      email: ADMIN_EMAIL,
      password: PASSWORD,
      role: 'administrator',
      displayName: 'Ada Admin',
    });
    await container.users.createUser({
      email: VIEWER_EMAIL,
      password: PASSWORD,
      role: 'viewer',
      displayName: 'Vera Viewer',
    });
    await container.users.createUser({
      email: EDITOR_EMAIL,
      password: PASSWORD,
      role: 'editor',
      displayName: 'Eli Editor',
    });
    await container.users.createUser({
      email: LOCK_EMAIL,
      password: PASSWORD,
      role: 'viewer',
      displayName: 'Lock User',
    });
  });

  afterAll(async () => {
    if (container?.dataSource.isInitialized) {
      await revertOurMigrations(container.dataSource);
      await container.close();
    }
    if (closeDatabase) await closeDatabase();
  });

  it('starts a session, keeps the token out of the database, and describes the cookies', async () => {
    const current = useContainer();
    const response = await request(appFor(current))
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: PASSWORD, developmentAck: true })
      .expect(200);
    const user = readRecord(readRecord(response.body).user);
    expect(user).toMatchObject({
      email: ADMIN_EMAIL,
      role: 'administrator',
      displayName: 'Ada Admin',
    });
    expect(user.passwordHash).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain(PASSWORD);
    expect(JSON.stringify(response.body)).not.toContain('argon2');

    const cookies = cookiesFrom(response);
    const session = cookies.mn_session;
    const csrf = cookies.mn_csrf;
    if (!session || !csrf) throw new Error('Sign-in did not set both cookies.');
    expect(session.flags.toLowerCase()).toContain('httponly');
    expect(session.flags.toLowerCase()).toContain('samesite=lax');
    expect(session.flags.toLowerCase()).toContain('path=/api/v1');
    expect(session.flags.toLowerCase()).not.toMatch(/domain=/);
    expect(session.flags.toLowerCase()).not.toContain('secure');
    expect(csrf.flags.toLowerCase()).not.toContain('httponly');
    expect(csrf.flags.toLowerCase()).toMatch(/(?:^|;)\s*path=\/(?:;|$)/);
    expect(csrf.flags.toLowerCase()).not.toMatch(/domain=/);

    const secret = current.env.sessionSecret;
    if (!secret) throw new Error('The test session secret is missing.');
    const rows: unknown = await current.dataSource.query(
      'SELECT id, user_id FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = $1)',
      [ADMIN_EMAIL],
    );
    const storedSessions = JSON.stringify(rows);
    expect(storedSessions).toContain(sessionTokenHash(session.value, secret));
    expect(storedSessions).not.toContain(session.value);

    const stored: unknown = await current.dataSource.query(
      'SELECT password_hash FROM users WHERE email = $1',
      [ADMIN_EMAIL],
    );
    const storedText = JSON.stringify(stored);
    expect(storedText).toContain('$argon2id$');
    expect(storedText).not.toContain(PASSWORD);
  });

  it('sets Secure in production and still omits Domain', async () => {
    const current = useContainer();
    const response = await request(appFor(current, 'production'))
      .post('/api/v1/auth/login')
      .send({ email: EDITOR_EMAIL, password: PASSWORD })
      .expect(200);
    const session = cookiesFrom(response).mn_session;
    if (!session) throw new Error('Sign-in did not set a session cookie.');
    expect(session.flags.toLowerCase()).toContain('secure');
    expect(session.flags.toLowerCase()).not.toMatch(/domain=/);
    expect(JSON.stringify(response.body)).not.toContain(PASSWORD);
  });

  it('uses the same message when the mailbox is unknown or the password is wrong', async () => {
    const app = appFor(useContainer());
    const unknown = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.test', password: PASSWORD })
      .expect(401);
    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'Wrong-password-1' })
      .expect(401);
    expect(unknown.body).toEqual({
      error: { code: 'unauthenticated', message: 'The email or password is not correct.' },
    });
    expect(wrong.body).toEqual(unknown.body);
    expect(JSON.stringify(unknown.body)).not.toContain('nobody@example.test');
    expect(JSON.stringify(wrong.body)).not.toContain(ADMIN_EMAIL);
  });

  it('locks the mailbox after five failures, including a later correct password', async () => {
    const app = appFor(useContainer());
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: LOCK_EMAIL, password: 'Wrong-password-1' })
        .expect(401);
    }
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: LOCK_EMAIL, password: 'Wrong-password-1' })
      .expect(429);
    const locked = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: LOCK_EMAIL, password: PASSWORD })
      .expect(429);
    expect(locked.body).toEqual({
      error: {
        code: 'rate_limited',
        message: 'Too many sign-in attempts. Wait a minute and try again.',
      },
    });
  });

  it('requires a matching CSRF token to sign out, then forgets the session', async () => {
    const current = useContainer();
    const app = appFor(current);
    const signedIn = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VIEWER_EMAIL, password: PASSWORD })
      .expect(200);
    const cookies = cookiesFrom(signedIn);
    const header = cookieHeader(cookies);
    await request(app).post('/api/v1/auth/logout').set('Cookie', header).expect(403);
    const stillThere = await request(app)
      .get('/api/v1/auth/session')
      .set('Cookie', header)
      .expect(200);
    expect(stillThere.body).toMatchObject({ authenticated: true, user: { role: 'viewer' } });

    const csrf = cookies.mn_csrf?.value;
    if (!csrf) throw new Error('Sign-in did not set a CSRF cookie.');
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', header)
      .set('X-CSRF-Token', csrf)
      .expect(204);
    const gone = await request(app).get('/api/v1/auth/session').set('Cookie', header).expect(200);
    expect(gone.body).toEqual({ authenticated: false });
  });

  it('treats an expired session as signed out and rejects it on a protected route', async () => {
    const current = useContainer();
    const app = appFor(current);
    const signedIn = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EDITOR_EMAIL, password: PASSWORD })
      .expect(200);
    const header = cookieHeader(cookiesFrom(signedIn));
    await current.dataSource.query(
      `UPDATE sessions SET expires_at = now() - interval '1 minute'
       WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
      [EDITOR_EMAIL],
    );
    const session = await request(app)
      .get('/api/v1/auth/session')
      .set('Cookie', header)
      .expect(200);
    expect(session.body).toEqual({ authenticated: false });
    const probe = await request(app).get('/api/v1/editor-desk').set('Cookie', header).expect(401);
    expect(readError(probe.body).code).toBe('unauthenticated');
  });

  it('ends a session that has been idle past the limit', async () => {
    const current = useContainer();
    const app = appFor(current);
    const signedIn = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EDITOR_EMAIL, password: PASSWORD })
      .expect(200);
    await current.dataSource.query(
      `UPDATE sessions SET last_seen_at = now() - interval '2 hours', expires_at = now() + interval '1 hour'
       WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
      [EDITOR_EMAIL],
    );
    const session = await request(app)
      .get('/api/v1/auth/session')
      .set('Cookie', cookieHeader(cookiesFrom(signedIn)))
      .expect(200);
    expect(session.body).toEqual({ authenticated: false });
  });

  it('separates viewer, editor, and administrator', async () => {
    const app = appFor(useContainer());
    await request(app).get('/api/v1/editor-desk').expect(401);

    const viewer = cookieHeader(cookiesFrom(await signIn(app, VIEWER_EMAIL)));
    expect(
      readError((await request(app).get('/api/v1/editor-desk').set('Cookie', viewer)).body).code,
    ).toBe('forbidden');
    expect((await request(app).get('/api/v1/editor-desk').set('Cookie', viewer)).status).toBe(403);
    expect((await request(app).get('/api/v1/admin-desk').set('Cookie', viewer)).status).toBe(403);

    const editor = cookieHeader(cookiesFrom(await signIn(app, EDITOR_EMAIL)));
    expect((await request(app).get('/api/v1/editor-desk').set('Cookie', editor)).status).toBe(200);
    expect((await request(app).get('/api/v1/admin-desk').set('Cookie', editor)).status).toBe(403);

    const admin = cookieHeader(cookiesFrom(await signIn(app, ADMIN_EMAIL)));
    expect((await request(app).get('/api/v1/editor-desk').set('Cookie', admin)).status).toBe(200);
    const allowed = await request(app).get('/api/v1/admin-desk').set('Cookie', admin).expect(200);
    expect(allowed.body).toEqual({ role: 'administrator' });
  });

  it('does not offer public registration', async () => {
    const response = await request(appFor(useContainer()))
      .post('/api/v1/auth/register')
      .send({})
      .expect(404);
    expect(readError(response.body).code).toBe('not_found');
  });

  it('records sign-in and sign-out without the mailbox or the password', async () => {
    const current = useContainer();
    const rows: unknown = await current.dataSource.query('SELECT * FROM audit_events');
    const text = JSON.stringify(rows);
    expect(text).toContain('auth.login.succeeded');
    expect(text).toContain('auth.login.failed');
    expect(text).toContain('auth.logout');
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain(ADMIN_EMAIL);
    expect(text).not.toContain('argon2');
  });

  it('creates an administrator from the environment and never prints the secret', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const email = 'bootstrap@example.test';
    const code = await runAdminCreate({
      argv: ['--name', 'Bootstrap'],
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: databaseUrl,
        ADMIN_EMAIL: email,
        ADMIN_BOOTSTRAP_PASSWORD: PASSWORD,
      },
      loadDotenv: false,
      prompt: () => Promise.reject(new Error('prompt')),
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    });
    expect(code).toBe(0);
    expect(stdout).toEqual(['Administrator account is ready.']);
    expect(stderr).toEqual([]);
    expect(stdout.join('')).not.toContain(PASSWORD);
    expect(stdout.join('')).not.toContain(email);

    const again = await runAdminCreate({
      argv: [],
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: databaseUrl,
        ADMIN_EMAIL: email,
        ADMIN_BOOTSTRAP_PASSWORD: PASSWORD,
      },
      loadDotenv: false,
      prompt: () => Promise.reject(new Error('prompt')),
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    });
    expect(again).toBe(1);
    expect(stderr.join('')).toBe('An account with that mailbox already exists.');
    expect(stderr.join('')).not.toContain(email);
    expect(stderr.join('')).not.toContain(PASSWORD);
  });

  function useContainer(): AppContainer {
    if (!container) throw new Error('The test database was not opened.');
    return container;
  }
});

function appFor(container: AppContainer, nodeEnv?: 'production') {
  const probe = Router();
  probe.get(
    '/api/v1/editor-desk',
    requireAuth(container.sessions),
    requireRole('editor'),
    (req, res) => {
      res.json({ role: req.user?.role });
    },
  );
  probe.get(
    '/api/v1/admin-desk',
    requireAuth(container.sessions),
    requireRole('administrator'),
    (req, res) => {
      res.json({ role: req.user?.role });
    },
  );
  const env = nodeEnv ? { ...container.env, nodeEnv } : container.env;
  return createApp({
    env,
    logger: container.logger,
    health: container.health,
    authRouter: container.authRouter,
    curriculumRouter: container.curriculumRouter,
    extraRouters: [probe],
  });
}

function signIn(app: ReturnType<typeof appFor>, email: string) {
  return request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
}

interface SetCookie {
  value: string;
  flags: string;
}

function cookiesFrom(response: Response): Record<string, SetCookie> {
  const cookies: Record<string, SetCookie> = {};
  for (const line of headerLines(response.headers['set-cookie'])) {
    const parts = line.split(';');
    const pair = parts[0] ?? '';
    const eq = pair.indexOf('=');
    if (eq < 1) continue;
    const name = pair.slice(0, eq).trim();
    cookies[name] = {
      value: decodeURIComponent(pair.slice(eq + 1).trim()),
      flags: parts.slice(1).join(';'),
    };
  }
  return cookies;
}

function headerLines(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function cookieHeader(cookies: Record<string, SetCookie>): string {
  return ['mn_session', 'mn_csrf']
    .filter((name) => cookies[name]?.value)
    .map((name) => `${name}=${cookies[name]?.value ?? ''}`)
    .join('; ');
}
