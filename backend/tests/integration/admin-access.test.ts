import type { Router } from 'express';
import { type Response } from 'supertest';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSeed } from '../../src/commands/seed.js';
import { createApp } from '../../src/app.js';
import type { AppContainer } from '../../src/composition/container.js';
import { AppContainer as Container } from '../../src/composition/container.js';
import { testEnv } from '../support/app-env.js';
import { revertOurMigrations } from '../support/migrations.js';
import { readError, readRecord } from '../support/read-json.js';
import { openTestDatabase } from '../support/test-database.js';

const PASSWORD = 'Correct-horse-1';
const PRIVATE_NOTE =
  'Development fixture. Do not replace with a real person without written consent.';
const ALT = 'A labelled drawing of a banner for this test.';
const ROLES = ['trainee', 'trainer', 'viewer', 'editor', 'administrator'] as const;
type TestRole = (typeof ROLES)[number];

/**
 * Risk R1: content.read used to open every admin route, including trainee
 * email, notes, and consent. Trainee and trainer sessions must get 403.
 */
let container: AppContainer | undefined;
let closeDatabase: (() => Promise<void>) | undefined;

describe('admin access by role', () => {
  beforeAll(async () => {
    const database = await openTestDatabase();
    closeDatabase = database.close;
    container = await Container.create(
      testEnv({ databaseUrl: database.url, databaseSsl: false, logLevel: 'silent' }),
    );
    await container.dataSource.runMigrations();
    for (const role of ROLES) {
      await container.users.createUser({
        email: emailFor(role),
        password: PASSWORD,
        role,
        displayName: `${role} access`,
      });
    }
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

  it('refuses a trainee session the admin trainee list and a single profile', async () => {
    const app = appFor(useContainer());
    const trainee = await signIn(app, emailFor('trainee'));
    const list = await request(app).get('/api/v1/admin/trainees').set('Cookie', trainee.cookie);
    const listText = JSON.stringify(list.body);
    expect(list.status, listText.slice(0, 800)).toBe(403);
    expect(readError(list.body).code).toBe('forbidden');
    expect(listText).not.toContain('trainee01@example.test');
    expect(listText).not.toContain(PRIVATE_NOTE);
    expect(listText).not.toContain('consentReceived');

    const one = await request(app).get('/api/v1/admin/trainees/1').set('Cookie', trainee.cookie);
    const oneText = JSON.stringify(one.body);
    expect(one.status, oneText.slice(0, 800)).toBe(403);
    expect(readError(one.body).code).toBe('forbidden');
    expect(oneText).not.toContain('trainee01@example.test');
    expect(oneText).not.toContain(PRIVATE_NOTE);
  });

  it('refuses trainee and trainer sessions on every admin route', async () => {
    const app = appFor(useContainer());
    const operations = adminOperations(useContainer().curriculumRouter);
    expect(operations).toContain('GET /api/v1/admin/trainees');
    expect(operations).toContain('GET /api/v1/admin/trainees/:id');
    expect(operations).toContain('POST /api/v1/admin/media');
    expect(operations.length).toBeGreaterThan(20);

    for (const role of ['trainee', 'trainer'] as const) {
      const session = await signIn(app, emailFor(role));
      for (const operation of operations) {
        const response = await call(app, operation, session);
        const text = JSON.stringify(response.body);
        expect(response.status, `${role} ${operation} ${text.slice(0, 300)}`).toBe(403);
        expect(readError(response.body).code).toBe('forbidden');
        expect(readError(response.body).message).toBe('You do not have access to that.');
        expect(text).not.toContain('trainee01@example.test');
        expect(text).not.toContain(PRIVATE_NOTE);
      }
    }
  }, 60_000);

  it('lets a viewer, an editor, and an administrator read private trainee records', async () => {
    const app = appFor(useContainer());
    for (const role of ['viewer', 'editor', 'administrator'] as const) {
      const session = await signIn(app, emailFor(role));
      const list = await request(app)
        .get('/api/v1/admin/trainees')
        .set('Cookie', session.cookie)
        .expect(200);
      const listText = JSON.stringify(list.body);
      expect(listText).toContain('trainee01@example.test');
      expect(listText).toContain(PRIVATE_NOTE);
      expect(listText).toContain('consentReceived');
      const one = await request(app)
        .get('/api/v1/admin/trainees/1')
        .set('Cookie', session.cookie)
        .expect(200);
      const oneText = JSON.stringify(one.body);
      expect(oneText).toContain('trainee01@example.test');
      expect(oneText).toContain(PRIVATE_NOTE);
    }
  });

  it('keeps users, settings, and password change on the staff roles that already had them', async () => {
    const app = appFor(useContainer());
    const viewer = await signIn(app, emailFor('viewer'));
    const editor = await signIn(app, emailFor('editor'));
    const administrator = await signIn(app, emailFor('administrator'));

    await request(app).get('/api/v1/admin/users').set('Cookie', viewer.cookie).expect(403);
    await request(app).get('/api/v1/admin/users').set('Cookie', editor.cookie).expect(403);
    const users = await request(app)
      .get('/api/v1/admin/users')
      .set('Cookie', administrator.cookie)
      .expect(200);
    expect(JSON.stringify(users.body)).toContain(emailFor('administrator'));

    await request(app).get('/api/v1/admin/settings').set('Cookie', editor.cookie).expect(403);
    await request(app)
      .get('/api/v1/admin/settings')
      .set('Cookie', administrator.cookie)
      .expect(200);

    for (const session of [viewer, editor, administrator]) {
      const wrong = await request(app)
        .post('/api/v1/admin/account/password')
        .set('Cookie', session.cookie)
        .set('X-CSRF-Token', session.csrf)
        .send({ current: 'Wrong-password-1', next: 'Correct-horse-2', confirm: 'Correct-horse-2' })
        .expect(422);
      expect(field(wrong.body, 'current')).toBe('The current password is not correct.');
    }
  });

  it('lets an editor and an administrator upload media and refuses everyone else', async () => {
    const app = appFor(useContainer());
    await request(app).post('/api/v1/admin/media').send({ alt: ALT }).expect(401);
    for (const role of ['trainee', 'trainer', 'viewer'] as const) {
      const session = await signIn(app, emailFor(role));
      const refused = await request(app)
        .post('/api/v1/admin/media')
        .set('Cookie', session.cookie)
        .set('X-CSRF-Token', session.csrf)
        .send({ alt: ALT })
        .expect(403);
      expect(readError(refused.body).code).toBe('forbidden');
    }
    for (const role of ['editor', 'administrator'] as const) {
      const session = await signIn(app, emailFor(role));
      const created = await request(app)
        .post('/api/v1/admin/media')
        .set('Cookie', session.cookie)
        .set('X-CSRF-Token', session.csrf)
        .send({ alt: ALT })
        .expect(201);
      expect(readRecord(created.body).alt).toBe(ALT);
      expect(readRecord(created.body).publicationStatus).toBe('draft');
    }
  });

  it('stores a new dotted audit name and can restore the old allow-list', async () => {
    const database = useContainer().dataSource;
    await expect(insertAudit(database, 'curriculum.future_kind.created')).resolves.toBeTruthy();
    await expect(insertAudit(database, 'Not An Action')).rejects.toThrow(
      /audit_events_action_check/,
    );

    await database.undoLastMigration();
    await database.undoLastMigration();
    await database.undoLastMigration();
    await database.undoLastMigration();
    try {
      const names: unknown = await database.query(
        'SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1',
      );
      expect(JSON.stringify(names)).toContain('SiteImages1794009600000');
      await expect(insertAudit(database, 'curriculum.future_kind.created')).rejects.toThrow(
        /audit_events_action_check/,
      );
      await expect(insertAudit(database, 'auth.login.succeeded')).resolves.toBeTruthy();
    } finally {
      await database.runMigrations();
    }

    await expect(insertAudit(database, 'curriculum.future_kind.created')).resolves.toBeTruthy();
    const applied: unknown = await database.query(
      'SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1',
    );
    expect(JSON.stringify(applied)).toContain('TraineePortfolio1794355200000');
  });
});

function emailFor(role: TestRole): string {
  return `${role}.access@example.test`;
}

function useContainer(): AppContainer {
  if (!container) throw new Error('The test database was not opened.');
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

async function insertAudit(database: AppContainer['dataSource'], action: string): Promise<unknown> {
  return database.query(`INSERT INTO audit_events (action) VALUES ($1) RETURNING action`, [action]);
}

interface Session {
  cookie: string;
  csrf: string;
}

async function call(
  app: ReturnType<typeof appFor>,
  operation: string,
  session: Session,
): Promise<Response> {
  const space = operation.indexOf(' ');
  const method = operation.slice(0, space);
  const url = operation.slice(space + 1).replace(/:([A-Za-z0-9_]+)/g, 'missing');
  const pending = requestFor(app, method, url).set('Cookie', session.cookie);
  if (method !== 'GET') pending.set('X-CSRF-Token', session.csrf);
  return pending;
}

function requestFor(app: ReturnType<typeof appFor>, method: string, url: string) {
  if (method === 'GET') return request(app).get(url);
  if (method === 'POST') return request(app).post(url);
  if (method === 'PUT') return request(app).put(url);
  if (method === 'PATCH') return request(app).patch(url);
  if (method === 'DELETE') return request(app).delete(url);
  throw new Error(`Unexpected method ${method}.`);
}

function adminOperations(router: Router): string[] {
  return walk(router, '/api/v1').filter((operation) => {
    const path = operation.slice(operation.indexOf(' ') + 1);
    return path === '/api/v1/admin' || path.startsWith('/api/v1/admin/');
  });
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function walk(router: Router, prefix: string): string[] {
  const found: string[] = [];
  const stack = (router as unknown as { stack: Layer[] }).stack;
  for (const layer of stack) {
    if (layer.route) {
      const path = joinPath(prefix, layer.route.path);
      for (const method of HTTP_METHODS) {
        if (layer.route.methods[method]) found.push(`${method.toUpperCase()} ${path}`);
      }
      continue;
    }
    const nested = layer.handle as { stack?: Layer[] } | undefined;
    if (nested && Array.isArray(nested.stack)) {
      found.push(...walk(nested as unknown as Router, joinPath(prefix, mountPath(layer))));
    }
  }
  return found;
}

function joinPath(prefix: string, path: string): string {
  if (path === '' || path === '/') return prefix || '/';
  const left = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  const right = path.startsWith('/') ? path : `/${path}`;
  return `${left}${right}`;
}

function mountPath(layer: Layer): string {
  if (typeof layer.path === 'string') return layer.path;
  const source = layer.regexp.source
    .replace('\\/?', '')
    .replace('(?=\\/|$)', '')
    .replace(/\\\//g, '/')
    .replace(/^\^/, '')
    .replace(/\$$/, '');
  return source.startsWith('/') ? source : '';
}

interface Layer {
  path?: string;
  regexp: RegExp;
  handle: unknown;
  route?: { path: string; methods: Record<string, boolean> };
}

async function signIn(app: ReturnType<typeof appFor>, email: string) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD })
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

function field(body: unknown, name: string): unknown {
  const error = readRecord(readRecord(body).error);
  return readRecord(error.fieldErrors)[name];
}
