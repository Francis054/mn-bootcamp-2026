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
const GPS_JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x12]),
  Buffer.from('EXIF\0GPSLatitude', 'ascii'),
  Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9]),
]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

let container: AppContainer | undefined;
let closeDatabase: (() => Promise<void>) | undefined;

describe('trainee skills and events', () => {
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
    await container.users.createUser({ email: 'editor.progress@example.test', password: PASSWORD, role: 'editor', displayName: 'Progress Editor' });
    await container.users.createUser({ email: 'a.progress@example.test', password: PASSWORD, role: 'trainee', displayName: 'Trainee A' });
    await container.users.createUser({ email: 'b.progress@example.test', password: PASSWORD, role: 'trainee', displayName: 'Trainee B' });
    await container.users.createUser({ email: 'trainer.progress@example.test', password: PASSWORD, role: 'trainer', displayName: 'Progress Trainer' });
  });

  afterAll(async () => {
    if (container?.dataSource.isInitialized) {
      await revertOurMigrations(container.dataSource);
      await container.close();
    }
    if (closeDatabase) await closeDatabase();
  });

  it('stops one trainee from reading or changing another trainee’s skills or events', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor.progress@example.test');
    const idA = await createTrainee(app, editor, 'Skill Owner A', 'skill.a@example.test');
    const idB = await createTrainee(app, editor, 'Skill Owner B', 'skill.b@example.test');
    await link('a.progress@example.test', idA);
    await link('b.progress@example.test', idB);
    const traineeA = await signIn(app, 'a.progress@example.test');
    const traineeB = await signIn(app, 'b.progress@example.test');

    const evidence = await request(app)
      .post('/api/v1/portal/portfolio')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({ kind: 'case_study', title: 'Detection write-up', summary: 'A case study used as evidence.' })
      .expect(201);
    const evidenceId = text(readRecord(evidence.body).id);

    const skill = await request(app)
      .post('/api/v1/portal/skills')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({ name: 'Packet analysis', level: 3, evidenceItemId: evidenceId })
      .expect(201);
    const skillId = text(readRecord(skill.body).id);
    expect(JSON.stringify(skill.body)).not.toContain('storageKey');
    expect(readRecord(readRecord(skill.body).draft).evidenceItemId).toBe(evidenceId);

    const stolen = await request(app)
      .post('/api/v1/portal/skills')
      .set('Cookie', traineeB.cookie)
      .set('X-CSRF-Token', traineeB.csrf)
      .send({ name: 'Copied skill', level: 2, evidenceItemId: evidenceId })
      .expect(422);
    expect(field(stolen.body, 'evidenceItemId')).toMatch(/portfolio/);

    const event = await request(app)
      .post('/api/v1/portal/events')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({ title: 'Local CTF', eventDate: '2026-11-02', organiser: 'Accra Sec', link: 'https://example.com/ctf' })
      .expect(201);
    const eventId = text(readRecord(event.body).id);

    const listB = await request(app).get('/api/v1/portal/skills').set('Cookie', traineeB.cookie).expect(200);
    expect(JSON.stringify(listB.body)).not.toContain('Packet analysis');
    await request(app).patch(`/api/v1/portal/skills/${skillId}`).set('Cookie', traineeB.cookie).set('X-CSRF-Token', traineeB.csrf).send({ name: 'Taken' }).expect(404);
    await request(app).delete(`/api/v1/portal/skills/${skillId}`).set('Cookie', traineeB.cookie).set('X-CSRF-Token', traineeB.csrf).expect(404);
    const eventsB = await request(app).get('/api/v1/portal/events').set('Cookie', traineeB.cookie).expect(200);
    expect(JSON.stringify(eventsB.body)).not.toContain('Local CTF');
    await request(app).patch(`/api/v1/portal/events/${eventId}`).set('Cookie', traineeB.cookie).set('X-CSRF-Token', traineeB.csrf).send({ title: 'Taken' }).expect(404);

    const progress = await request(app).get('/api/v1/progress/trainees').set('Cookie', traineeB.cookie).expect(403);
    expect(JSON.stringify(progress.body)).not.toContain('Packet analysis');
    expect(JSON.stringify(progress.body)).not.toContain('skill.a@example.test');
  });

  it('publishes approved skills and events only, and keeps the certificate private until photo consent', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor.progress@example.test');
    const traineeA = await signIn(app, 'a.progress@example.test');
    const traineeId = await traineeIdFor('a.progress@example.test');
    await request(app)
      .put('/api/v1/portal/consents')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({ publicProfile: true })
      .expect(200);

    const skills = await request(app).get('/api/v1/portal/skills').set('Cookie', traineeA.cookie).expect(200);
    const skill = asList(skills.body).map((item) => readRecord(item)).find((item) => readRecord(item.draft).name === 'Packet analysis');
    if (!skill) throw new Error('Expected the skill from the previous test.');
    const skillId = text(skill.id);
    const submitted = await request(app)
      .post(`/api/v1/portal/skills/${skillId}/submit`)
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .expect(200);
    expect(readRecord(submitted.body).status).toBe('pending');

    const events = await request(app).get('/api/v1/portal/events').set('Cookie', traineeA.cookie).expect(200);
    const event = asList(events.body).map((item) => readRecord(item)).find((item) => readRecord(item.draft).title === 'Local CTF');
    if (!event) throw new Error('Expected the event from the previous test.');
    const eventId = text(event.id);
    const svg = await request(app)
      .post(`/api/v1/portal/events/${eventId}/certificate`)
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .attach('file', SVG, { filename: 'icon.svg', contentType: 'image/svg+xml' })
      .expect(422);
    expect(field(svg.body, 'certificate')).toMatch(/JPEG, PNG, or WebP/);
    await request(app)
      .post(`/api/v1/portal/events/${eventId}/certificate`)
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .attach('file', GPS_JPEG, { filename: 'where.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const stored = [...memoryOf(useContainer()).objects.values()];
    expect(stored.some((bytes) => bytes.includes(Buffer.from('GPSLatitude')))).toBe(false);
    await request(app)
      .post(`/api/v1/portal/events/${eventId}/submit`)
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .expect(200);

    await request(app).get(`/api/v1/public/trainees/${traineeId}/skills`).expect(404);
    await useContainer().dataSource.query(
      `UPDATE trainees SET publication_status = 'published', listing = 'public' WHERE id = $1`,
      [traineeId],
    );
    const hidden = await request(app).get(`/api/v1/public/trainees/${traineeId}/skills`).expect(200);
    expect(asList(hidden.body)).toEqual([]);

    await request(app)
      .post(`/api/v1/admin/review-queue/skills/${skillId}/approve`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    await request(app)
      .post(`/api/v1/admin/review-queue/events/${eventId}/approve`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);

    const evidence = await request(app)
      .get('/api/v1/portal/portfolio')
      .set('Cookie', traineeA.cookie)
      .expect(200);
    const item = asList(evidence.body).map((row) => readRecord(row)).find((row) => readRecord(row.draft).title === 'Detection write-up');
    if (!item) throw new Error('Expected the case study.');
    await request(app)
      .post(`/api/v1/portal/portfolio/${text(item.id)}/submit`)
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .expect(200);
    await request(app)
      .post(`/api/v1/admin/review-queue/items/${text(item.id)}/approve`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);

    const publicSkills = await request(app).get(`/api/v1/public/trainees/${traineeId}/skills`).expect(200);
    const publicText = JSON.stringify(publicSkills.body);
    expect(publicText).toContain('Packet analysis');
    expect(publicText).toContain('Detection write-up');
    expect(publicText).toContain('case_study');
    expect(publicText).not.toContain('skill.a@example.test');
    expect(publicText).not.toContain('storageKey');
    const publicEvents = await request(app).get(`/api/v1/public/trainees/${traineeId}/events`).expect(200);
    const eventText = JSON.stringify(publicEvents.body);
    expect(eventText).toContain('Local CTF');
    expect(eventText).toContain('Accra Sec');
    expect(eventText).not.toContain('certificateUrl":"');
    expect(asList(publicEvents.body).map((row) => readRecord(row)).every((row) => row.certificateUrl === null)).toBe(true);

    await useContainer().dataSource.query(`UPDATE trainees SET photo_consent = true WHERE id = $1`, [traineeId]);
    const withPhoto = await request(app).get(`/api/v1/public/trainees/${traineeId}/events`).expect(200);
    expect(JSON.stringify(withPhoto.body)).toContain('/api/v1/public/uploads/');

    await useContainer().dataSource.query(`UPDATE trainees SET consent_received = false WHERE id = $1`, [traineeId]);
    await request(app).get(`/api/v1/public/trainees/${traineeId}/skills`).expect(404);
    await request(app).get(`/api/v1/public/trainees/${traineeId}/events`).expect(404);

    await request(app)
      .patch(`/api/v1/admin/trainees/${traineeId}/skills/${skillId}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ name: 'Packet analysis reviewed' })
      .expect(200);
    await request(app)
      .delete(`/api/v1/admin/trainees/${traineeId}/events/${eventId}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    const audits: unknown = await useContainer().dataSource.query(
      `SELECT action FROM audit_events WHERE subject_id IN ($1, $2) AND action LIKE 'portal.%' ORDER BY created_at`,
      [skillId, eventId],
    );
    const actions = JSON.stringify(audits);
    expect(actions).toContain('portal.skill.approved');
    expect(actions).toContain('portal.skill.admin_updated');
    expect(actions).toContain('portal.event.approved');
    expect(actions).toContain('portal.event.deleted');
  });

  it('lets a linked trainer read skills and events and refuses an unlinked trainer', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor.progress@example.test');
    const trainer = await signIn(app, 'trainer.progress@example.test');
    const before = await request(app).get('/api/v1/progress/trainees').set('Cookie', trainer.cookie).expect(403);
    expect(JSON.stringify(before.body)).toContain('not linked');
    expect(JSON.stringify(before.body)).not.toContain('@');

    const rows: unknown = await useContainer().dataSource.query(
      `SELECT id FROM trainers WHERE kind = 'person' ORDER BY display_name LIMIT 1`,
    );
    const trainerId = text(readRecord(asList(rows)[0]).id);
    await request(app)
      .patch(`/api/v1/admin/trainers/${trainerId}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ loginEmail: 'trainer.progress@example.test' })
      .expect(200);

    const seen = await request(app).get('/api/v1/progress/trainees').set('Cookie', trainer.cookie).expect(200);
    const textBody = JSON.stringify(seen.body);
    expect(textBody).toContain('Packet analysis reviewed');
    expect(textBody).not.toContain('skill.a@example.test');
    expect(textBody).not.toContain('internalNotes');
    await request(app).get('/api/v1/admin/trainees').set('Cookie', trainer.cookie).expect(403);
    await request(app)
      .patch(`/api/v1/admin/trainees/1/skills/missing`)
      .set('Cookie', trainer.cookie)
      .set('X-CSRF-Token', trainer.csrf)
      .send({ name: 'Nope' })
      .expect(403);
  });
});

async function createTrainee(app: ReturnType<typeof appFor>, editor: Session, displayName: string, email: string): Promise<string> {
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
  await useContainer().dataSource.query(`UPDATE users SET trainee_id = $1, email_verified_at = now() WHERE email = $2`, [traineeId, email]);
}

async function traineeIdFor(email: string): Promise<string> {
  const rows: unknown = await useContainer().dataSource.query(`SELECT trainee_id FROM users WHERE email = $1`, [email]);
  return text(readRecord(asList(rows)[0]).trainee_id);
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
