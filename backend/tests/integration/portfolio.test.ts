import request, { type Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { runSeed } from '../../src/commands/seed.js';
import type { AppContainer } from '../../src/composition/container.js';
import { AppContainer as Container } from '../../src/composition/container.js';
import { MemoryStorage } from '../../src/modules/storage/memory-storage.js';
import { testEnv } from '../support/app-env.js';
import { revertOurMigrations } from '../support/migrations.js';
import { readRecord } from '../support/read-json.js';
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
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
const YOUTUBE = 'dQw4w9WgXcQ';

let container: AppContainer | undefined;
let closeDatabase: (() => Promise<void>) | undefined;

describe('trainee portfolio items', () => {
  beforeAll(async () => {
    const database = await openTestDatabase();
    closeDatabase = database.close;
    container = await Container.create(
      testEnv({
        databaseUrl: database.url,
        databaseSsl: false,
        logLevel: 'silent',
        videoUploadMaxBytes: 64,
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
      email: 'editor.work@example.test',
      password: PASSWORD,
      role: 'editor',
      displayName: 'Work Editor',
    });
    await container.users.createUser({
      email: 'a.work@example.test',
      password: PASSWORD,
      role: 'trainee',
      displayName: 'Trainee A',
    });
    await container.users.createUser({
      email: 'b.work@example.test',
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

  it('stops one trainee from reading, changing, or deleting another trainee’s draft', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor.work@example.test');
    const idA = await createTrainee(app, editor, 'Owner A', 'owner.a@example.test');
    const idB = await createTrainee(app, editor, 'Owner B', 'owner.b@example.test');
    await link('a.work@example.test', idA);
    await link('b.work@example.test', idB);
    const traineeA = await signIn(app, 'a.work@example.test');
    const traineeB = await signIn(app, 'b.work@example.test');
    const created = await request(app)
      .post('/api/v1/portal/portfolio')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({ kind: 'project', title: 'Private draft A', summary: 'Only A can read this draft.' })
      .expect(201);
    const itemId = text(readRecord(created.body).id);
    expect(JSON.stringify(created.body)).not.toContain('storageKey');

    const listB = await request(app).get('/api/v1/portal/portfolio').set('Cookie', traineeB.cookie).expect(200);
    expect(JSON.stringify(listB.body)).not.toContain('Private draft A');
    await request(app).get(`/api/v1/portal/portfolio/${itemId}`).set('Cookie', traineeB.cookie).expect(404);
    await request(app)
      .patch(`/api/v1/portal/portfolio/${itemId}`)
      .set('Cookie', traineeB.cookie)
      .set('X-CSRF-Token', traineeB.csrf)
      .send({ title: 'Taken over' })
      .expect(404);
    await request(app)
      .delete(`/api/v1/portal/portfolio/${itemId}`)
      .set('Cookie', traineeB.cookie)
      .set('X-CSRF-Token', traineeB.csrf)
      .expect(404);
    await request(app)
      .post(`/api/v1/portal/portfolio/${itemId}/videos`)
      .set('Cookie', traineeB.cookie)
      .set('X-CSRF-Token', traineeB.csrf)
      .send({ url: `https://www.youtube.com/watch?v=${YOUTUBE}` })
      .expect(404);

    const still = await request(app)
      .get(`/api/v1/portal/portfolio/${itemId}`)
      .set('Cookie', traineeA.cookie)
      .expect(200);
    expect(readRecord(readRecord(still.body).draft).title).toBe('Private draft A');
  });

  it('checks video addresses, picture types, and video size before anything is stored', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor.work@example.test');
    const idA = await createTrainee(app, editor, 'Media A', 'media.a@example.test');
    await link('a.work@example.test', idA);
    const traineeA = await signIn(app, 'a.work@example.test');
    const created = await request(app)
      .post('/api/v1/portal/portfolio')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({ kind: 'lab', title: 'Media lab', summary: 'Pictures and a short clip.' })
      .expect(201);
    const itemId = text(readRecord(created.body).id);

    const lookalike = await request(app)
      .post(`/api/v1/portal/portfolio/${itemId}/videos`)
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({ url: `https://youtube.com.evil.com/watch?v=${YOUTUBE}` })
      .expect(422);
    expect(field(lookalike.body, 'video')).toMatch(/YouTube, Vimeo, or Loom/);
    expect(JSON.stringify(lookalike.body)).not.toContain('evil.com');

    const linked = await request(app)
      .post(`/api/v1/portal/portfolio/${itemId}/videos`)
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({ url: `https://youtu.be/${YOUTUBE}` })
      .expect(201);
    const video = asList(readRecord(readRecord(linked.body).draft).media).map((item) => readRecord(item));
    expect(video.some((item) => item.provider === 'youtube' && item.externalId === YOUTUBE)).toBe(true);
    expect(JSON.stringify(linked.body)).not.toContain('youtube.com/watch');

    const svg = await request(app)
      .post(`/api/v1/portal/portfolio/${itemId}/images`)
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .field('alt', 'Not a picture')
      .attach('file', SVG, { filename: 'icon.svg', contentType: 'image/svg+xml' })
      .expect(422);
    expect(field(svg.body, 'image')).toMatch(/JPEG, PNG, or WebP/);

    const photo = await request(app)
      .post(`/api/v1/portal/portfolio/${itemId}/images`)
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .field('alt', 'A lab screen')
      .attach('file', GPS_JPEG, { filename: 'where.jpg', contentType: 'image/jpeg' })
      .expect(201);
    expect(JSON.stringify(photo.body)).toContain('A lab screen');
    const stored = [...memoryOf(useContainer()).objects.values()];
    expect(stored.some((bytes) => bytes.includes(Buffer.from('GPSLatitude')))).toBe(false);

    const huge = await request(app)
      .post(`/api/v1/portal/portfolio/${itemId}/videos/grant`)
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({ mime: 'video/mp4', bytes: 1000 })
      .expect(422);
    expect(field(huge.body, 'video')).toMatch(/64/);

    const wrongType = await request(app)
      .post(`/api/v1/portal/portfolio/${itemId}/videos/grant`)
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({ mime: 'video/x-msvideo', bytes: 20 })
      .expect(422);
    expect(field(wrongType.body, 'video')).toMatch(/MP4/);

    const grant = await request(app)
      .post(`/api/v1/portal/portfolio/${itemId}/videos/grant`)
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({ mime: 'video/mp4', bytes: 20 })
      .expect(201);
    expect(readRecord(grant.body).mode).toBe('api');
    const grantId = text(readRecord(grant.body).grantId);

    const textFile = await request(app)
      .post(`/api/v1/portal/portfolio/${itemId}/videos/file`)
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .field('grantId', grantId)
      .attach('file', Buffer.from('not a video'), { filename: 'clip.mp4', contentType: 'video/mp4' })
      .expect(422);
    expect(field(textFile.body, 'video')).toMatch(/MP4/);

    const clip = await request(app)
      .post(`/api/v1/portal/portfolio/${itemId}/videos/file`)
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .field('grantId', grantId)
      .attach('file', ftyp('isom'), { filename: 'clip.mp4', contentType: 'application/octet-stream' })
      .expect(201);
    const media = asList(readRecord(readRecord(clip.body).draft).media).map((item) => readRecord(item));
    expect(media.some((item) => item.kind === 'video_file')).toBe(true);

    const tooBig = await request(app)
      .post(`/api/v1/portal/portfolio/${itemId}/videos/grant`)
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({ mime: 'video/webm', bytes: 8 })
      .expect(201);
    const oversized = await request(app)
      .post(`/api/v1/portal/portfolio/${itemId}/videos/file`)
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .field('grantId', text(readRecord(tooBig.body).grantId))
      .attach('file', Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(80)]), {
        filename: 'big.webm',
        contentType: 'video/webm',
      })
      .expect(422);
    expect(field(oversized.body, 'video')).toMatch(/64/);
  });

  it('keeps the last approved item public until the next approval', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor.work@example.test');
    const traineeId = await createTrainee(app, editor, 'Public A', 'public.a@example.test');
    await link('a.work@example.test', traineeId);
    const trainee = await signIn(app, 'a.work@example.test');
    await request(app)
      .put('/api/v1/portal/consents')
      .set('Cookie', trainee.cookie)
      .set('X-CSRF-Token', trainee.csrf)
      .send({ publicProfile: true, publicPhoto: true })
      .expect(200);
    await request(app)
      .patch('/api/v1/portal/profile')
      .set('Cookie', trainee.cookie)
      .set('X-CSRF-Token', trainee.csrf)
      .send({ displayName: 'Public A', headline: 'SOC analyst', bio: 'A public bio.', location: 'Accra' })
      .expect(200);
    await request(app)
      .post('/api/v1/portal/profile/submit')
      .set('Cookie', trainee.cookie)
      .set('X-CSRF-Token', trainee.csrf)
      .expect(200);
    await request(app)
      .post(`/api/v1/admin/review-queue/${traineeId}/approve`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);

    const created = await request(app)
      .post('/api/v1/portal/portfolio')
      .set('Cookie', trainee.cookie)
      .set('X-CSRF-Token', trainee.csrf)
      .send({
        kind: 'case_study',
        title: 'First case study',
        summary: 'What I learned in the lab.',
        skills: ['Wireshark', 'tcpdump'],
        completedOn: '2026-03-01',
        repositoryUrl: 'https://github.com/example/case',
      })
      .expect(201);
    const itemId = text(readRecord(created.body).id);
    await request(app)
      .post(`/api/v1/portal/portfolio/${itemId}/images`)
      .set('Cookie', trainee.cookie)
      .set('X-CSRF-Token', trainee.csrf)
      .field('alt', 'Lab notes')
      .attach('file', TINY_PNG, { filename: 'notes.png', contentType: 'image/png' })
      .expect(201);
    await request(app)
      .post(`/api/v1/portal/portfolio/${itemId}/videos`)
      .set('Cookie', trainee.cookie)
      .set('X-CSRF-Token', trainee.csrf)
      .send({ url: `https://www.youtube.com/watch?v=${YOUTUBE}` })
      .expect(201);

    const hidden = await request(app).get(`/api/v1/public/trainees/${traineeId}/portfolio`).expect(200);
    expect(hidden.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(hidden.body)).not.toContain('First case study');

    await request(app).get('/api/v1/admin/review-queue/items').set('Cookie', trainee.cookie).expect(403);
    await request(app)
      .post(`/api/v1/portal/portfolio/${itemId}/submit`)
      .set('Cookie', trainee.cookie)
      .set('X-CSRF-Token', trainee.csrf)
      .expect(200);

    const queue = await request(app)
      .get('/api/v1/admin/review-queue/items')
      .set('Cookie', editor.cookie)
      .expect(200);
    expect(JSON.stringify(queue.body)).toContain('First case study');
    expect(JSON.stringify(queue.body)).toContain(traineeId);

    await request(app)
      .patch(`/api/v1/admin/review-queue/items/${itemId}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ title: 'Approved case study' })
      .expect(200);
    await request(app)
      .post(`/api/v1/admin/review-queue/items/${itemId}/approve`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);

    const live = await request(app).get(`/api/v1/public/trainees/${traineeId}/portfolio`).expect(200);
    const published = asList(live.body).map((item) => readRecord(item));
    expect(published).toHaveLength(1);
    expect(published[0]?.title).toBe('Approved case study');
    expect(published[0]?.kind).toBe('case_study');
    expect(asList(published[0]?.skills)).toEqual(['Wireshark', 'tcpdump']);
    expect(JSON.stringify(live.body)).not.toContain('public.a@example.test');
    expect(JSON.stringify(live.body)).toContain('Lab notes');
    const media = asList(published[0]?.media).map((item) => readRecord(item));
    expect(media.some((item) => item.provider === 'youtube' && item.externalId === YOUTUBE)).toBe(true);

    await request(app)
      .patch(`/api/v1/portal/portfolio/${itemId}`)
      .set('Cookie', trainee.cookie)
      .set('X-CSRF-Token', trainee.csrf)
      .send({ title: 'Still a draft title' })
      .expect(200);
    const duringEdit = await request(app).get(`/api/v1/public/trainees/${traineeId}/portfolio`).expect(200);
    expect(JSON.stringify(duringEdit.body)).toContain('Approved case study');
    expect(JSON.stringify(duringEdit.body)).not.toContain('Still a draft title');

    await request(app)
      .post(`/api/v1/portal/portfolio/${itemId}/submit`)
      .set('Cookie', trainee.cookie)
      .set('X-CSRF-Token', trainee.csrf)
      .expect(200);
    const rejected = await request(app)
      .post(`/api/v1/admin/review-queue/items/${itemId}/reject`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ reason: 'Please name the lab environment.' })
      .expect(200);
    expect(readRecord(rejected.body).status).toBe('rejected');
    const own = await request(app).get(`/api/v1/portal/portfolio/${itemId}`).set('Cookie', trainee.cookie).expect(200);
    expect(readRecord(own.body).rejectionReason).toBe('Please name the lab environment.');
    const stillLive = await request(app).get(`/api/v1/public/trainees/${traineeId}/portfolio`).expect(200);
    expect(JSON.stringify(stillLive.body)).toContain('Approved case study');

    await request(app)
      .put('/api/v1/portal/consents')
      .set('Cookie', trainee.cookie)
      .set('X-CSRF-Token', trainee.csrf)
      .send({ publicPhoto: false })
      .expect(200);
    const withoutPhoto = await request(app).get(`/api/v1/public/trainees/${traineeId}/portfolio`).expect(200);
    const textOnly = readRecord(asList(withoutPhoto.body)[0]);
    expect(textOnly.title).toBe('Approved case study');
    expect(asList(textOnly.media)).toEqual([]);

    await request(app)
      .delete(`/api/v1/admin/review-queue/items/${itemId}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    const gone = await request(app).get(`/api/v1/public/trainees/${traineeId}/portfolio`).expect(200);
    expect(asList(gone.body)).toEqual([]);

    const audits: unknown = await useContainer().dataSource.query(
      `SELECT action FROM audit_events WHERE subject_id = $1 AND action LIKE 'portal.portfolio.%' ORDER BY created_at`,
      [itemId],
    );
    const actions = JSON.stringify(audits);
    expect(actions).toContain('portal.portfolio.admin_updated');
    expect(actions).toContain('portal.portfolio.approved');
    expect(actions).toContain('portal.portfolio.rejected');
    expect(actions).toContain('portal.portfolio.deleted');
  });
});

function ftyp(brand: string): Buffer {
  return Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from(`ftyp${brand}`), Buffer.alloc(8)]);
}

async function createTrainee(
  app: ReturnType<typeof appFor>,
  editor: Session,
  displayName: string,
  email: string,
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
      bio: 'A bio for the roster.',
      consentReceived: false,
      listing: 'hidden',
      publicationStatus: 'draft',
    })
    .expect(201);
  return text(readRecord(created.body).id);
}

async function link(email: string, traineeId: string): Promise<void> {
  await useContainer().dataSource.query(`UPDATE users SET trainee_id = $1, email_verified_at = now() WHERE email = $2`, [
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
