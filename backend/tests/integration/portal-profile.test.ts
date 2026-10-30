import request, { type Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { runSeed } from '../../src/commands/seed.js';
import type { AppContainer } from '../../src/composition/container.js';
import { AppContainer as Container } from '../../src/composition/container.js';
import { CONSENT_POLICY_VERSION } from '../../src/modules/trainees/consent-policy.js';
import { MemoryStorage } from '../../src/modules/storage/memory-storage.js';
import { testEnv } from '../support/app-env.js';
import { revertOurMigrations } from '../support/migrations.js';
import { readError, readRecord } from '../support/read-json.js';
import { openTestDatabase } from '../support/test-database.js';

const PASSWORD = 'Correct-horse-1';
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const GPS_JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x12]),
  Buffer.from('EXIF\0GPSLatitude', 'ascii'),
  Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9]),
]);

let container: AppContainer | undefined;
let closeDatabase: (() => Promise<void>) | undefined;

describe('trainee profile, consent, and review', () => {
  beforeAll(async () => {
    const database = await openTestDatabase();
    closeDatabase = database.close;
    container = await Container.create(
      testEnv({ databaseUrl: database.url, databaseSsl: false, logLevel: 'silent' }),
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
      email: 'editor.profile@example.test',
      password: PASSWORD,
      role: 'editor',
      displayName: 'Profile Editor',
    });
    await container.users.createUser({
      email: 'a.portal@example.test',
      password: PASSWORD,
      role: 'trainee',
      displayName: 'Trainee A',
    });
    await container.users.createUser({
      email: 'b.portal@example.test',
      password: PASSWORD,
      role: 'trainee',
      displayName: 'Trainee B',
    });
  });

  afterAll(async () => {
    if (container?.dataSource.isInitialized) {
      await revertOurMigrations(container.dataSource);
      await container.close();
    }
    if (closeDatabase) await closeDatabase();
  });

  it('keeps each trainee on their own profile and the last approved version public', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor.profile@example.test');
    const idA = await createTrainee(app, editor, 'Trainee A Live', 'a.live@example.test', 'Original bio for A');
    const idB = await createTrainee(app, editor, 'Trainee B Live', 'b.live@example.test', 'Original bio for B');
    await link('a.portal@example.test', idA);
    await link('b.portal@example.test', idB);
    const traineeA = await signIn(app, 'a.portal@example.test');
    const traineeB = await signIn(app, 'b.portal@example.test');

    const own = await request(app).get('/api/v1/portal/profile').set('Cookie', traineeA.cookie).expect(200);
    expect(readRecord(own.body).traineeId).toBe(idA);
    expect(JSON.stringify(own.body)).not.toContain('Original bio for B');
    expect(JSON.stringify(own.body)).not.toContain('b.live@example.test');

    const missing = await request(app)
      .get(`/api/v1/portal/trainees/${idB}`)
      .set('Cookie', traineeA.cookie);
    expect(missing.status).toBe(404);

    const hijack = await request(app)
      .patch('/api/v1/portal/profile')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({
        traineeId: idB,
        displayName: 'Hijacked',
        headline: 'SOC analyst',
        bio: 'First approved bio',
        location: 'Accra',
        linkedin: 'https://www.linkedin.com/in/trainee-a',
        githubUrl: 'https://github.com/trainee-a',
        portfolio: 'https://trainee-a.example',
      })
      .expect(200);
    expect(readRecord(hijack.body).traineeId).toBe(idA);
    expect(readRecord(readRecord(hijack.body).draft).displayName).toBe('Hijacked');
    const other = await request(app).get('/api/v1/portal/profile').set('Cookie', traineeB.cookie).expect(200);
    expect(readRecord(readRecord(other.body).draft).displayName).toBe('Trainee B Live');
    expect(readRecord(readRecord(other.body).live).bio).toBe('Original bio for B');

    const badLink = await request(app)
      .patch('/api/v1/portal/profile')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({ linkedin: 'https://evil.example/in/trainee-a', githubUrl: 'https://gist.github.com/trainee-a' })
      .expect(422);
    expect(field(badLink.body, 'linkedin')).toContain('linkedin.com');
    expect(field(badLink.body, 'githubUrl')).toContain('github.com');

    const early = await request(app)
      .post('/api/v1/portal/profile/submit')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .expect(422);
    expect(readError(early.body).message).toContain('public profile');

    await request(app)
      .put('/api/v1/portal/consents')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({ publicProfile: true, publicPhoto: false, contactRelay: true })
      .expect(200);
    const ledger: unknown = await useContainer().dataSource.query(
      `SELECT scope, granted, policy_version, wording, created_at FROM trainee_consents WHERE trainee_id = $1 ORDER BY scope`,
      [idA],
    );
    const ledgerText = JSON.stringify(ledger);
    expect(ledgerText).toContain(CONSENT_POLICY_VERSION);
    expect(ledgerText).toContain('public_profile');
    expect(ledgerText).toContain('public_photo');
    expect(ledgerText).toContain('contact_relay');
    expect(ledgerText).toContain('administrator approves');

    await request(app).get(`/api/v1/public/trainees/${idA}`).expect(404);
    await request(app)
      .post('/api/v1/portal/profile/submit')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .expect(200);

    const queue = await request(app)
      .get('/api/v1/admin/review-queue')
      .set('Cookie', editor.cookie)
      .expect(200);
    const queued = asList(queue.body).map((item) => readRecord(item));
    expect(queued.some((item) => item.traineeId === idA)).toBe(true);
    expect(queued.some((item) => item.traineeId === idB)).toBe(false);
    await request(app).get('/api/v1/admin/review-queue').set('Cookie', traineeA.cookie).expect(403);

    await request(app)
      .post(`/api/v1/admin/review-queue/${idA}/approve`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    const firstPublic = await request(app).get(`/api/v1/public/trainees/${idA}`).expect(200);
    expect(readRecord(firstPublic.body).bio).toBe('First approved bio');
    expect(readRecord(firstPublic.body).headline).toBe('SOC analyst');
    expect(readRecord(firstPublic.body).linkedin).toBe('https://www.linkedin.com/in/trainee-a');
    expect(readRecord(firstPublic.body).githubUrl).toBe('https://github.com/trainee-a');
    expect(JSON.stringify(firstPublic.body)).not.toContain('a.live@example.test');
    expect(readRecord(firstPublic.body).photoUrl).toBeNull();

    await request(app)
      .patch('/api/v1/portal/profile')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({ bio: 'Second bio waiting' })
      .expect(200);
    await request(app)
      .post('/api/v1/portal/profile/submit')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .expect(200);
    const stillFirst = await request(app).get(`/api/v1/public/trainees/${idA}`).expect(200);
    expect(readRecord(stillFirst.body).bio).toBe('First approved bio');

    const rejected = await request(app)
      .post(`/api/v1/admin/review-queue/${idA}/reject`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ reason: 'Please remove the client name.' })
      .expect(200);
    expect(readRecord(rejected.body).status).toBe('rejected');
    const afterReject = await request(app).get('/api/v1/portal/profile').set('Cookie', traineeA.cookie).expect(200);
    expect(readRecord(afterReject.body).status).toBe('rejected');
    expect(readRecord(afterReject.body).rejectionReason).toBe('Please remove the client name.');
    expect(readRecord(readRecord(afterReject.body).live).bio).toBe('First approved bio');

    await request(app)
      .patch('/api/v1/portal/profile')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({ bio: 'Third bio' })
      .expect(200);
    await request(app)
      .post('/api/v1/portal/profile/submit')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .expect(200);
    await request(app)
      .post(`/api/v1/admin/review-queue/${idA}/approve`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    const third = await request(app).get(`/api/v1/public/trainees/${idA}`).expect(200);
    expect(readRecord(third.body).bio).toBe('Third bio');

    const svg = await request(app)
      .post('/api/v1/portal/profile/photo')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), {
        filename: 'face.svg',
        contentType: 'image/svg+xml',
      })
      .expect(422);
    expect(field(svg.body, 'photoUrl')).toBe('Use a JPEG, PNG, or WebP image.');

    const uploaded = await request(app)
      .post('/api/v1/portal/profile/photo')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .attach('file', GPS_JPEG, { filename: 'face.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const draftPhoto = text(readRecord(readRecord(uploaded.body).draft).photoUrl);
    expect(JSON.stringify(uploaded.body)).not.toContain(idB);
    const key = draftPhoto.split('/').pop() ?? '';
    const stored = memoryOf(useContainer()).objects.get(key);
    expect(stored).toBeTruthy();
    expect(stored?.toString('ascii')).not.toContain('GPSLatitude');
    const untouched = await request(app).get('/api/v1/portal/profile').set('Cookie', traineeB.cookie).expect(200);
    expect(readRecord(readRecord(untouched.body).draft).photoUrl).toBeNull();

    await request(app)
      .post('/api/v1/portal/profile/submit')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .expect(200);
    await request(app)
      .post(`/api/v1/admin/review-queue/${idA}/approve`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    const hiddenPhoto = await request(app).get(`/api/v1/public/trainees/${idA}`).expect(200);
    expect(readRecord(hiddenPhoto.body).photoUrl).toBeNull();

    await request(app)
      .put('/api/v1/portal/consents')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({ publicPhoto: true })
      .expect(200);
    const shownPhoto = await request(app).get(`/api/v1/public/trainees/${idA}`).expect(200);
    expect(readRecord(shownPhoto.body).photoUrl).toBe(draftPhoto);

    await request(app)
      .put('/api/v1/portal/consents')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({ publicProfile: false })
      .expect(200);
    await request(app).get(`/api/v1/public/trainees/${idA}`).expect(404);

    const audits: unknown = await useContainer().dataSource.query(
      `SELECT action, subject_id FROM audit_events WHERE subject_id = $1 AND action LIKE 'portal.%'`,
      [idA],
    );
    const actions = asList(audits).map((row) => String(readRecord(row).action));
    expect(actions).toContain('portal.profile.approved');
    expect(actions).toContain('portal.profile.rejected');
    expect(actions).toContain('portal.photo.changed');
    expect(actions).toContain('portal.consent.changed');

    await request(app)
      .patch(`/api/v1/admin/trainees/${idB}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ bio: 'Editor wrote this bio', headline: 'Blue team trainee' })
      .expect(200);
    const adminAudits: unknown = await useContainer().dataSource.query(
      `SELECT action FROM audit_events WHERE subject_id = $1 AND action = 'portal.profile.admin_updated'`,
      [idB],
    );
    expect(JSON.stringify(adminAudits)).toContain('portal.profile.admin_updated');
    const replaced = await request(app)
      .post('/api/v1/admin/trainees/photo')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .attach('file', TINY_PNG, { filename: 'admin.png', contentType: 'image/png' })
      .expect(201);
    await request(app)
      .patch(`/api/v1/admin/trainees/${idB}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({
        photoUrl: readRecord(replaced.body).photoUrl,
        photoStorageKey: readRecord(replaced.body).storageKey,
      })
      .expect(200);
    const photoAudits: unknown = await useContainer().dataSource.query(
      `SELECT action FROM audit_events WHERE subject_id = $1 AND action = 'portal.photo.changed'`,
      [idB],
    );
    expect(JSON.stringify(photoAudits)).toContain('portal.photo.changed');
  });
});

async function createTrainee(
  app: ReturnType<typeof appFor>,
  editor: Session,
  displayName: string,
  email: string,
  bio: string,
): Promise<string> {
  const created = await request(app)
    .post('/api/v1/admin/trainees')
    .set('Cookie', editor.cookie)
    .set('X-CSRF-Token', editor.csrf)
    .send({
      displayName,
      email,
      track: 'Blue team',
      focus: 'network',
      bio,
      consentReceived: false,
      listing: 'hidden',
      publicationStatus: 'draft',
    })
    .expect(201);
  return text(readRecord(created.body).id);
}

async function link(email: string, traineeId: string): Promise<void> {
  await useContainer().dataSource.query(`UPDATE users SET trainee_id = $1 WHERE email = $2`, [
    traineeId,
    email,
  ]);
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

function memoryOf(current: AppContainer): MemoryStorage {
  if (!(current.storage instanceof MemoryStorage)) throw new Error('Expected memory storage.');
  return current.storage;
}

interface Session {
  cookie: string;
  csrf: string;
}

async function signIn(app: ReturnType<typeof appFor>, email: string): Promise<Session> {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
  const cookies = cookiesFrom(response);
  const session = cookies.mn_session;
  const csrf = cookies.mn_csrf;
  if (!session || !csrf) throw new Error('Sign-in did not set both cookies.');
  return { cookie: `mn_session=${session.value}; mn_csrf=${csrf.value}`, csrf: csrf.value };
}

function cookiesFrom(response: Response): Record<string, { value: string }> {
  const cookies: Record<string, { value: string }> = {};
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

function text(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('Expected text.');
  return value;
}

function field(body: unknown, name: string): string {
  const value = readRecord(readRecord(readRecord(body).error).fieldErrors)[name];
  if (typeof value !== 'string') throw new Error(`Missing field ${name}.`);
  return value;
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
