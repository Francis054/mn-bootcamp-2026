import { type Response } from 'supertest';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { AppContainer } from '../../src/composition/container.js';
import { AppContainer as Container } from '../../src/composition/container.js';
import { MemoryStorage } from '../../src/modules/storage/memory-storage.js';
import { revertOurMigrations } from '../support/migrations.js';
import { testEnv } from '../support/app-env.js';
import { readError, readRecord } from '../support/read-json.js';
import { openTestDatabase } from '../support/test-database.js';

const PASSWORD = 'Correct-horse-1';
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('about people', () => {
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
    await container.users.createUser({
      email: 'viewer@example.test',
      password: PASSWORD,
      role: 'viewer',
      displayName: 'Vera Viewer',
    });
  });

  afterAll(async () => {
    if (container?.dataSource.isInitialized) {
      await revertOurMigrations(container.dataSource);
      await container.close();
    }
    if (closeDatabase) await closeDatabase();
  });

  it('lets an editor publish a person with an optional description and keeps a viewer from writing', async () => {
    const app = appFor(useContainer());
    await request(app).get('/api/v1/public/about-people').expect(200).expect([]);
    await request(app)
      .post('/api/v1/admin/about-people')
      .send({ group: 'founder', name: 'Kwame' })
      .expect(401);

    const viewer = await signIn(app, 'viewer@example.test');
    await request(app).get('/api/v1/admin/about-people').set('Cookie', viewer.cookie).expect(200);
    const viewerDenied = await request(app)
      .post('/api/v1/admin/about-people')
      .set('Cookie', viewer.cookie)
      .set('X-CSRF-Token', viewer.csrf)
      .send({ group: 'founder', name: 'Kwame Mensah' })
      .expect(403);
    expect(readError(viewerDenied.body).code).toBe('forbidden');

    const editor = await signIn(app, 'editor@example.test');
    const blocked = await request(app)
      .post('/api/v1/admin/about-people')
      .set('Cookie', editor.cookie)
      .send({ group: 'founder', name: 'Kwame Mensah' })
      .expect(403);
    expect(readError(blocked.body).message).toBe('The security token does not match.');

    const missing = await request(app)
      .post('/api/v1/admin/about-people')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ group: 'partner', title: 'Advisor' })
      .expect(422);
    expect(field(missing.body, 'name')).toBe('Enter a name.');

    const created = await request(app)
      .post('/api/v1/admin/about-people')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ group: 'partner', name: 'Ama Boateng' })
      .expect(201);
    const row = readRecord(created.body);
    expect(row.published).toBe(false);
    expect(row.description).toBe('');
    expect(row.group).toBe('partner');
    expect(row.photoUrl).toBeNull();
    expect(row).not.toHaveProperty('photoStorageKey');
    const id = text(row.id);

    await request(app).get('/api/v1/public/about-people').expect(200).expect([]);

    const published = await request(app)
      .patch(`/api/v1/admin/about-people/${id}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ published: true, description: '' })
      .expect(200);
    expect(readRecord(published.body).published).toBe(true);

    const listed = await request(app).get('/api/v1/public/about-people').expect(200);
    expect(listed.headers['cache-control']).toBe('private, no-store');
    const publicRows = listed.body as unknown;
    if (!Array.isArray(publicRows)) throw new Error('Expected a public list.');
    expect(publicRows.map((item) => text(readRecord(item).name))).toEqual(['Ama Boateng']);
    expect(JSON.stringify(publicRows)).not.toContain('photoStorageKey');
    expect(JSON.stringify(publicRows)).not.toContain('published');

    const uploaded = await request(app)
      .post(`/api/v1/admin/about-people/${id}/photo`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .attach('file', TINY_PNG, { filename: 'portrait.png', contentType: 'image/png' })
      .expect(200);
    expect(text(readRecord(uploaded.body).photoUrl)).toMatch(/^\/api\/v1\/public\/uploads\//);
    expect(memoryOf(useContainer()).objects.size).toBe(1);

    const wrongType = await request(app)
      .post(`/api/v1/admin/about-people/${id}/photo`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .attach('file', Buffer.from('this is a text file'), {
        filename: 'notes.png',
        contentType: 'image/png',
      })
      .expect(422);
    expect(field(wrongType.body, 'file')).toBe('Use a JPEG, PNG, or WebP image.');

    const tooBig = await request(app)
      .post(`/api/v1/admin/about-people/${id}/photo`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .attach('file', Buffer.alloc(600, 1), { filename: 'big.png', contentType: 'image/png' })
      .expect(422);
    expect(field(tooBig.body, 'file')).toBe('Use an image of at most 500 bytes.');

    await request(app)
      .delete(`/api/v1/admin/about-people/${id}/photo`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    expect(memoryOf(useContainer()).objects.size).toBe(0);

    await request(app)
      .post(`/api/v1/admin/about-people/${id}/photo`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .attach('file', TINY_PNG, { filename: 'portrait.png', contentType: 'image/png' })
      .expect(200);

    const removed = await request(app)
      .delete(`/api/v1/admin/about-people/${id}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    expect(readRecord(removed.body)).toEqual({ deleted: true, id });
    expect(memoryOf(useContainer()).objects.size).toBe(0);
    await request(app).get('/api/v1/public/about-people').expect(200).expect([]);
  });

  it('orders founder, then team, then partners', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const partner = await createPerson(app, editor, {
      group: 'partner',
      name: 'Partner One',
      published: true,
    });
    const team = await createPerson(app, editor, {
      group: 'team',
      name: 'Team One',
      published: true,
    });
    await createPerson(app, editor, { group: 'founder', name: 'Founder One', published: true });
    const listed = await request(app).get('/api/v1/public/about-people').expect(200);
    const names = (listed.body as unknown[]).map((item) => text(readRecord(item).group));
    expect(names).toEqual(['founder', 'team', 'partner']);

    const reordered = await request(app)
      .post('/api/v1/admin/about-people/reorder')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ group: 'team', ids: [team] })
      .expect(200);
    expect(Array.isArray(reordered.body)).toBe(true);

    await request(app)
      .delete(`/api/v1/admin/about-people/${partner}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    await request(app)
      .delete(`/api/v1/admin/about-people/${team}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    const founderId = text(readRecord((listed.body as unknown[])[0]).id);
    await request(app)
      .delete(`/api/v1/admin/about-people/${founderId}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
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

function memoryOf(container: AppContainer): MemoryStorage {
  if (!(container.storage instanceof MemoryStorage)) {
    throw new Error('The test provider is not the in-memory store.');
  }
  return container.storage;
}

async function createPerson(
  app: ReturnType<typeof appFor>,
  editor: { cookie: string; csrf: string },
  body: { group: string; name: string; published: boolean },
): Promise<string> {
  const response = await request(app)
    .post('/api/v1/admin/about-people')
    .set('Cookie', editor.cookie)
    .set('X-CSRF-Token', editor.csrf)
    .send(body)
    .expect(201);
  return text(readRecord(response.body).id);
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
