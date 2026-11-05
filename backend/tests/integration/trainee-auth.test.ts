import request, { type Response } from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { runSeed } from '../../src/commands/seed.js';
import type { AppContainer } from '../../src/composition/container.js';
import { AppContainer as Container } from '../../src/composition/container.js';
import { MemoryMail } from '../../src/modules/mail/memory-mail.js';
import { ApproveWaitingTrainees1794873600000 } from '../../src/database/migrations/1794873600000-ApproveWaitingTrainees.js';
import { BAD_LOGIN } from '../../src/modules/auth/auth.service.js';
import {
  ACCOUNT_DEACTIVATED_MESSAGE,
  APPROVED_READY_MESSAGE,
  PENDING_APPROVAL_MESSAGE,
  REGISTRATION_REJECTED_MESSAGE,
  SIGNUP_ACCEPTED,
} from '../../src/modules/trainee-auth/signup.rules.js';
import { testEnv } from '../support/app-env.js';
import { revertOurMigrations } from '../support/migrations.js';
import { readRecord } from '../support/read-json.js';
import { openTestDatabase } from '../support/test-database.js';

const PASSWORD = 'Correct-horse-1';
const NEXT_PASSWORD = 'Correct-horse-2';
const ROSTER = 'trainee01@example.test';

let container: AppContainer | undefined;
let closeDatabase: (() => Promise<void>) | undefined;

describe('trainee signup and portal', () => {

  beforeAll(async () => {
    const database = await openTestDatabase();
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
    const code = await runSeed({
      env: { NODE_ENV: 'test', DATABASE_URL: database.url },
      loadDotenv: false,
      stdout: () => undefined,
      stderr: (line) => {
        throw new Error(line);
      },
    });
    expect(code).toBe(0);
    await container.users.createUser({
      email: 'admin@example.test',
      password: PASSWORD,
      role: 'administrator',
      displayName: 'Ada Admin',
    });
    await container.users.createUser({
      email: 'editor@example.test',
      password: PASSWORD,
      role: 'editor',
      displayName: 'Eli Editor',
    });
  });

  beforeEach(async () => {
    const current = useContainer();
    await current.dataSource.query(
      `DELETE FROM login_throttles WHERE subject_key LIKE 'signup%' OR subject_key LIKE 'verify-resend%'`,
    );
  });

  afterAll(async () => {
    if (container?.dataSource.isInitialized) {
      await revertOurMigrations(container.dataSource);
      await container.close();
    }
    if (closeDatabase) await closeDatabase();
  });

  it('uses the same response for a roster email, an unknown email, and a honeypot', async () => {
    const app = appFor(useContainer());
    const roster = await request(app).post('/api/v1/public/trainee-signup').send(signupBody(ROSTER)).expect(202);
    const unknown = await request(app)
      .post('/api/v1/public/trainee-signup')
      .send(signupBody('stranger@example.test'))
      .expect(202);
    const honeypot = await request(app)
      .post('/api/v1/public/trainee-signup')
      .send({ ...signupBody('bot@example.test'), company: 'Spam Co' })
      .expect(202);
    expect(roster.body).toEqual(SIGNUP_ACCEPTED);
    expect(unknown.body).toEqual(roster.body);
    expect(honeypot.body).toEqual(roster.body);
    expect(JSON.stringify(roster.body)).not.toContain(ROSTER);
    expect(JSON.stringify(unknown.body)).not.toContain('stranger');

    const users: unknown = await useContainer().dataSource.query(
      `SELECT email FROM users WHERE email IN ($1, 'stranger@example.test', 'bot@example.test')`,
      [ROSTER],
    );
    expect(JSON.stringify(users)).not.toContain(ROSTER);
    expect(JSON.stringify(users)).not.toContain('stranger@example.test');
    expect(JSON.stringify(users)).not.toContain('bot@example.test');
    const pending: unknown = await useContainer().dataSource.query(
      `SELECT email FROM pending_registrations WHERE email IN ($1, 'stranger@example.test', 'bot@example.test')`,
      [ROSTER],
    );
    expect(JSON.stringify(pending)).toContain(ROSTER);
    expect(JSON.stringify(pending)).toContain('stranger@example.test');
    expect(JSON.stringify(pending)).not.toContain('bot@example.test');
    expect(inbox().sent.some((item) => item.to === ROSTER && item.text.includes('/verify-email'))).toBe(false);
    expect(inbox().sent.some((item) => item.to === 'stranger@example.test')).toBe(false);
  });

  it('blocks sign-in until an administrator approves the trainee, then lets them in', async () => {
    const app = appFor(useContainer());
    const email = 'trainee02@example.test';
    await request(app).post('/api/v1/public/trainee-signup').send(signupBody(email)).expect(202);
    const early = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(403);
    expect(early.body).toEqual({ error: { code: 'TRAINEE_PENDING_APPROVAL', message: PENDING_APPROVAL_MESSAGE } });
    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Wrong-password-1' })
      .expect(401);
    const unknown = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody-pending@example.test', password: PASSWORD })
      .expect(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body).toEqual({ error: { code: 'unauthenticated', message: BAD_LOGIN } });
    expect(JSON.stringify(wrong.body)).not.toContain('TRAINEE_PENDING_APPROVAL');

    const admin = await signIn(app, 'admin@example.test');
    const list = await request(app).get('/api/v1/admin/pending-registrations').set('Cookie', admin.cookie).expect(200);
    const row = (list.body as Array<{ id: string; email: string }>).find((item) => item.email === email);
    if (!row) throw new Error('pending row missing');
    const approved = await request(app)
      .post(`/api/v1/admin/pending-registrations/${row.id}/approve`)
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .expect(200);
    expect(readRecord(approved.body).message).toBe(APPROVED_READY_MESSAGE);
    expect(inbox().sent.some((item) => item.to === email && item.text.includes('/verify-email'))).toBe(false);
    const verified: Array<{ email_verified_at: string | null }> = await useContainer().dataSource.query(
      `SELECT email_verified_at FROM users WHERE email = $1`,
      [email],
    );
    expect(verified[0]?.email_verified_at).toBeTruthy();

    const session = await signIn(app, email);
    const me = await request(app).get('/api/v1/portal/me').set('Cookie', session.cookie).expect(200);
    expect(readRecord(me.body).traineeId).toBeTruthy();
    await request(app).get('/api/v1/admin/trainees').set('Cookie', session.cookie).expect(403);
    await request(app).get('/api/v1/admin/pending-registrations').set('Cookie', session.cookie).expect(403);
  });

  it('lets a reset count as an active account after approval', async () => {
    const current = useContainer();
    const app = appFor(current);
    const email = 'trainee03@example.test';
    await request(app).post('/api/v1/public/trainee-signup').send(signupBody(email)).expect(202);
    await request(app).post('/api/v1/public/trainee-signup/verify').send({ token: 'missing' }).expect(422);
    const admin = await signIn(app, 'admin@example.test');
    const list = await request(app).get('/api/v1/admin/pending-registrations').set('Cookie', admin.cookie).expect(200);
    const row = (list.body as Array<{ id: string; email: string }>).find((item) => item.email === email);
    if (!row) throw new Error('pending row missing');
    await request(app)
      .post(`/api/v1/admin/pending-registrations/${row.id}/approve`)
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .expect(200);

    const reset = await request(app).post('/api/v1/auth/password-reset/request').send({ email }).expect(200);
    expect(reset.body).toMatchObject({ accepted: true });
    const resetMail = inbox().sent.filter((item) => item.to === email && item.text.includes('/portal/reset-password'));
    expect(resetMail.length).toBeGreaterThan(0);
    expect(resetMail[0]?.html).toContain('/portal/reset-password');
    const resetToken = tokenFrom(email, '/portal/reset-password');
    await request(app)
      .post('/api/v1/auth/password-reset/complete')
      .send({ token: resetToken, password: NEXT_PASSWORD, confirm: NEXT_PASSWORD })
      .expect(200);
    await request(app).post('/api/v1/auth/login').send({ email, password: NEXT_PASSWORD }).expect(200);
  });

  it('sends staff reset links to the admin page', async () => {
    const app = appFor(useContainer());
    await request(app).post('/api/v1/auth/password-reset/request').send({ email: 'editor@example.test' }).expect(200);
    const letter = inbox().sent.find((item) => item.to === 'editor@example.test');
    expect(letter?.text).toContain('/admin/reset-password?token=');
    expect(letter?.text).not.toContain('/portal/reset-password');
  });

  it('lets an administrator approve a non-roster signup and suspend the account', async () => {
    const app = appFor(useContainer());
    const email = 'newcomer@example.test';
    await request(app).post('/api/v1/public/trainee-signup').send(signupBody(email, 'New Comer')).expect(202);
    const admin = await signIn(app, 'admin@example.test');
    const editor = await signIn(app, 'editor@example.test');
    await request(app).get('/api/v1/admin/pending-registrations').set('Cookie', editor.cookie).set('X-CSRF-Token', editor.csrf).expect(403);
    const list = await request(app)
      .get('/api/v1/admin/pending-registrations')
      .set('Cookie', admin.cookie)
      .expect(200);
    const row = (list.body as Array<{ id: string; email: string }>).find((item) => item.email === email);
    if (!row) throw new Error('pending row missing');
    expect(JSON.stringify(row)).not.toContain('argon2');
    const approved = await request(app)
      .post(`/api/v1/admin/pending-registrations/${row.id}/approve`)
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .expect(200);
    expect(readRecord(approved.body).delivered).toBe(true);
    expect(readRecord(approved.body).message).toBe(APPROVED_READY_MESSAGE);
    const traineeId = String(readRecord(approved.body).traineeId);
    expect(inbox().sent.some((item) => item.to === email && item.text.includes('/verify-email'))).toBe(false);
    const session = await signIn(app, email);
    await request(app).get('/api/v1/portal/me').set('Cookie', session.cookie).expect(200);

    const accounts = await request(app)
      .get('/api/v1/admin/trainee-accounts')
      .set('Cookie', admin.cookie)
      .expect(200);
    const account = (accounts.body as Array<{ id: string; email: string; emailVerified: boolean; disabled: boolean; traineeId: string }>).find(
      (item) => item.email === email,
    );
    if (!account) throw new Error('account missing');
    expect(account.emailVerified).toBe(true);
    expect(account.disabled).toBe(false);
    expect(account.traineeId).toBe(traineeId);
    await request(app)
      .post(`/api/v1/admin/trainee-accounts/${account.id}/disable`)
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .expect(200);
    const disabled = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(403);
    expect(disabled.body).toEqual({
      error: { code: 'TRAINEE_ACCOUNT_DEACTIVATED', message: ACCOUNT_DEACTIVATED_MESSAGE },
    });
    const wrongWhileDeactivated = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Wrong-password-1' })
      .expect(401);
    const unknown = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody-else@example.test', password: PASSWORD })
      .expect(401);
    expect(wrongWhileDeactivated.body).toEqual(unknown.body);
    await request(app).get('/api/v1/auth/session').set('Cookie', session.cookie).expect(200).expect({ authenticated: false });
    await request(app)
      .post(`/api/v1/admin/trainee-accounts/${account.id}/enable`)
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .expect(200);
    await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);

    const actions: unknown = await useContainer().dataSource.query(
      `SELECT action FROM audit_events WHERE action IN ('auth.trainee.signup', 'auth.trainee.verified', 'auth.trainee.approved', 'auth.user.disabled', 'auth.user.enabled')`,
    );
    const names = JSON.stringify(actions);
    expect(names).toContain('auth.trainee.signup');
    expect(names).toContain('auth.trainee.approved');
    expect(names).toContain('auth.user.disabled');
    expect(names).toContain('auth.user.enabled');
  });

  it('tells a rejected registration apart from a wrong password', async () => {
    const app = appFor(useContainer());
    const email = 'rejected@example.test';
    await request(app).post('/api/v1/public/trainee-signup').send(signupBody(email, 'Rejected Person')).expect(202);
    const admin = await signIn(app, 'admin@example.test');
    const list = await request(app).get('/api/v1/admin/pending-registrations').set('Cookie', admin.cookie).expect(200);
    const row = (list.body as Array<{ id: string; email: string }>).find((item) => item.email === email);
    if (!row) throw new Error('pending row missing');
    await request(app)
      .post(`/api/v1/admin/pending-registrations/${row.id}/reject`)
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .expect(200);
    const rejected = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(403);
    expect(rejected.body).toEqual({
      error: { code: 'TRAINEE_REGISTRATION_REJECTED', message: REGISTRATION_REJECTED_MESSAGE },
    });
    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Wrong-password-1' })
      .expect(401);
    expect(wrong.body).toEqual({ error: { code: 'unauthenticated', message: BAD_LOGIN } });
  });

  it('marks approved trainees active and leaves administrators alone', async () => {
    const current = useContainer();
    const linkedRows: Array<{ id: string }> = await current.dataSource.query(
      `SELECT id FROM trainees t WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.trainee_id = t.id) LIMIT 1`,
    );
    const linkedId = linkedRows[0]?.id;
    if (!linkedId) throw new Error('roster row missing');
    await current.dataSource.query(
      `INSERT INTO users (email, display_name, initials, hue, role, password_hash, email_verified_at, trainee_id)
       VALUES
         ('linked-waiting@example.test', 'Linked Waiting', 'LW', 10, 'trainee', 'hash', NULL, $1),
         ('approved-waiting@example.test', 'Approved Waiting', 'AW', 11, 'trainee', 'hash', NULL, NULL),
         ('still-waiting@example.test', 'Still Waiting', 'SW', 12, 'trainee', 'hash', NULL, NULL),
         ('admin-untouched@example.test', 'Admin Untouched', 'AU', 13, 'administrator', 'hash', NULL, NULL)`,
      [linkedId],
    );
    await current.dataSource.query(
      `INSERT INTO pending_registrations (email, display_name, password_hash, status)
       VALUES ('approved-waiting@example.test', 'Approved Waiting', 'hash', 'approved')`,
    );
    const migration = new ApproveWaitingTrainees1794873600000();
    const runner = current.dataSource.createQueryRunner();
    try {
      await migration.up(runner);
    } finally {
      await runner.release();
    }
    const rows: Array<{ email: string; email_verified_at: Date | null }> = await current.dataSource.query(
      `SELECT email, email_verified_at FROM users WHERE email IN (
         'linked-waiting@example.test',
         'approved-waiting@example.test',
         'still-waiting@example.test',
         'admin-untouched@example.test'
       )`,
    );
    const byEmail = new Map(rows.map((row) => [row.email, row.email_verified_at]));
    expect(byEmail.get('linked-waiting@example.test')).toBeTruthy();
    expect(byEmail.get('approved-waiting@example.test')).toBeTruthy();
    expect(byEmail.get('still-waiting@example.test')).toBeNull();
    expect(byEmail.get('admin-untouched@example.test')).toBeNull();
    const runnerAgain = current.dataSource.createQueryRunner();
    try {
      await migration.up(runnerAgain);
    } finally {
      await runnerAgain.release();
    }
    const again: Array<{ email_verified_at: Date | null }> = await current.dataSource.query(
      `SELECT email_verified_at FROM users WHERE email = 'linked-waiting@example.test'`,
    );
    expect(again[0]?.email_verified_at?.toISOString()).toBe(byEmail.get('linked-waiting@example.test')?.toISOString());
  });

  it('locks signup after three requests for one email and five for one address', async () => {
    const app = appFor(useContainer());
    const email = 'trainee04@example.test';
    for (let index = 0; index < 3; index += 1) {
      await request(app).post('/api/v1/public/trainee-signup').send(signupBody(email)).expect(202);
    }
    await request(app).post('/api/v1/public/trainee-signup').send(signupBody(email)).expect(429);
    await useContainer().dataSource.query(`DELETE FROM login_throttles WHERE subject_key LIKE 'signup%'`);
    for (let index = 0; index < 5; index += 1) {
      await request(app)
        .post('/api/v1/public/trainee-signup')
        .send(signupBody(`rate-${index}@example.test`))
        .expect(202);
    }
    await request(app).post('/api/v1/public/trainee-signup').send(signupBody('rate-extra@example.test')).expect(429);
  });
});

function signupBody(email: string, displayName = 'Trainee Person') {
  return {
    email,
    password: PASSWORD,
    confirm: PASSWORD,
    displayName,
    acceptTerms: true,
  };
}

function useContainer(): AppContainer {
  if (!container) throw new Error('container missing');
  return container;
}

function appFor(current: AppContainer) {
  return createApp({
    env: current.env,
    logger: current.logger,
    health: current.health,
    authRouter: current.authRouter,
    curriculumRouter: current.curriculumRouter,
  });
}

function inbox(): MemoryMail {
  const mail = useContainer().mail;
  if (!(mail instanceof MemoryMail)) throw new Error('expected the memory mail adapter');
  return mail;
}

function tokenFrom(email: string, path = '/verify-email'): string {
  const letter = [...inbox().sent].reverse().find((item) => item.to === email && item.text.includes(path));
  const match = letter?.text.match(/[?&]token=([A-Za-z0-9_-]+)/);
  if (!match?.[1]) throw new Error(`no token for ${email}`);
  return match[1];
}

async function signIn(app: ReturnType<typeof appFor>, email: string, password = PASSWORD) {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
  const cookies = cookiesFrom(response);
  const session = cookies.mn_session?.value;
  const csrf = cookies.mn_csrf?.value;
  if (!session || !csrf) throw new Error('missing cookies');
  return { cookie: `mn_session=${session}; mn_csrf=${csrf}`, csrf };
}

interface SetCookie {
  value: string;
}

function cookiesFrom(response: Response): Record<string, SetCookie> {
  const cookies: Record<string, SetCookie> = {};
  const header = response.headers['set-cookie'];
  const lines = typeof header === 'string' ? [header] : Array.isArray(header) ? header : [];
  for (const line of lines) {
    const pair = line.split(';')[0] ?? '';
    const eq = pair.indexOf('=');
    if (eq < 1) continue;
    cookies[pair.slice(0, eq).trim()] = { value: decodeURIComponent(pair.slice(eq + 1).trim()) };
  }
  return cookies;
}
