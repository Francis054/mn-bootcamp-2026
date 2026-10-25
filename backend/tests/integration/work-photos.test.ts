import { type Response } from 'supertest';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSeed } from '../../src/commands/seed.js';
import { createApp } from '../../src/app.js';
import type { AppContainer } from '../../src/composition/container.js';
import { AppContainer as Container } from '../../src/composition/container.js';
import { MemoryStorage } from '../../src/modules/storage/memory-storage.js';
import { revertOurMigrations } from '../support/migrations.js';
import { testEnv } from '../support/app-env.js';
import { readError, readRecord } from '../support/read-json.js';
import { openTestDatabase } from '../support/test-database.js';

const PASSWORD = 'Correct-horse-1';
const ALT = 'Hands on a laptop during a labelled lab exercise.';
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('work photos', () => {
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
      email: 'trainee.user@example.test',
      password: PASSWORD,
      role: 'trainee',
      displayName: 'Terry Trainee',
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

  it('refuses anyone except an administrator', async () => {
    const app = appFor(useContainer());
    await request(app).get('/api/v1/admin/work-photos').expect(401);
    await request(app).get('/api/v1/public/work-photos').expect(200).expect([]);

    const editor = await signIn(app, 'editor@example.test');
    const editorDenied = await request(app)
      .post('/api/v1/admin/work-photos')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(403);
    expect(readError(editorDenied.body).code).toBe('forbidden');

    const trainee = await signIn(app, 'trainee.user@example.test');
    await request(app).get('/api/v1/admin/work-photos').set('Cookie', trainee.cookie).expect(403);
  });

  it('stores a JPEG, PNG, or WebP, and publishes it only for an administrator', async () => {
    const app = appFor(useContainer());
    const admin = await signIn(app, 'admin@example.test');
    const blocked = await request(app)
      .post('/api/v1/admin/work-photos')
      .set('Cookie', admin.cookie)
      .field('traineeId', '1')
      .field('alt', ALT)
      .attach('file', TINY_PNG, { filename: 'notes.png', contentType: 'image/png' })
      .expect(403);
    expect(readError(blocked.body).message).toBe('The security token does not match.');

    const created = await request(app)
      .post('/api/v1/admin/work-photos')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .field('traineeId', '1')
      .field('projectId', '1')
      .field('alt', ALT)
      .field('caption', 'Working through the lab.')
      .attach('file', TINY_PNG, { filename: 'notes.png', contentType: 'image/png' })
      .expect(201);
    const row = readRecord(created.body);
    expect(row.publicationStatus).toBe('draft');
    expect(row.listing).toBe('hidden');
    expect(row.traineeId).toBe('1');
    expect(row.projectId).toBe('1');
    expect(text(row.src).startsWith('memory:')).toBe(true);
    expect(row).not.toHaveProperty('storageKey');
    const id = text(row.id);

    await request(app).get(`/api/v1/public/work-photos/${id}/file`).expect(404);
    const preview = await request(app)
      .get(`/api/v1/admin/work-photos/${id}/file`)
      .set('Cookie', admin.cookie)
      .expect(200);
    expect(preview.headers['content-type']).toBe('image/png');

    const wrongType = await request(app)
      .post('/api/v1/admin/work-photos')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .field('traineeId', '1')
      .field('alt', ALT)
      .attach('file', Buffer.from('this is a text file'), {
        filename: 'notes.png',
        contentType: 'image/png',
      })
      .expect(422);
    expect(field(wrongType.body, 'file')).toBe('Use a JPEG, PNG, or WebP image.');

    const tooBig = await request(app)
      .post('/api/v1/admin/work-photos')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .field('traineeId', '1')
      .field('alt', ALT)
      .attach('file', Buffer.alloc(600, 1), { filename: 'big.png', contentType: 'image/png' })
      .expect(422);
    expect(field(tooBig.body, 'file')).toBe('Use an image of at most 500 bytes.');

    const wrongProject = await request(app)
      .post('/api/v1/admin/work-photos')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .field('traineeId', '2')
      .field('projectId', '1')
      .field('alt', ALT)
      .attach('file', TINY_PNG, { filename: 'photo.png', contentType: 'image/png' })
      .expect(422);
    expect(field(wrongProject.body, 'projectId')).toBe('Choose a project this trainee is on.');

    const published = await request(app)
      .post(`/api/v1/admin/work-photos/${id}/publish`)
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .expect(200);
    expect(readRecord(published.body).publicationStatus).toBe('published');
    expect(readRecord(published.body).listing).toBe('public');

    const listed = await request(app)
      .get('/api/v1/public/work-photos')
      .query({ traineeId: '1', projectId: '1' })
      .expect(200);
    expect(listed.headers['cache-control']).toBe('private, no-store');
    const publicRows = listed.body as unknown;
    if (!Array.isArray(publicRows)) throw new Error('Expected a public list.');
    expect(publicRows.map((item) => text(readRecord(item).id))).toContain(id);
    expect(JSON.stringify(publicRows)).not.toContain('storageKey');
    expect(JSON.stringify(publicRows)).not.toContain('uploadedBy');
    await request(app).get(`/api/v1/public/work-photos/${id}/file`).expect(200);

    const other = await request(app)
      .get('/api/v1/public/work-photos')
      .query({ traineeId: '2' })
      .expect(200);
    expect(other.body).toEqual([]);

    await request(app)
      .post(`/api/v1/admin/work-photos/${id}/unpublish`)
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .expect(200);
    const after = await request(app)
      .get('/api/v1/public/work-photos')
      .query({ traineeId: '1' })
      .expect(200);
    expect(after.body).toEqual([]);

    const removed = await request(app)
      .delete(`/api/v1/admin/work-photos/${id}`)
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .expect(200);
    expect(readRecord(removed.body)).toEqual({ deleted: true, id });
    const storage = memoryOf(useContainer());
    expect(storage.objects.size).toBe(0);
    await request(app).get(`/api/v1/public/work-photos/${id}/file`).expect(404);
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
