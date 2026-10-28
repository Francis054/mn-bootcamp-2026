import { type Response } from 'supertest';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSeed } from '../../src/commands/seed.js';
import { createApp } from '../../src/app.js';
import type { AppContainer } from '../../src/composition/container.js';
import { AppContainer as Container } from '../../src/composition/container.js';
import { revertOurMigrations } from '../support/migrations.js';
import { testEnv } from '../support/app-env.js';
import { readError, readRecord } from '../support/read-json.js';
import { openTestDatabase } from '../support/test-database.js';

const PASSWORD = 'Correct-horse-1';
const NOTE = 'PRIVATE-NOTE-do-not-audit';

describe('curriculum', () => {
  let container: AppContainer | undefined;
  let closeDatabase: (() => Promise<void>) | undefined;
  let databaseUrl = '';

  beforeAll(async () => {
    const database = await openTestDatabase();
    databaseUrl = database.url;
    closeDatabase = database.close;
    container = await Container.create(
      testEnv({ databaseUrl: database.url, databaseSsl: false, logLevel: 'silent' }),
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

  it('shows published sample classes and hides scheduled ones', async () => {
    const app = appFor(useContainer());
    const response = await request(app).get('/api/v1/public/classes').expect(200);
    const text = JSON.stringify(response.body);
    expect(text).toContain('"id":"1"');
    expect(text).toContain('"id":"3"');
    expect(text).not.toContain('"id":"4"');
    expect(text).not.toContain('internalNotes');
    expect(text).not.toContain('Sample fixture');

    const hidden = await request(app).get('/api/v1/public/classes/4').expect(404);
    expect(readError(hidden.body).message).toBe('That page is not available.');
    expect(JSON.stringify(hidden.body)).not.toContain('Sample fixture');

    const visible = await request(app).get('/api/v1/public/classes/1').expect(200);
    const lesson = readRecord(visible.body);
    expect(lesson.internalNotes).toBeUndefined();
    expect(lesson.phase).toBe(1);
    expect(Array.isArray(lesson.objectives)).toBe(true);
  });

  it('returns the third track and the module and phase shapes the website uses', async () => {
    const app = appFor(useContainer());
    const tracks = await request(app).get('/api/v1/public/tracks').expect(200);
    const trackText = JSON.stringify(tracks.body);
    expect(trackText).toContain('Blue team');
    expect(trackText).toContain('Red team');
    expect(trackText).toContain('GRC & Awareness');
    expect(trackText).not.toContain('GRC & awareness');

    const modules = await request(app).get('/api/v1/public/modules').expect(200);
    expect(JSON.stringify(modules.body)).toContain('"id":"network"');
    expect(JSON.stringify(modules.body)).toContain('"short":"Network"');

    const phases = await request(app).get('/api/v1/public/phases').expect(200);
    const phaseText = JSON.stringify(phases.body);
    expect(phaseText).toContain('"id":1');
    expect(phaseText).toContain('Network security');
    expect(phaseText).toContain('Ethical hacking');
  });

  it('lets a viewer read the admin list and refuses their edits', async () => {
    const current = useContainer();
    const app = appFor(current);
    await request(app).get('/api/v1/admin/classes').expect(401);
    const viewer = await signIn(app, 'viewer@example.test');
    const list = await request(app)
      .get('/api/v1/admin/classes')
      .query({ sort: 'week', dir: 'asc', pageSize: '20' })
      .set('Cookie', viewer.cookie)
      .expect(200);
    expect(readRecord(list.body).total).toBe(12);
    const refused = await request(app)
      .post('/api/v1/admin/classes')
      .set('Cookie', viewer.cookie)
      .set('X-CSRF-Token', viewer.csrf)
      .send(classBody())
      .expect(403);
    expect(readError(refused.body).code).toBe('forbidden');
  });

  it('requires the CSRF token, then lets an editor create, publish, and delete', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const blocked = await request(app)
      .post('/api/v1/admin/classes')
      .set('Cookie', editor.cookie)
      .send(classBody())
      .expect(403);
    expect(readError(blocked.body).message).toBe('The security token does not match.');

    const created = await request(app)
      .post('/api/v1/admin/classes')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(classBody())
      .expect(201);
    const lesson = readRecord(created.body);
    const id = lesson.id;
    if (typeof id !== 'string') throw new Error('The new class did not return an id.');
    expect(lesson.publicationStatus).toBe('draft');
    expect(lesson.internalNotes).toBe(NOTE);
    await request(app).get(`/api/v1/public/classes/${id}`).expect(404);

    const published = await request(app)
      .post(`/api/v1/admin/classes/${id}/publish`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    expect(readRecord(published.body).listing).toBe('hidden');
    await request(app).get(`/api/v1/public/classes/${id}`).expect(404);

    await request(app)
      .patch(`/api/v1/admin/classes/${id}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ listing: 'public' })
      .expect(200);
    await request(app).get(`/api/v1/public/classes/${id}`).expect(200);

    const removed = await request(app)
      .delete(`/api/v1/admin/classes/${id}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    expect(removed.body).toEqual({ deleted: true, id });
    await request(app).get(`/api/v1/public/classes/${id}`).expect(404);
  });

  it('lets an administrator publish and reports ids the bulk action could not find', async () => {
    const current = useContainer();
    const app = appFor(current);
    const admin = await signIn(app, 'administrator@example.test');
    const created = await request(app)
      .post('/api/v1/admin/classes')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .send({ ...classBody(), title: 'Bulk sample class one' })
      .expect(201);
    const id = readRecord(created.body).id;
    if (typeof id !== 'string') throw new Error('The new class did not return an id.');

    const bulk = await request(app)
      .post('/api/v1/admin/classes/bulk')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .send({ ids: [id, 'missing-class'], action: 'publish' })
      .expect(200);
    expect(bulk.body).toEqual({
      ok: true,
      action: 'publish',
      count: 1,
      rejected: ['missing-class'],
    });
    const stored: unknown = await current.dataSource.query(
      'SELECT publication_status, listing FROM lessons WHERE id = $1',
      [id],
    );
    expect(JSON.stringify(stored)).toContain('published');
    expect(JSON.stringify(stored)).toContain('hidden');

    await request(app)
      .post(`/api/v1/admin/classes/${id}/unpublish`)
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .expect(200);
    await request(app).get(`/api/v1/public/classes/${id}`).expect(404);
  });

  it('records the change without the class notes', async () => {
    const rows: unknown = await useContainer().dataSource.query('SELECT * FROM audit_events');
    const text = JSON.stringify(rows);
    expect(text).toContain('curriculum.lesson.created');
    expect(text).toContain('curriculum.lesson.published');
    expect(text).toContain('curriculum.lesson.deleted');
    expect(text).not.toContain(NOTE);
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain('Sample fixture');
  });

  it('refuses an unknown sort and refuses to delete a module that still has classes', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const sort = await request(app)
      .get('/api/v1/admin/classes')
      .query({ sort: 'password' })
      .set('Cookie', editor.cookie)
      .expect(422);
    expect(readError(sort.body).code).toBe('validation');

    const filtered = await request(app)
      .get('/api/v1/admin/classes')
      .query({ 'filters.moduleId': 'network', sort: 'week', dir: 'asc', pageSize: '20' })
      .set('Cookie', editor.cookie)
      .expect(200);
    expect(JSON.stringify(filtered.body)).toContain('"moduleId":"network"');
    expect(JSON.stringify(filtered.body)).not.toContain('"moduleId":"ethical"');

    const blocked = await request(app)
      .delete('/api/v1/admin/modules/network')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(422);
    expect(readError(blocked.body).message).toContain('still has classes');
  });

  it('loads the sample seed again without duplicating or overwriting', async () => {
    const current = useContainer();
    await current.dataSource.query(`UPDATE lessons SET title = $1 WHERE id = '1'`, [
      'Edited sample title stays',
    ]);
    const stdout: string[] = [];
    const code = await runSeed({
      env: { NODE_ENV: 'test', DATABASE_URL: databaseUrl },
      loadDotenv: false,
      stdout: (line) => stdout.push(line),
      stderr: (line) => {
        throw new Error(line);
      },
    });
    expect(code).toBe(0);
    // Every seed also prints the timetable import report. The last line is this seed.
    expect(stdout.at(-1)).toBe('Sample curriculum is ready.');
    const stored: unknown = await current.dataSource.query(
      `SELECT title FROM lessons WHERE id = '1'`,
    );
    expect(JSON.stringify(stored)).toContain('Edited sample title stays');
    const count: unknown = await current.dataSource.query(
      `SELECT count(*)::int AS total FROM lessons WHERE id = '1'`,
    );
    expect(JSON.stringify(count)).toContain('"total":1');
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

function classBody() {
  return {
    title: 'Packet walks in the lab',
    moduleId: 'network',
    week: 2,
    date: '2026-10-12',
    summary: 'A labelled sample class used only by this test.',
    publicationStatus: 'draft',
    listing: 'hidden',
    internalNotes: NOTE,
  };
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
