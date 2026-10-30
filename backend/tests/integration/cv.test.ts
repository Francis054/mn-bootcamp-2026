import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import request, { type Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { runSeed } from '../../src/commands/seed.js';
import type { AppContainer } from '../../src/composition/container.js';
import { AppContainer as Container } from '../../src/composition/container.js';
import { signCvLink } from '../../src/modules/documents/cv-link.js';
import { MemoryDocumentStorage } from '../../src/modules/documents/memory-document-storage.js';
import { testEnv } from '../support/app-env.js';
import { revertOurMigrations } from '../support/migrations.js';
import { readError, readRecord } from '../support/read-json.js';
import { openTestDatabase } from '../support/test-database.js';

const PASSWORD = 'Correct-horse-1';

let container: AppContainer | undefined;
let closeDatabase: (() => Promise<void>) | undefined;

describe('trainee CVs', () => {
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
      email: 'editor.cv@example.test',
      password: PASSWORD,
      role: 'editor',
      displayName: 'CV Editor',
    });
    await container.users.createUser({
      email: 'admin.cv@example.test',
      password: PASSWORD,
      role: 'administrator',
      displayName: 'CV Administrator',
    });
    await container.users.createUser({
      email: 'a.cv@example.test',
      password: PASSWORD,
      role: 'trainee',
      displayName: 'Trainee A',
    });
    await container.users.createUser({
      email: 'b.cv@example.test',
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

  it('stops one trainee from reading another trainee’s CV and deletes the replaced file', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor.cv@example.test');
    const idA = await createTrainee(app, editor, 'CV Owner A', 'cv.owner.a@example.test');
    const idB = await createTrainee(app, editor, 'CV Owner B', 'cv.owner.b@example.test');
    await link('a.cv@example.test', idA);
    await link('b.cv@example.test', idB);
    const traineeA = await signIn(app, 'a.cv@example.test');
    const traineeB = await signIn(app, 'b.cv@example.test');
    const first = await pdfWithTitle('First CV');
    const second = await pdfWithTitle('Second CV');

    const uploaded = await request(app)
      .post('/api/v1/portal/cv')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .attach('file', first, { filename: 'first.pdf', contentType: 'application/pdf' })
      .expect(201);
    const sha = text(readRecord(uploaded.body).sha256);
    expect(sha).toBe(createHash('sha256').update(first).digest('hex'));
    expect(readRecord(uploaded.body).visibility).toBe('on_request');
    expect(readRecord(uploaded.body).reviewStatus).toBe('pending');
    expect(JSON.stringify(uploaded.body)).not.toContain('storageKey');

    const ownFile = await request(app)
      .get('/api/v1/portal/cv/file')
      .set('Cookie', traineeA.cookie)
      .expect(200);
    expect(ownFile.headers['content-disposition']).toContain('attachment');
    expect(header(ownFile, 'content-disposition')).not.toContain('inline');
    expect(pdfBytes(ownFile.body).subarray(0, 5).toString()).toBe('%PDF-');

    const other = await request(app)
      .get('/api/v1/portal/cv')
      .set('Cookie', traineeB.cookie)
      .expect(200);
    expect(readRecord(other.body).cv).toBeNull();
    expect(JSON.stringify(other.body)).not.toContain(sha);
    const stolen = await request(app)
      .get('/api/v1/portal/cv/file')
      .set('Cookie', traineeB.cookie)
      .expect(404);
    expect(JSON.stringify(stolen.body)).not.toContain(sha);
    expect(header(stolen, 'content-type')).not.toContain('application/pdf');

    await request(app)
      .post('/api/v1/portal/cv')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .attach('file', second, { filename: 'second.pdf', contentType: 'application/pdf' })
      .expect(201);
    const stored = [...memoryOf(useContainer()).objects.values()];
    expect(stored.some((bytes) => bytes.equals(first))).toBe(false);
    expect(stored.some((bytes) => bytes.equals(second))).toBe(true);
    expect(stored).toHaveLength(1);
  });

  it('offers a public download only after approval, and the signed link expires', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor.cv@example.test');
    const admin = await signIn(app, 'admin.cv@example.test');
    const traineeA = await signIn(app, 'a.cv@example.test');
    const traineeId = await traineeIdFor('a.cv@example.test');
    await useContainer().dataSource.query(
      `UPDATE trainees SET consent_received = true, publication_status = 'published', listing = 'public' WHERE id = $1`,
      [traineeId],
    );

    const hidden = await request(app).get(`/api/v1/public/trainees/${traineeId}`).expect(200);
    expect(readRecord(hidden.body).cv).toEqual({ available: false, mode: null });
    expect(JSON.stringify(hidden.body)).not.toContain('storageKey');
    expect(JSON.stringify(hidden.body)).not.toContain('/public/cv/');
    await request(app).post(`/api/v1/public/trainees/${traineeId}/cv-link`).expect(404);

    const queue = await request(app)
      .get('/api/v1/admin/review-queue/cvs')
      .set('Cookie', editor.cookie)
      .expect(200);
    const waiting = asList(queue.body)
      .map((item) => readRecord(item))
      .find((item) => item.traineeId === traineeId);
    if (!waiting) throw new Error('Expected the CV in the review queue.');
    const cvId = text(waiting.id);
    await request(app)
      .post(`/api/v1/admin/review-queue/cvs/${cvId}/approve`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);

    const onRequest = await request(app).get(`/api/v1/public/trainees/${traineeId}`).expect(200);
    expect(readRecord(onRequest.body).cv).toEqual({ available: true, mode: 'on_request' });
    await request(app).post(`/api/v1/public/trainees/${traineeId}/cv-link`).expect(404);

    const widened = await request(app)
      .patch('/api/v1/portal/cv')
      .set('Cookie', traineeA.cookie)
      .set('X-CSRF-Token', traineeA.csrf)
      .send({ visibility: 'public' })
      .expect(200);
    expect(readRecord(widened.body).reviewStatus).toBe('approved');
    expect(readRecord(widened.body).visibility).toBe('public');
    const offered = await request(app).get(`/api/v1/public/trainees/${traineeId}`).expect(200);
    expect(readRecord(offered.body).cv).toEqual({ available: true, mode: 'public' });
    expect(JSON.stringify(offered.body)).not.toContain('/public/cv/');

    const minted = await request(app)
      .post(`/api/v1/public/trainees/${traineeId}/cv-link`)
      .expect(200);
    const path = text(readRecord(minted.body).path);
    expect(path.startsWith('/api/v1/public/cv/')).toBe(true);
    expect(minted.headers['cache-control']).toBe('private, no-store');
    const downloaded = await request(app).get(path).expect(200);
    expect(downloaded.headers['content-type']).toContain('application/pdf');
    expect(downloaded.headers['content-disposition']).toContain('attachment');
    expect(header(downloaded, 'content-disposition')).not.toContain('inline');
    expect(downloaded.headers['x-content-type-options']).toBe('nosniff');
    expect(header(downloaded, 'cache-control')).toContain('no-store');
    expect(header(downloaded, 'cache-control')).not.toContain('public');
    expect(pdfBytes(downloaded.body).subarray(0, 5).toString()).toBe('%PDF-');

    const secret = useContainer().env.sessionSecret;
    if (!secret) throw new Error('Expected a test session secret.');
    const expired = signCvLink({
      secret,
      documentId: cvId,
      nowMs: Date.now() - 60_000,
      ttlMs: 1_000,
    });
    const stale = await request(app).get(`/api/v1/public/cv/${expired}`).expect(404);
    expect(readError(stale.body).message).toMatch(/expired/);
    expect(header(stale, 'content-type')).not.toContain('application/pdf');

    await request(app)
      .get(`/api/v1/admin/trainees/${traineeId}/cv/file`)
      .set('Cookie', editor.cookie)
      .expect(403);
    const adminFile = await request(app)
      .get(`/api/v1/admin/trainees/${traineeId}/cv/file`)
      .set('Cookie', admin.cookie)
      .expect(200);
    expect(pdfBytes(adminFile.body).subarray(0, 5).toString()).toBe('%PDF-');

    const consents: unknown = await useContainer().dataSource.query(
      `SELECT scope, granted FROM trainee_consents WHERE trainee_id = $1 AND scope IN ('cv_public', 'cv_on_request') ORDER BY created_at DESC LIMIT 2`,
      [traineeId],
    );
    const latest = asList(consents).map((row) => readRecord(row));
    expect(latest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scope: 'cv_public', granted: true }),
        expect.objectContaining({ scope: 'cv_on_request', granted: true }),
      ]),
    );
  });

  it('refuses a trainee on the admin CV routes', async () => {
    const app = appFor(useContainer());
    const traineeB = await signIn(app, 'b.cv@example.test');
    const traineeId = await traineeIdFor('a.cv@example.test');
    const routes = [
      () => request(app).get('/api/v1/admin/review-queue/cvs').set('Cookie', traineeB.cookie),
      () =>
        request(app).get(`/api/v1/admin/trainees/${traineeId}/cv`).set('Cookie', traineeB.cookie),
      () =>
        request(app)
          .get(`/api/v1/admin/trainees/${traineeId}/cv/file`)
          .set('Cookie', traineeB.cookie),
      () =>
        request(app)
          .post(`/api/v1/admin/trainees/${traineeId}/cv`)
          .set('Cookie', traineeB.cookie)
          .set('X-CSRF-Token', traineeB.csrf),
      () =>
        request(app)
          .delete(`/api/v1/admin/trainees/${traineeId}/cv`)
          .set('Cookie', traineeB.cookie)
          .set('X-CSRF-Token', traineeB.csrf),
      () =>
        request(app)
          .post('/api/v1/admin/review-queue/cvs/11111111-1111-4111-8111-111111111111/approve')
          .set('Cookie', traineeB.cookie)
          .set('X-CSRF-Token', traineeB.csrf),
    ];
    for (const call of routes) {
      const response = await call();
      expect(response.status, JSON.stringify(response.body)).toBe(403);
      expect(readError(response.body).code).toBe('forbidden');
      expect(JSON.stringify(response.body)).not.toContain('%PDF-');
    }
  });
});

async function pdfWithTitle(title: string): Promise<Buffer> {
  const document = await PDFDocument.create();
  document.addPage();
  document.setTitle(title);
  return Buffer.from(await document.save());
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
  await useContainer().dataSource.query(
    `UPDATE users SET trainee_id = $1, email_verified_at = now() WHERE email = $2`,
    [traineeId, email],
  );
}

async function traineeIdFor(email: string): Promise<string> {
  const rows: unknown = await useContainer().dataSource.query(
    `SELECT trainee_id FROM users WHERE email = $1`,
    [email],
  );
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

function memoryOf(current: AppContainer): MemoryDocumentStorage {
  if (!(current.documents instanceof MemoryDocumentStorage))
    throw new Error('Expected memory document storage.');
  return current.documents;
}

interface Session {
  cookie: string;
  csrf: string;
}

async function signIn(app: ReturnType<typeof appFor>, email: string): Promise<Session> {
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

function pdfBytes(body: unknown): Buffer {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  throw new Error('Expected a PDF body.');
}

function header(response: Response, name: string): string {
  const value = response.get(name);
  return typeof value === 'string' ? value : '';
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('Expected text.');
  return value;
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
