import { type Response } from 'supertest';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSeed } from '../../src/commands/seed.js';
import { createApp } from '../../src/app.js';
import type { AppContainer } from '../../src/composition/container.js';
import { AppContainer as Container } from '../../src/composition/container.js';
import { MemoryMail } from '../../src/modules/mail/memory-mail.js';
import { revertOurMigrations } from '../support/migrations.js';
import { testEnv } from '../support/app-env.js';
import { readError, readRecord } from '../support/read-json.js';
import { openTestDatabase } from '../support/test-database.js';

const PASSWORD = 'Correct-horse-1';
const NEXT_PASSWORD = 'New-password-2';
const RESET_PASSWORD = 'Reset-password-3';
const INVITE_PASSWORD = 'Invite-password-4';
const ENQUIRY = 'Please tell me about the sample bootcamp week.';
const RESET_BODY = {
  accepted: true,
  delivered: false,
  message: 'If an account exists for that address, a reset message will be sent.',
};

describe('accounts and enquiries', () => {
  let container: AppContainer | undefined;
  let closeDatabase: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    const database = await openTestDatabase();
    closeDatabase = database.close;
    container = await Container.create(
      testEnv({
        databaseUrl: database.url,
        databaseSsl: false,
        logLevel: 'silent',
        loginFailureLimit: 80,
        loginIpFailureLimit: 80,
      }),
    );
    await container.dataSource.runMigrations();
    await container.users.createUser({
      email: 'viewer@example.test',
      password: PASSWORD,
      role: 'viewer',
      displayName: 'Vera Viewer',
    });
    await container.users.createUser({
      email: 'editor@example.test',
      password: PASSWORD,
      role: 'editor',
      displayName: 'Eli Editor',
    });
    await container.users.createUser({
      email: 'administrator@example.test',
      password: PASSWORD,
      role: 'administrator',
      displayName: 'Ada Admin',
    });
    await container.users.createUser({
      email: 'reset@example.test',
      password: PASSWORD,
      role: 'viewer',
      displayName: 'Ren Reset',
    });
    const code = await runSeed({
      env: { NODE_ENV: 'test', DATABASE_URL: database.url },
      loadDotenv: false,
      stdout: () => undefined,
      stderr: (line) => {
        throw new Error(line);
      },
    });
    expect(code).toBe(0);
  });

  afterAll(async () => {
    if (container?.dataSource.isInitialized) {
      await revertOurMigrations(container.dataSource);
      await container.close();
    }
    if (closeDatabase) await closeDatabase();
  });

  it('answers a reset the same way for a known mailbox and an unknown one', async () => {
    const app = appFor(useContainer());
    const unknown = await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'missing@example.test' })
      .expect(200);
    const known = await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'reset@example.test' })
      .expect(200);
    expect(unknown.body).toEqual(RESET_BODY);
    expect(known.body).toEqual(RESET_BODY);
    expect(JSON.stringify(unknown.body)).not.toContain('missing@example.test');
    expect(JSON.stringify(known.body)).not.toContain('reset@example.test');
    expect(JSON.stringify(known.body)).not.toContain('developmentResetPath');
    const mail = memoryMail(useContainer());
    expect(mail.sent.filter((item) => item.to === 'missing@example.test')).toHaveLength(0);
    expect(mail.sent.filter((item) => item.to === 'reset@example.test')).toHaveLength(1);
    const bad = await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'not-an-email' })
      .expect(422);
    expect(readError(bad.body).code).toBe('validation');
    expect(JSON.stringify(bad.body)).not.toContain('reset@example.test');
  });

  it('stores a reset hash once, keeps the link if the new password is rejected, and signs every session out', async () => {
    const app = appFor(useContainer());
    const current = await signIn(app, 'reset@example.test', PASSWORD);
    await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'reset@example.test' })
      .expect(200);
    const letter = latestTo(memoryMail(useContainer()), 'reset@example.test');
    const token = tokenFrom(letter.text);
    const rejected = await request(app)
      .post('/api/v1/auth/password-reset/complete')
      .send({ token, password: 'short-1', confirm: 'short-1' })
      .expect(422);
    expect(field(rejected.body, 'password')).toBe('Use at least 12 characters.');
    const mismatch = await request(app)
      .post('/api/v1/auth/password-reset/complete')
      .send({ token, password: RESET_PASSWORD, confirm: 'Different-password-3' })
      .expect(422);
    expect(field(mismatch.body, 'confirm')).toBe('The two passwords do not match.');
    const saved = await request(app)
      .post('/api/v1/auth/password-reset/complete')
      .send({ token, password: RESET_PASSWORD, confirm: RESET_PASSWORD })
      .expect(200);
    expect(saved.body).toEqual({
      completed: true,
      passwordStored: true,
      message: 'The password is saved. Sign in with the new password.',
    });
    const again = await request(app)
      .post('/api/v1/auth/password-reset/complete')
      .send({ token, password: RESET_PASSWORD, confirm: RESET_PASSWORD })
      .expect(422);
    const missing = await request(app)
      .post('/api/v1/auth/password-reset/complete')
      .send({ token: 'missing-token', password: RESET_PASSWORD, confirm: RESET_PASSWORD })
      .expect(422);
    expect(field(again.body, 'token')).toBe('This reset link is missing, used or expired.');
    expect(field(missing.body, 'token')).toBe(field(again.body, 'token'));
    await request(app).get('/api/v1/admin/home').set('Cookie', current.cookie).expect(401);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'reset@example.test', password: PASSWORD })
      .expect(401);
    await signIn(app, 'reset@example.test', RESET_PASSWORD);
  });

  it('treats an expired link like a missing one', async () => {
    const app = appFor(useContainer());
    await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'reset@example.test' })
      .expect(200);
    const token = tokenFrom(latestTo(memoryMail(useContainer()), 'reset@example.test').text);
    await useContainer().dataSource.query(
      `UPDATE access_tokens SET expires_at = now() - interval '1 minute'`,
    );
    const expired = await request(app)
      .post('/api/v1/auth/password-reset/complete')
      .send({ token, password: RESET_PASSWORD, confirm: RESET_PASSWORD })
      .expect(422);
    expect(field(expired.body, 'token')).toBe('This reset link is missing, used or expired.');
    expect(JSON.stringify(expired.body)).not.toContain(token);
  });

  it('checks the current password, then signs out the other sessions', async () => {
    const app = appFor(useContainer());
    const first = await signIn(app, 'viewer@example.test', PASSWORD);
    const second = await signIn(app, 'viewer@example.test', PASSWORD);
    const blocked = await request(app)
      .post('/api/v1/admin/account/password')
      .set('Cookie', first.cookie)
      .send({ current: PASSWORD, next: NEXT_PASSWORD, confirm: NEXT_PASSWORD })
      .expect(403);
    expect(readError(blocked.body).message).toBe('The security token does not match.');
    const wrong = await request(app)
      .post('/api/v1/admin/account/password')
      .set('Cookie', first.cookie)
      .set('X-CSRF-Token', first.csrf)
      .send({ current: 'Wrong-password-1', next: NEXT_PASSWORD, confirm: NEXT_PASSWORD })
      .expect(422);
    expect(field(wrong.body, 'current')).toBe('The current password is not correct.');
    const changed = await request(app)
      .post('/api/v1/admin/account/password')
      .set('Cookie', first.cookie)
      .set('X-CSRF-Token', first.csrf)
      .send({ current: PASSWORD, next: NEXT_PASSWORD, confirm: NEXT_PASSWORD })
      .expect(200);
    expect(readRecord(changed.body).changed).toBe(true);
    await request(app).get('/api/v1/admin/home').set('Cookie', second.cookie).expect(401);
    await request(app).get('/api/v1/admin/home').set('Cookie', first.cookie).expect(200);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'viewer@example.test', password: PASSWORD })
      .expect(401);
    const restoredSession = await signIn(app, 'viewer@example.test', NEXT_PASSWORD);
    await request(app)
      .post('/api/v1/admin/account/password')
      .set('Cookie', restoredSession.cookie)
      .set('X-CSRF-Token', restoredSession.csrf)
      .send({ current: NEXT_PASSWORD, next: PASSWORD, confirm: PASSWORD })
      .expect(200);
  });

  it('lets only an administrator list users, change roles, and invite', async () => {
    const app = appFor(useContainer());
    await request(app).get('/api/v1/admin/users').expect(401);
    const viewer = await signIn(app, 'viewer@example.test', PASSWORD);
    const editor = await signIn(app, 'editor@example.test', PASSWORD);
    const admin = await signIn(app, 'administrator@example.test', PASSWORD);
    await request(app).get('/api/v1/admin/users').set('Cookie', viewer.cookie).expect(403);
    await request(app).get('/api/v1/admin/users').set('Cookie', editor.cookie).expect(403);
    const listed = await request(app)
      .get('/api/v1/admin/users')
      .set('Cookie', admin.cookie)
      .expect(200);
    expect(JSON.stringify(listed.body)).not.toContain('argon2');
    expect(JSON.stringify(listed.body)).toContain('administrator@example.test');

    const demoted = await request(app)
      .patch(`/api/v1/admin/users/${admin.userId}`)
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .send({ role: 'viewer' })
      .expect(422);
    expect(readError(demoted.body).message).toBe(
      'You cannot remove your own administrator access from this session.',
    );
    expect(field(demoted.body, 'role')).toBe('Ask another administrator to change your role.');

    const invited = await request(app)
      .post('/api/v1/admin/users/invite')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .send({ email: 'guest@example.test' })
      .expect(422);
    expect(field(invited.body, 'role')).toBe('Choose a role.');

    const created = await request(app)
      .post('/api/v1/admin/users/invite')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .send({ email: 'guest@example.test', role: 'editor' })
      .expect(200);
    expect(created.body).toEqual({ delivered: true, message: 'The invitation was sent.' });
    const letter = latestTo(memoryMail(useContainer()), 'guest@example.test');
    const duplicate = await request(app)
      .post('/api/v1/admin/users/invite')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .send({ email: 'guest@example.test', role: 'viewer' })
      .expect(422);
    expect(JSON.stringify(duplicate.body)).not.toContain('guest@example.test');
    expect(readError(duplicate.body).message).toBe('An account with that mailbox already exists.');

    const blocked = await request(app)
      .post('/api/v1/admin/users/invite')
      .set('Cookie', admin.cookie)
      .send({ email: 'other@example.test', role: 'viewer' })
      .expect(403);
    expect(readError(blocked.body).message).toBe('The security token does not match.');

    await request(app)
      .post('/api/v1/auth/password-reset/complete')
      .send({ token: tokenFrom(letter.text), password: INVITE_PASSWORD, confirm: INVITE_PASSWORD })
      .expect(200);
    const guest = await signIn(app, 'guest@example.test', INVITE_PASSWORD);
    expect(guest.userId).not.toBe('');
    const promoted = await request(app)
      .patch(`/api/v1/admin/users/${viewer.userId}`)
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .send({ role: 'editor' })
      .expect(200);
    expect(readRecord(promoted.body).role).toBe('editor');
    await request(app)
      .put('/api/v1/admin/home')
      .set('Cookie', viewer.cookie)
      .set('X-CSRF-Token', viewer.csrf)
      .send({ eyebrow: 'Sample eyebrow' })
      .expect(200);
    await request(app)
      .patch(`/api/v1/admin/users/${viewer.userId}`)
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .send({ role: 'viewer' })
      .expect(200);
  });

  it('stores a public enquiry, drops the honeypot, and keeps the inbox for administrators', async () => {
    const app = appFor(useContainer());
    const before: unknown = await useContainer().dataSource.query('SELECT id FROM enquiries');
    const spam = await request(app)
      .post('/api/v1/public/enquiries')
      .send({
        name: 'Spam',
        email: 'spam@example.test',
        topic: 'The 2026 bootcamp',
        message: ENQUIRY,
        consent: true,
        company: 'spam company',
      })
      .expect(200);
    expect(readRecord(spam.body).delivered).toBe(false);
    expect(readRecord(spam.body).message).toBe('The message is saved. No email was sent.');
    const afterSpam: unknown = await useContainer().dataSource.query('SELECT id FROM enquiries');
    expect(rowCount(afterSpam)).toBe(rowCount(before));

    const short = await request(app)
      .post('/api/v1/public/enquiries')
      .send({
        name: 'Ada',
        email: 'ada@example.test',
        topic: 'The 2026 bootcamp',
        message: 'Too short',
        consent: true,
      })
      .expect(422);
    expect(field(short.body, 'message')).toBe('Use at least 20 characters.');
    const consent = await request(app)
      .post('/api/v1/public/enquiries')
      .send({
        name: 'Ada',
        email: 'ada@example.test',
        topic: 'The 2026 bootcamp',
        message: ENQUIRY,
        consent: false,
      })
      .expect(422);
    expect(field(consent.body, 'consent')).toBe(
      'Tick to confirm you understand this message is not delivered.',
    );

    const saved = await request(app)
      .post('/api/v1/public/enquiries')
      .send({
        name: 'Ada Sample',
        email: 'ada@example.test',
        topic: 'The 2026 bootcamp',
        message: ENQUIRY,
        consent: true,
        company: '',
      })
      .expect(200);
    const body = readRecord(saved.body);
    expect(body.delivered).toBe(true);
    expect(body.message).toBe('The message is saved.');
    expect(JSON.stringify(saved.body)).not.toContain(ENQUIRY);
    const notice = latestTo(memoryMail(useContainer()), 'mninfo@maximnyansa.com');
    expect(notice.subject).toBe('New enquiry');

    await request(app).get('/api/v1/admin/enquiries').expect(401);
    const viewer = await signIn(app, 'viewer@example.test', PASSWORD);
    const editor = await signIn(app, 'editor@example.test', PASSWORD);
    const admin = await signIn(app, 'administrator@example.test', PASSWORD);
    await request(app).get('/api/v1/admin/enquiries').set('Cookie', viewer.cookie).expect(403);
    await request(app).get('/api/v1/admin/enquiries').set('Cookie', editor.cookie).expect(403);
    const inbox = await request(app)
      .get('/api/v1/admin/enquiries')
      .set('Cookie', admin.cookie)
      .expect(200);
    const rows = asList(inbox.body);
    const found = rows.find((item) => readRecord(item).message === ENQUIRY);
    const record = readRecord(found);
    expect(record.handled).toBe(false);
    expect(record.notified).toBe(true);
    const id = record.id;
    if (typeof id !== 'string') throw new Error('Expected an enquiry id.');
    const handled = await request(app)
      .patch(`/api/v1/admin/enquiries/${id}`)
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .send({ handled: true })
      .expect(200);
    expect(readRecord(handled.body).handled).toBe(true);
    const removed = await request(app)
      .delete(`/api/v1/admin/enquiries/${id}`)
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .expect(200);
    expect(removed.body).toEqual({ deleted: true, id });
    const left = await request(app)
      .get('/api/v1/admin/enquiries')
      .set('Cookie', admin.cookie)
      .expect(200);
    expect(JSON.stringify(left.body)).not.toContain(ENQUIRY);
  });

  it('leaves session expiry and search unimplemented', async () => {
    const app = appFor(useContainer());
    await request(app).post('/api/v1/auth/session/expire').expect(404);
    const admin = await signIn(app, 'administrator@example.test', PASSWORD);
    const search = await request(app)
      .get('/api/v1/admin/search')
      .set('Cookie', admin.cookie)
      .expect(404);
    expect(readError(search.body).code).toBe('not_found');
  });

  it('keeps mailboxes, tokens, and message text out of the audit rows', async () => {
    const rows: unknown = await useContainer().dataSource.query('SELECT * FROM audit_events');
    const blob = JSON.stringify(rows);
    expect(blob).not.toContain('example.test');
    expect(blob).not.toContain('maximnyansa.com');
    expect(blob).not.toContain(ENQUIRY);
    expect(blob).not.toContain(PASSWORD);
    expect(blob).not.toContain(NEXT_PASSWORD);
    expect(blob).not.toContain(RESET_PASSWORD);
    expect(blob).not.toContain(INVITE_PASSWORD);
    expect(blob).not.toContain('Invite-');
    for (const message of memoryMail(useContainer()).sent) {
      expect(blob).not.toContain(message.to);
      if (message.text.includes('token=')) expect(blob).not.toContain(tokenFrom(message.text));
    }
  });

  function useContainer(): AppContainer {
    if (!container) throw new Error('The test database is not open.');
    return container;
  }
});

function appFor(container: AppContainer) {
  return createApp({
    env: container.env,
    logger: container.logger,
    health: container.health,
    authRouter: container.authRouter,
    curriculumRouter: container.curriculumRouter,
  });
}

function memoryMail(container: AppContainer): MemoryMail {
  if (!(container.mail instanceof MemoryMail)) throw new Error('Expected in-memory mail.');
  return container.mail;
}

function latestTo(mail: MemoryMail, to: string): { to: string; subject: string; text: string } {
  const found = [...mail.sent].reverse().find((item) => item.to === to);
  if (!found) throw new Error('Expected a kept message.');
  return found;
}

function tokenFrom(text: string): string {
  const marker = 'token=';
  const start = text.indexOf(marker);
  if (start < 0) throw new Error('The mail did not include a link.');
  const rest = text.slice(start + marker.length);
  const end = rest.search(/\s/);
  const raw = end < 0 ? rest : rest.slice(0, end);
  return decodeURIComponent(raw);
}

function rowCount(value: unknown): number {
  if (!Array.isArray(value)) throw new Error('Expected rows.');
  return value.length;
}

function asList(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected a list.');
  return value.map((entry) => {
    const item: unknown = entry;
    return item;
  });
}

function field(body: unknown, name: string): unknown {
  const error = readRecord(readRecord(body).error);
  return readRecord(error.fieldErrors)[name];
}

async function signIn(app: ReturnType<typeof appFor>, email: string, password: string) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  const cookies = cookiesFrom(response);
  const session = cookies.mn_session;
  const csrf = cookies.mn_csrf;
  const user = readRecord(readRecord(response.body).user);
  if (!session || !csrf || typeof user.id !== 'string') {
    throw new Error('Sign-in did not set both cookies.');
  }
  return {
    cookie: `mn_session=${session.value}; mn_csrf=${csrf.value}`,
    csrf: csrf.value,
    userId: user.id,
  };
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
