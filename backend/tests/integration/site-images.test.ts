import { type Response } from 'supertest';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { AppContainer as Container, type AppContainer } from '../../src/composition/container.js';
import { PUBLIC_GET_CACHE_CONTROL } from '../../src/shared/http/cache-control.js';
import { revertOurMigrations } from '../support/migrations.js';
import { testEnv } from '../support/app-env.js';
import { readError, readRecord } from '../support/read-json.js';
import { openTestDatabase } from '../support/test-database.js';

const PASSWORD = 'Correct-horse-1';
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('site images', () => {
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
        uploadMaxBytes: 500,
      }),
    );
    await container.dataSource.runMigrations();
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

  afterAll(async () => {
    if (container?.dataSource.isInitialized) {
      await revertOurMigrations(container.dataSource);
      await container.close();
    }
    if (closeDatabase) await closeDatabase();
  });

  it('serves the bundled slots to the public and only lets an administrator change them', async () => {
    const app = appFor(useContainer());
    const listed = await request(app).get('/api/v1/public/site-images').expect(200);
    expect(listed.headers['cache-control']).toBe(PUBLIC_GET_CACHE_CONTROL);
    const rows = listed.body as unknown;
    if (!Array.isArray(rows)) throw new Error('Expected a public list.');
    expect(rows.map((item) => text(readRecord(item).key))).toContain('community-logo');
    expect(JSON.stringify(rows)).not.toContain('storageKey');
    expect(JSON.stringify(rows)).not.toContain('updatedBy');
    const logo = readRecord(rows.find((item) => readRecord(item).key === 'community-logo'));
    expect(logo.url).toBe('/assets/logo/logo-mark.svg');
    expect(logo.label).toBe('Community logo (black hat vs ethical hat)');
    const plate = readRecord(rows.find((item) => readRecord(item).key === 'foundation-logo'));
    expect(plate.url).toBe('/assets/logo/maxim-nyansa-foundation-logo.png');
    expect(plate.label).toBe('Parent organisation logo (Maxim Nyansa Foundation)');

    await request(app).get('/api/v1/public/site-images/community-logo').expect(200);
    await request(app).get('/api/v1/public/site-images/not-a-slot').expect(404);
    await request(app).get('/api/v1/admin/site-images').expect(401);

    const editor = await signIn(app, 'editor@example.test');
    const denied = await request(app)
      .get('/api/v1/admin/site-images')
      .set('Cookie', editor.cookie)
      .expect(403);
    expect(readError(denied.body).code).toBe('forbidden');

    const admin = await signIn(app, 'admin@example.test');
    const adminList = await request(app)
      .get('/api/v1/admin/site-images')
      .set('Cookie', admin.cookie)
      .expect(200);
    expect(adminList.headers['cache-control']).toBe('no-store');
    const duplicate = await request(app)
      .post('/api/v1/admin/site-images')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .send({ key: 'foundation-logo' })
      .expect(422);
    expect(field(duplicate.body, 'key')).toBe('That image slot already exists.');

    const replaced = await request(app)
      .post('/api/v1/admin/site-images/sign-in-panel/image')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .field('alt', 'A closer view of the build table')
      .attach('file', TINY_PNG, { filename: 'room.png', contentType: 'image/png' })
      .expect(200);
    const row = readRecord(replaced.body);
    expect(row.usingDefault).toBe(false);
    expect(text(row.url)).toMatch(/^\/api\/v1\/public\/uploads\//);
    expect(row.alt).toBe('A closer view of the build table');
    const file = await request(app).get(text(row.url)).expect(200);
    expect(file.headers['content-type']).toBe('image/png');

    const wrongType = await request(app)
      .post('/api/v1/admin/site-images/sign-in-panel/image')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .field('alt', 'A closer view of the build table')
      .attach('file', Buffer.from('hello'), { filename: 'room.png', contentType: 'image/png' })
      .expect(422);
    expect(field(wrongType.body, 'file')).toBe('Use a JPEG, PNG, or WebP image.');

    const patched = await request(app)
      .patch('/api/v1/admin/site-images/sign-in-panel')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .send({ alt: 'Hands at the build table' })
      .expect(200);
    expect(readRecord(patched.body).alt).toBe('Hands at the build table');

    const reset = await request(app)
      .post('/api/v1/admin/site-images/sign-in-panel/reset')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .expect(200);
    const back = readRecord(reset.body);
    expect(back.usingDefault).toBe(true);
    expect(back.url).toBe('/assets/img/electronics-lab-1600.webp');
    await request(app).get(text(row.url)).expect(404);

    const editorWrite = await request(app)
      .patch('/api/v1/admin/site-images/foundation-logo')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ alt: 'Changed' })
      .expect(403);
    expect(readError(editorWrite.body).code).toBe('forbidden');
  });

  function useContainer(): AppContainer {
    if (!container) throw new Error('The test database was not opened.');
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

function text(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('Expected text.');
  return value;
}

function field(body: unknown, name: string): unknown {
  const error = readRecord(readRecord(body).error);
  return readRecord(error.fieldErrors)[name];
}

async function signIn(app: ReturnType<typeof appFor>, email: string) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  const cookies = cookiesFrom(response);
  const session = cookies.mn_session;
  const csrf = cookies.mn_csrf;
  if (!session || !csrf) throw new Error('Sign-in did not set both cookies.');
  return { cookie: `mn_session=${session.value}; mn_csrf=${csrf.value}`, csrf: csrf.value };
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
