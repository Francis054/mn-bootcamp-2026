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
const EMAIL = 'visible.profile@example.test';
const NAME = 'Visible Profile Label';
const NOTE = 'PRIVATE-TRAINEE-NOTE';
const LINK = 'https://profiles.example.test/private-link';
const PORTFOLIO = 'https://profiles.example.test/private-portfolio';
const BLOCK_EMAIL = 'module.block@example.test';
const BLOCK_NAME = 'Module Block Profile';
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('trainees', () => {
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

  it('keeps the labelled samples off the public site', async () => {
    const app = appFor(useContainer());
    const response = await request(app).get('/api/v1/public/trainees').expect(200);
    expect(response.body).toEqual([]);
    const missing = await request(app).get('/api/v1/public/trainees/1').expect(404);
    expect(readError(missing.body).message).toBe('That page is not available.');
    expect(JSON.stringify(missing.body)).not.toContain('trainee01@example.test');
  });

  it('lets a viewer read the admin list and refuses their edits', async () => {
    const app = appFor(useContainer());
    await request(app).get('/api/v1/admin/trainees').expect(401);
    const viewer = await signIn(app, 'viewer@example.test');
    const list = await request(app)
      .get('/api/v1/admin/trainees')
      .query({ sort: 'displayName', pageSize: '20' })
      .set('Cookie', viewer.cookie)
      .expect(200);
    expect(readRecord(list.body).total).toBe(12);
    expect(JSON.stringify(list.body)).toContain('trainee01@example.test');
    const refused = await request(app)
      .post('/api/v1/admin/trainees')
      .set('Cookie', viewer.cookie)
      .set('X-CSRF-Token', viewer.csrf)
      .send(traineeBody())
      .expect(403);
    expect(readError(refused.body).code).toBe('forbidden');
  });

  it('requires the CSRF token, then publishes only with consent', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const blocked = await request(app)
      .post('/api/v1/admin/trainees')
      .set('Cookie', editor.cookie)
      .send(traineeBody())
      .expect(403);
    expect(readError(blocked.body).message).toBe('The security token does not match.');

    const general = await request(app)
      .post('/api/v1/admin/trainees')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(traineeBody({ track: 'General' }))
      .expect(422);
    expect(field(general.body, 'track')).toBe('Choose Blue team, Red team, or GRC & Awareness.');

    const fixtureSpelling = await request(app)
      .post('/api/v1/admin/trainees')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(traineeBody({ track: 'GRC & awareness' }))
      .expect(422);
    expect(field(fixtureSpelling.body, 'track')).toBe(
      'Choose Blue team, Red team, or GRC & Awareness.',
    );

    const noConsent = await request(app)
      .post('/api/v1/admin/trainees')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(traineeBody({ consentReceived: false, email: 'draft.profile@example.test' }))
      .expect(422);
    expect(readError(noConsent.body).message).toBe(
      'Consent is required before this profile can be published.',
    );

    const created = await request(app)
      .post('/api/v1/admin/trainees')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(traineeBody({ consentReceived: false, publicationStatus: 'draft', listing: 'hidden' }))
      .expect(201);
    const draft = readRecord(created.body);
    const draftId = text(draft.id);
    expect(draft.email).toBe(EMAIL);
    expect(draft.publicationStatus).toBe('draft');
    await request(app).get(`/api/v1/public/trainees/${draftId}`).expect(404);

    const refusedPublish = await request(app)
      .post(`/api/v1/admin/trainees/${draftId}/publish`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(422);
    expect(readError(refusedPublish.body).message).toBe(
      'Consent is required before this profile can be published.',
    );

    const consented = await request(app)
      .patch(`/api/v1/admin/trainees/${draftId}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ consentReceived: true, listing: 'public' })
      .expect(200);
    expect(readRecord(consented.body).consentRecordedBy).toBe(editor.userId);
    expect(typeof readRecord(consented.body).consentReceivedAt).toBe('string');

    const published = await request(app)
      .post(`/api/v1/admin/trainees/${draftId}/publish`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    expect(readRecord(published.body).publicationStatus).toBe('published');
    expect(readRecord(published.body).listing).toBe('public');

    const visible = await request(app).get(`/api/v1/public/trainees/${draftId}`).expect(200);
    const publicText = JSON.stringify(visible.body);
    expect(publicText).toContain(NAME);
    expect(publicText).toContain('GRC & Awareness');
    expect(publicText).not.toContain(EMAIL);
    expect(publicText).not.toContain(LINK);
    expect(publicText).not.toContain(PORTFOLIO);
    expect(publicText).not.toContain(NOTE);
    expect(publicText).not.toContain('consentReceived');
    expect(publicText).not.toContain(editor.userId);

    const withdrawn = await request(app)
      .patch(`/api/v1/admin/trainees/${draftId}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ consentReceived: false, publicationStatus: 'published', listing: 'public' })
      .expect(200);
    const after = readRecord(withdrawn.body);
    expect(after.consentReceived).toBe(false);
    expect(after.publicationStatus).toBe('draft');
    expect(after.listing).toBe('public');
    expect(typeof after.consentWithdrawnAt).toBe('string');
    await request(app).get(`/api/v1/public/trainees/${draftId}`).expect(404);
  });

  it('keeps a hidden profile private after publish, and rejects a duplicate email', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const created = await request(app)
      .post('/api/v1/admin/trainees')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(
        traineeBody({
          email: 'hidden.profile@example.test',
          displayName: 'Hidden Profile Label',
          consentReceived: true,
          listing: 'hidden',
          publicationStatus: 'draft',
          linkedin: '',
          portfolio: '',
        }),
      )
      .expect(201);
    const id = text(readRecord(created.body).id);
    const published = await request(app)
      .post(`/api/v1/admin/trainees/${id}/publish`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    expect(readRecord(published.body).listing).toBe('hidden');
    expect(readRecord(published.body).publicationStatus).toBe('published');
    await request(app).get(`/api/v1/public/trainees/${id}`).expect(404);

    const duplicate = await request(app)
      .post('/api/v1/admin/trainees')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(
        traineeBody({
          email: 'Hidden.Profile@Example.Test',
          displayName: 'Another Profile Label',
          consentReceived: false,
          publicationStatus: 'draft',
        }),
      )
      .expect(422);
    expect(field(duplicate.body, 'email')).toBe('A trainee with that email already exists.');
    expect(JSON.stringify(duplicate.body)).not.toContain('hidden.profile@example.test');
  });

  it('filters by track and focus, and does not search the email', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const byTrack = await request(app)
      .get('/api/v1/admin/trainees')
      .query({ 'filters.track': 'GRC & Awareness', pageSize: '20' })
      .set('Cookie', editor.cookie)
      .expect(200);
    // The two profiles created above are also on this track, so the four samples become six.
    expect(readRecord(byTrack.body).total).toBe(6);
    expect(JSON.stringify(byTrack.body)).toContain('GRC & Awareness');
    expect(JSON.stringify(byTrack.body)).not.toContain('Blue team');

    const byFocus = await request(app)
      .get('/api/v1/admin/trainees')
      .query({ 'filters.focus': 'network', pageSize: '20' })
      .set('Cookie', editor.cookie)
      .expect(200);
    expect(readRecord(byFocus.body).total).toBe(2);

    const byEmail = await request(app)
      .get('/api/v1/admin/trainees')
      .query({ q: 'trainee01@example.test' })
      .set('Cookie', editor.cookie)
      .expect(200);
    expect(readRecord(byEmail.body).total).toBe(0);

    const byName = await request(app)
      .get('/api/v1/admin/trainees')
      .query({ q: 'Sample Trainee 01', sort: 'displayName' })
      .set('Cookie', editor.cookie)
      .expect(200);
    expect(readRecord(byName.body).total).toBe(1);

    const sort = await request(app)
      .get('/api/v1/admin/trainees')
      .query({ sort: 'password' })
      .set('Cookie', editor.cookie)
      .expect(422);
    expect(readError(sort.body).code).toBe('validation');
  });

  it('refuses to delete a module that still has a trainee profile', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    await request(app)
      .post('/api/v1/admin/modules')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({
        id: 'lab-extra',
        name: 'Extra lab module',
        short: 'Extra',
        icon: 'lab',
        summary: 'A labelled module used only to prove a trainee blocks deletion.',
      })
      .expect(201);
    const created = await request(app)
      .post('/api/v1/admin/trainees')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(
        traineeBody({
          email: BLOCK_EMAIL,
          displayName: BLOCK_NAME,
          focus: 'lab-extra',
          consentReceived: false,
          publicationStatus: 'draft',
          listing: 'hidden',
          linkedin: '',
          portfolio: '',
          internalNotes: '',
        }),
      )
      .expect(201);
    const id = text(readRecord(created.body).id);
    const blocked = await request(app)
      .delete('/api/v1/admin/modules/lab-extra')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(422);
    expect(readError(blocked.body).message).toContain('trainee profiles');
    await request(app)
      .delete(`/api/v1/admin/trainees/${id}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    await request(app).get(`/api/v1/admin/trainees/${id}`).set('Cookie', editor.cookie).expect(404);
    await request(app)
      .delete('/api/v1/admin/modules/lab-extra')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
  });

  it('records the change without the profile text', async () => {
    const rows: unknown = await useContainer().dataSource.query('SELECT * FROM audit_events');
    const text = JSON.stringify(rows);
    expect(text).toContain('curriculum.trainee.created');
    expect(text).toContain('curriculum.trainee.published');
    expect(text).toContain('curriculum.trainee.unpublished');
    expect(text).toContain('curriculum.trainee.deleted');
    expect(text).toContain('"subject_type":"trainee"');
    expect(text).not.toContain(EMAIL);
    expect(text).not.toContain(NAME);
    expect(text).not.toContain(NOTE);
    expect(text).not.toContain(LINK);
    expect(text).not.toContain(PORTFOLIO);
    expect(text).not.toContain(BLOCK_EMAIL);
    expect(text).not.toContain(BLOCK_NAME);
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain('trainee01@example.test');
    expect(text).not.toContain('Sample Trainee');
    expect(text).not.toContain('Development fixture');
  });

  it('loads the sample seed again without overwriting a profile', async () => {
    const current = useContainer();
    await current.dataSource.query(`UPDATE trainees SET display_name = $1 WHERE id = '1'`, [
      'Edited sample profile stays',
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
    expect(stdout).toEqual(['Sample curriculum is ready.']);
    const stored: unknown = await current.dataSource.query(
      `SELECT display_name FROM trainees WHERE id = '1'`,
    );
    expect(JSON.stringify(stored)).toContain('Edited sample profile stays');
    const count: unknown = await current.dataSource.query(
      `SELECT count(*)::int AS total FROM trainees`,
    );
    expect(JSON.stringify(count)).toContain('"total":14');
  });

  it('lets an editor upload a profile photo and refuses a viewer', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const viewer = await signIn(app, 'viewer@example.test');
    await useContainer().users.createUser({
      email: 'trainee.photo@example.test',
      password: PASSWORD,
      role: 'trainee',
      displayName: 'Trainee Photo',
    });
    const traineeUser = await signIn(app, 'trainee.photo@example.test');
    const created = await request(app)
      .post('/api/v1/admin/trainees')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(
        traineeBody({
          email: 'photo.profile@example.test',
          displayName: 'Photo Profile Label',
          consentReceived: true,
          listing: 'public',
          publicationStatus: 'published',
        }),
      )
      .expect(201);
    const id = text(readRecord(created.body).id);
    expect(readRecord(created.body).photoUrl).toBeNull();

    await request(app)
      .post('/api/v1/admin/trainees/photo')
      .attach('file', TINY_PNG, { filename: 'portrait.png', contentType: 'image/png' })
      .expect(401);
    await request(app)
      .post('/api/v1/admin/trainees/photo')
      .set('Cookie', viewer.cookie)
      .set('X-CSRF-Token', viewer.csrf)
      .attach('file', TINY_PNG, { filename: 'portrait.png', contentType: 'image/png' })
      .expect(403);
    await request(app)
      .post('/api/v1/admin/trainees/photo')
      .set('Cookie', traineeUser.cookie)
      .set('X-CSRF-Token', traineeUser.csrf)
      .attach('file', TINY_PNG, { filename: 'portrait.png', contentType: 'image/png' })
      .expect(403);
    await request(app)
      .post('/api/v1/admin/trainees/photo')
      .set('Cookie', editor.cookie)
      .attach('file', TINY_PNG, { filename: 'portrait.png', contentType: 'image/png' })
      .expect(403);

    const fake = await request(app)
      .post('/api/v1/admin/trainees/photo')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .attach('file', Buffer.from('not-an-image'), {
        filename: 'portrait.jpg',
        contentType: 'image/jpeg',
      })
      .expect(422);
    expect(field(fake.body, 'photoUrl')).toBe('Use a JPEG, PNG, or WebP image.');
    expect(JSON.stringify(fake.body)).not.toContain('not-an-image');
    expect(JSON.stringify(fake.body)).not.toContain('portrait.jpg');

    const uploaded = await request(app)
      .post('/api/v1/admin/trainees/photo')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .attach('file', TINY_PNG, { filename: 'real-name.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const photo = readRecord(uploaded.body);
    const photoUrl = text(photo.photoUrl);
    const key = text(photo.storageKey);
    expect(photoUrl).toBe(`/api/v1/public/uploads/${key}`);
    expect(JSON.stringify(photo)).not.toContain('real-name');
    const memory = memoryOf(useContainer());
    expect(memory.objects.has(key)).toBe(true);

    const image = await request(app).get(photoUrl).expect(200);
    expect(image.headers['content-type']).toBe('image/png');
    expect(Buffer.isBuffer(image.body)).toBe(true);

    const mismatched = await request(app)
      .patch(`/api/v1/admin/trainees/${id}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ photoUrl, photoStorageKey: '22222222-2222-2222-2222-222222222222' })
      .expect(422);
    expect(field(mismatched.body, 'photoUrl')).toBe('Use a JPEG, PNG, or WebP image.');

    const saved = await request(app)
      .patch(`/api/v1/admin/trainees/${id}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ photoUrl, photoStorageKey: key })
      .expect(200);
    expect(readRecord(saved.body).photoUrl).toBe(photoUrl);
    expect(readRecord(saved.body).photoStorageKey).toBe(key);

    const visible = await request(app).get(`/api/v1/public/trainees/${id}`).expect(200);
    const shown = readRecord(visible.body);
    expect(shown.photoUrl).toBe(photoUrl);
    expect(shown.displayName).toBe('Photo Profile Label');
    expect(shown).not.toHaveProperty('photoStorageKey');
    expect(shown).not.toHaveProperty('email');

    const replacement = await request(app)
      .post('/api/v1/admin/trainees/photo')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .attach('file', TINY_PNG, { filename: 'next.png', contentType: 'image/png' })
      .expect(201);
    const next = readRecord(replacement.body);
    const nextKey = text(next.storageKey);
    await request(app)
      .patch(`/api/v1/admin/trainees/${id}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ photoUrl: next.photoUrl, photoStorageKey: nextKey })
      .expect(200);
    expect(memory.objects.has(key)).toBe(false);
    expect(memory.objects.has(nextKey)).toBe(true);

    const cleared = await request(app)
      .patch(`/api/v1/admin/trainees/${id}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ photoUrl: null })
      .expect(200);
    expect(readRecord(cleared.body).photoUrl).toBeNull();
    expect(readRecord(cleared.body).photoStorageKey).toBeNull();
    expect(memory.objects.has(nextKey)).toBe(false);
    await request(app).get(text(next.photoUrl)).expect(404);

    const hidden = await request(app).get(`/api/v1/public/trainees/${id}`).expect(200);
    expect(readRecord(hidden.body).photoUrl).toBeNull();
  });

  function useContainer(): AppContainer {
    if (!container) throw new Error('The test database was not opened.');
    return container;
  }
});

function traineeBody(overrides: Record<string, unknown> = {}) {
  return {
    displayName: NAME,
    email: EMAIL,
    track: 'GRC & Awareness',
    focus: 'awareness',
    skills: ['Policy writing'],
    bio: 'A labelled profile used only by this test.',
    quote: 'A labelled quote.',
    linkedin: LINK,
    portfolio: PORTFOLIO,
    consentReceived: true,
    listing: 'public',
    publicationStatus: 'published',
    statusLabel: 'In training',
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

function memoryOf(container: AppContainer): MemoryStorage {
  if (!(container.storage instanceof MemoryStorage)) {
    throw new Error('The test provider is not the in-memory store.');
  }
  return container.storage;
}

function text(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Expected a trainee id.');
  }
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
