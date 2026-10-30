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
const TITLE = 'Labelled schedule event title';
const PLACE = 'Labelled venue for this test';
const NOTE = 'PRIVATE-EVENT-NOTE';
const SUMMARY = 'A labelled event used only by this test case.';
const SOURCE = 'https://example.test/labelled-source';
const SECRET = 's3cret-token';

describe('events', () => {
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

  it('publishes the labelled events and keeps the scheduled midpoint off the site', async () => {
    const app = appFor(useContainer());
    const response = await request(app).get('/api/v1/public/events').expect(200);
    const rows = response.body as unknown;
    if (!Array.isArray(rows)) throw new Error('Expected a public event list.');
    expect(rows.map((row) => readRecord(row).id)).toEqual([
      'start',
      'hackathon',
      'reception',
      'durbar',
      'graduation',
    ]);
    const hackathon = readRecord(rows[1]);
    expect(hackathon.dateTbc).toBe(true);
    expect(hackathon.startTime).toBe('');
    expect(hackathon.endTime).toBe('');
    expect(hackathon.place).toBe('Venue to be confirmed');
    expect(hackathon.verified).toBe(false);
    expect(hackathon.showOnAnniversary).toBe(true);
    expect(JSON.stringify(hackathon)).not.toContain('internalNotes');
    expect(JSON.stringify(hackathon)).not.toContain(NOTE);

    const missing = await request(app).get('/api/v1/public/events/midpoint').expect(404);
    expect(readError(missing.body).message).toBe('That page is not available.');
    expect(JSON.stringify(missing.body)).not.toContain('sample date');
  });

  it('lets a viewer read the admin list and refuses their edits', async () => {
    const app = appFor(useContainer());
    await request(app).get('/api/v1/admin/events').expect(401);
    const viewer = await signIn(app, 'viewer@example.test');
    const list = await request(app)
      .get('/api/v1/admin/events')
      .query({ pageSize: '20' })
      .set('Cookie', viewer.cookie)
      .expect(200);
    expect(readRecord(list.body).total).toBe(6);
    const refused = await request(app)
      .post('/api/v1/admin/events')
      .set('Cookie', viewer.cookie)
      .set('X-CSRF-Token', viewer.csrf)
      .send(eventBody())
      .expect(403);
    expect(readError(refused.body).code).toBe('forbidden');
    await request(app)
      .post('/api/v1/admin/events/bulk')
      .set('Cookie', viewer.cookie)
      .set('X-CSRF-Token', viewer.csrf)
      .send({ ids: ['start'], action: 'publish' })
      .expect(404);
  });

  it('requires the CSRF token and rejects a bad time or source', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const blocked = await request(app)
      .post('/api/v1/admin/events')
      .set('Cookie', editor.cookie)
      .send(eventBody())
      .expect(403);
    expect(readError(blocked.body).message).toBe('The security token does not match.');

    const summary = await request(app)
      .post('/api/v1/admin/events')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(eventBody({ summary: 'Too short' }))
      .expect(422);
    expect(field(summary.body, 'summary')).toBe('Use at least 20 characters.');

    const unverifiedSource = await request(app)
      .post('/api/v1/admin/events')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(eventBody({ verified: true, sourceUrl: '' }))
      .expect(422);
    expect(field(unverifiedSource.body, 'sourceUrl')).toBe(
      'Enter a full link starting with https://',
    );

    const script = await request(app)
      .post('/api/v1/admin/events')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(eventBody({ sourceUrl: 'javascript:alert(1)' }))
      .expect(422);
    expect(field(script.body, 'sourceUrl')).toBe('Enter a full link starting with https://');

    const credentials = await request(app)
      .post('/api/v1/admin/events')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(eventBody({ sourceUrl: `https://user:${SECRET}@example.test/source` }))
      .expect(422);
    expect(JSON.stringify(credentials.body)).not.toContain(SECRET);

    const times = await request(app)
      .post('/api/v1/admin/events')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(eventBody({ dateTbc: true, startTime: '17:00' }))
      .expect(422);
    expect(field(times.body, 'startTime')).toBe(
      'Leave the times blank while the date is to be confirmed.',
    );

    const order = await request(app)
      .post('/api/v1/admin/events')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(eventBody({ startTime: '20:00', endTime: '17:00' }))
      .expect(422);
    expect(field(order.body, 'endTime')).toBe('End the event after it starts.');

    const sort = await request(app)
      .get('/api/v1/admin/events')
      .query({ sort: 'password' })
      .set('Cookie', editor.cookie)
      .expect(422);
    expect(field(sort.body, 'sort')).toBe(
      'Sort by title, date, place, kind, publicationStatus, or updatedAt.',
    );
  });

  it('shows a scheduled event only after its Accra start, and keeps a hidden row private', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const past = await request(app)
      .post('/api/v1/admin/events')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(
        eventBody({
          title: 'Past scheduled event title',
          date: '2020-01-15',
          startTime: '09:00',
          endTime: '10:00',
          publicationStatus: 'scheduled',
          listing: 'public',
        }),
      )
      .expect(201);
    const pastId = text(readRecord(past.body).id);
    await request(app).get(`/api/v1/public/events/${pastId}`).expect(200);

    const future = await request(app)
      .post('/api/v1/admin/events')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(
        eventBody({
          title: 'Future scheduled event title',
          date: '2099-01-15',
          startTime: '09:00',
          publicationStatus: 'scheduled',
          listing: 'public',
        }),
      )
      .expect(201);
    const futureId = text(readRecord(future.body).id);
    const waiting = await request(app).get(`/api/v1/public/events/${futureId}`).expect(404);
    expect(readError(waiting.body).message).toBe('That page is not available.');

    const unconfirmed = await request(app)
      .post('/api/v1/admin/events')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(
        eventBody({
          title: 'Unconfirmed scheduled event title',
          date: '2020-01-15',
          dateTbc: true,
          startTime: '',
          endTime: '',
          publicationStatus: 'scheduled',
          listing: 'public',
        }),
      )
      .expect(201);
    await request(app)
      .get(`/api/v1/public/events/${text(readRecord(unconfirmed.body).id)}`)
      .expect(404);

    const hidden = await request(app)
      .post('/api/v1/admin/events')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(eventBody({ publicationStatus: 'draft', listing: 'hidden' }))
      .expect(201);
    const hiddenId = text(readRecord(hidden.body).id);
    const published = await request(app)
      .post(`/api/v1/admin/events/${hiddenId}/publish`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    expect(readRecord(published.body).publicationStatus).toBe('published');
    expect(readRecord(published.body).listing).toBe('hidden');
    await request(app).get(`/api/v1/public/events/${hiddenId}`).expect(404);

    const renamed = await request(app)
      .patch(`/api/v1/admin/events/${hiddenId}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ title: 'Renamed labelled event title' })
      .expect(200);
    expect(readRecord(readRecord(renamed.body).body).kind).toBe('placeholder');
    expect(readRecord(renamed.body).startTime).toBe('17:00');
  });

  it('filters by kind and records the change without the event text', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const anniversaries = await request(app)
      .get('/api/v1/admin/events')
      .query({ 'filters.kind': 'Anniversary', pageSize: '20' })
      .set('Cookie', editor.cookie)
      .expect(200);
    const items = readRecord(anniversaries.body).items;
    if (!Array.isArray(items)) throw new Error('Expected a page of events.');
    expect(items.every((item) => readRecord(item).kind === 'Anniversary')).toBe(true);
    expect(items.map((item) => readRecord(item).id)).toEqual(['reception', 'durbar']);

    const rows: unknown = await useContainer().dataSource.query('SELECT * FROM audit_events');
    const stored = JSON.stringify(rows);
    expect(stored).toContain('curriculum.event.created');
    expect(stored).toContain('curriculum.event.published');
    expect(stored).toContain('curriculum.event.updated');
    expect(stored).toContain('"subject_type":"event"');
    expect(stored).not.toContain(TITLE);
    expect(stored).not.toContain(PLACE);
    expect(stored).not.toContain(NOTE);
    expect(stored).not.toContain(SOURCE);
    expect(stored).not.toContain(SECRET);
    expect(stored).not.toContain(PASSWORD);
    expect(stored).not.toContain('Sample event');
    expect(stored).not.toContain('Venue to be confirmed');
  });

  it('loads the sample seed again without overwriting an event', async () => {
    const current = useContainer();
    await current.dataSource.query(`UPDATE events SET title = $1 WHERE id = 'hackathon'`, [
      'Edited sample event stays',
    ]);
    const before: unknown = await current.dataSource.query(
      `SELECT count(*)::int AS total FROM events`,
    );
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
      `SELECT title, date_tbc, start_time, end_time FROM events WHERE id = 'hackathon'`,
    );
    const text = JSON.stringify(stored);
    expect(text).toContain('Edited sample event stays');
    expect(text).toContain('"date_tbc":true');
    expect(text).toContain('"start_time":""');
    expect(text).toContain('"end_time":""');
    const after: unknown = await current.dataSource.query(
      `SELECT count(*)::int AS total FROM events`,
    );
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });

  function useContainer(): AppContainer {
    if (!container) throw new Error('The test database was not opened.');
    return container;
  }
});

function eventBody(overrides: Record<string, unknown> = {}) {
  return {
    title: TITLE,
    date: '2026-10-24',
    dateTbc: false,
    whenLabel: 'Sat 24 Oct 2026',
    place: PLACE,
    kind: 'Milestone',
    verified: true,
    sample: false,
    summary: SUMMARY,
    source: 'A labelled source note.',
    sourceUrl: SOURCE,
    showOnAnniversary: false,
    calendarDownload: false,
    startTime: '17:00',
    endTime: '18:00',
    publicationStatus: 'draft',
    listing: 'hidden',
    internalNotes: NOTE,
    ...overrides,
  };
}

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
  if (typeof value !== 'string' || value.length === 0) throw new Error('Expected an event id.');
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
