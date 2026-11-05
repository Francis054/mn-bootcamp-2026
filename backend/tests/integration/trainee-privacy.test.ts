import { execFileSync } from 'node:child_process';
import type { IncomingMessage } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request, { type Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { AppContainer } from '../../src/composition/container.js';
import { AppContainer as Container } from '../../src/composition/container.js';
import { isMemoryDocumentStorage } from '../../src/modules/documents/memory-document-storage.js';
import { isMemoryStorage } from '../../src/modules/storage/memory-storage.js';
import { testEnv } from '../support/app-env.js';
import { revertOurMigrations } from '../support/migrations.js';
import { readRecord } from '../support/read-json.js';
import { openTestDatabase } from '../support/test-database.js';

const PASSWORD = 'Correct-horse-1';
const PHOTO_KEY = 'photo-privacy-test';
const CV_BYTES = Buffer.from('CV-BYTES-FOR-EXPORT');

let container: AppContainer | undefined;
let closeDatabase: (() => Promise<void>) | undefined;

describe('trainee data export and removal', () => {
  beforeAll(async () => {
    const database = await openTestDatabase();
    closeDatabase = database.close;
    container = await Container.create(
      testEnv({ databaseUrl: database.url, databaseSsl: false, logLevel: 'silent' }),
    );
    await container.dataSource.runMigrations();
    await container.users.createUser({
      email: 'privacy.admin@example.test',
      password: PASSWORD,
      role: 'administrator',
      displayName: 'Privacy Admin',
    });
    await container.users.createUser({
      email: 'privacy.editor@example.test',
      password: PASSWORD,
      role: 'editor',
      displayName: 'Privacy Editor',
    });
  });

  afterAll(async () => {
    if (container?.dataSource.isInitialized) {
      await revertOurMigrations(container.dataSource);
      await container.close();
    }
    if (closeDatabase) await closeDatabase();
  });

  it('exports the trainee records and the CV file', async () => {
    const app = appFor(useContainer());
    const admin = await signIn(app, 'privacy.admin@example.test');
    const email = 'export.person@example.test';
    const traineeId = await createTrainee(app, admin, 'Export Person', email);
    await useContainer().users.createUser({
      email,
      password: PASSWORD,
      role: 'trainee',
      displayName: 'Export Person',
    });
    await useContainer().dataSource.query(
      `UPDATE users SET trainee_id = $1, email_verified_at = now() WHERE email = $2`,
      [traineeId, email],
    );
    await request(app).post('/api/v1/auth/password-reset/request').send({ email }).expect(200);

    const documents = useContainer().documents;
    if (!isMemoryDocumentStorage(documents)) throw new Error('Expected in-memory CV storage.');
    const stored = await documents.put({ bytes: CV_BYTES, contentType: 'application/pdf' });
    const inserted: unknown = await useContainer().dataSource.query(
      `INSERT INTO trainee_documents (
         id, trainee_id, kind, file_name, mime, size_bytes, sha256, storage_provider, storage_key, visibility, review_status
       ) VALUES (gen_random_uuid(), $1, 'cv', 'cv.pdf', 'application/pdf', $2, $3, 'memory', $4, 'on_request', 'pending')
       RETURNING id`,
      [traineeId, CV_BYTES.length, 'a'.repeat(64), stored.key],
    );
    const documentId = text(asRecords(inserted)[0]?.id);
    await useContainer().dataSource.query(
      `INSERT INTO trainee_consents (trainee_id, scope, granted, source, policy_version, wording)
       VALUES ($1, 'public_profile', true, 'admin', '2026-10', 'The profile may be public.')`,
      [traineeId],
    );
    await useContainer().dataSource.query(
      `INSERT INTO trainee_skills (trainee_id, slug, name, level) VALUES ($1, 'wireshark', 'Wireshark', 2)`,
      [traineeId],
    );
    await useContainer().dataSource.query(
      `INSERT INTO portfolio_items (trainee_id, kind, title, summary) VALUES ($1, 'lab', 'Packet lab', 'A lab write-up')`,
      [traineeId],
    );
    await useContainer().dataSource.query(
      `INSERT INTO trainee_events (trainee_id, title, organiser) VALUES ($1, 'Community meetup', 'Maxim Nyansa')`,
      [traineeId],
    );
    await useContainer().dataSource.query(
      `INSERT INTO trainee_milestones (id, trainee_id, title, occurred_on) VALUES (gen_random_uuid(), $1, 'First lab', '2026-10-01')`,
      [traineeId],
    );
    await useContainer().dataSource.query(
      `INSERT INTO contact_requests (id, trainee_id, from_name, from_email, message, status)
       VALUES (gen_random_uuid(), $1, 'Ama Employer', 'employer@example.test', 'Hello from the export test', 'new')`,
      [traineeId],
    );
    await useContainer().dataSource.query(
      `INSERT INTO cv_requests (id, trainee_id, document_id, from_name, from_email, message, status)
       VALUES (gen_random_uuid(), $1, $2, 'Ama Employer', 'employer@example.test', 'Please share the CV.', 'new')`,
      [traineeId, documentId],
    );
    const project = await request(app)
      .post('/api/v1/admin/projects')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .send({
        title: 'Export project title here',
        type: 'Lab',
        abstract: 'A project abstract for the export test.',
        moduleId: 'network',
        tools: 'A labelled tool list.',
        steps: ['Scope and plan', 'Build and test'],
        team: ['Export Person'],
        traineeIds: [traineeId],
        repositoryUrl: '',
        demoUrl: '',
        labOnlyConfirmed: true,
        shareAgreed: false,
        publicationStatus: 'draft',
        listing: 'hidden',
        internalNotes: '',
      })
      .expect(201);
    const projectId = text(readRecord(project.body).id);

    const editor = await signIn(app, 'privacy.editor@example.test');
    await request(app)
      .get(`/api/v1/admin/trainees/${traineeId}/export`)
      .set('Cookie', editor.cookie)
      .expect(403);

    const downloaded = await request(app)
      .get(`/api/v1/admin/trainees/${traineeId}/export`)
      .set('Cookie', admin.cookie)
      .buffer(true)
      .parse(
        binaryParser as unknown as (
          res: Response,
          callback: (err: Error | null, body: Buffer) => void,
        ) => void,
      )
      .expect(200);
    expect(downloaded.headers['content-type']).toContain('application/zip');
    expect(header(downloaded, 'content-disposition')).toContain('attachment');
    expect(header(downloaded, 'cache-control')).toContain('no-store');
    const files = unzip(asBuffer(downloaded.body));
    const json = JSON.parse(files.get('trainee.json') ?? '{}') as {
      profile: { email?: string; display_name?: string };
      consents: unknown[];
      skills: Array<{ name?: string }>;
      labs: Array<{ title?: string }>;
      projects: Array<{ id?: string; title?: string }>;
      events: Array<{ title?: string }>;
      milestones: Array<{ title?: string }>;
      contactRequests: Array<{ message?: string }>;
      cvRequests: Array<{ message?: string }>;
      emailOutbox: Array<{ kind?: string; html_body?: string; text_body?: string }>;
      cv: { includedFile?: string | null };
    };
    const packed = JSON.stringify(json);
    expect(json.profile.email).toBe(email);
    expect(json.profile.display_name).toBe('Export Person');
    expect(json.consents.length).toBeGreaterThan(0);
    expect(json.skills.some((row) => row.name === 'Wireshark')).toBe(true);
    expect(json.labs.some((row) => row.title === 'Packet lab')).toBe(true);
    expect(
      json.projects.some(
        (row) => row.id === projectId && row.title === 'Export project title here',
      ),
    ).toBe(true);
    expect(json.events.some((row) => row.title === 'Community meetup')).toBe(true);
    expect(json.milestones.some((row) => row.title === 'First lab')).toBe(true);
    expect(json.contactRequests.some((row) => row.message === 'Hello from the export test')).toBe(
      true,
    );
    expect(json.cvRequests.some((row) => row.message === 'Please share the CV.')).toBe(true);
    const reset = json.emailOutbox.find((row) => row.kind === 'password_reset');
    expect(reset?.text_body).toContain('/portal/reset-password');
    expect(reset?.html_body).toContain('lang="en"');
    expect(json.cv.includedFile).toBe('cv.pdf');
    expect(files.get('cv.pdf')).toBe(CV_BYTES.toString());
    expect(packed).not.toContain('password_hash');
    expect(packed).not.toContain('$argon2');
    expect(packed).not.toContain(PHOTO_KEY);
  });

  it('reports a failed file delete and retries it', async () => {
    const current = useContainer();
    const app = appFor(current);
    const admin = await signIn(app, 'privacy.admin@example.test');
    const editor = await signIn(app, 'privacy.editor@example.test');
    const traineeId = await createTrainee(
      app,
      admin,
      'Remove Person',
      'remove.person@example.test',
    );
    const otherId = await createTrainee(app, admin, 'Keep Person', 'keep.person@example.test');
    if (!isMemoryStorage(current.storage) || !isMemoryDocumentStorage(current.documents)) {
      throw new Error('Expected in-memory file storage.');
    }
    current.storage.objects.set(PHOTO_KEY, Buffer.from('photo'));
    await current.dataSource.query(
      `UPDATE trainees SET photo_storage_key = $2, photo_url = $3 WHERE id = $1`,
      [traineeId, PHOTO_KEY, 'memory:photo'],
    );
    const stored = await current.documents.put({
      bytes: Buffer.from('%PDF-remove'),
      contentType: 'application/pdf',
    });
    await current.dataSource.query(
      `INSERT INTO trainee_documents (
         id, trainee_id, kind, file_name, mime, size_bytes, sha256, storage_provider, storage_key, visibility, review_status
       ) VALUES (gen_random_uuid(), $1, 'cv', 'cv.pdf', 'application/pdf', 11, $2, 'memory', $3, 'private', 'approved')`,
      [traineeId, 'b'.repeat(64), stored.key],
    );
    const project = await request(app)
      .post('/api/v1/admin/projects')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .send({
        title: 'Removal project title here',
        type: 'Lab',
        abstract: 'A project that must stay after the trainee is removed.',
        moduleId: 'network',
        tools: 'A labelled tool list.',
        steps: ['Scope and plan', 'Build and test'],
        team: ['Remove Person'],
        traineeIds: [traineeId],
        repositoryUrl: '',
        demoUrl: '',
        labOnlyConfirmed: true,
        shareAgreed: false,
        publicationStatus: 'draft',
        listing: 'hidden',
        internalNotes: '',
      })
      .expect(201);
    const projectId = text(readRecord(project.body).id);

    await request(app)
      .post(`/api/v1/admin/trainees/${traineeId}/erase`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ confirmation: 'Remove Person' })
      .expect(403);
    const missingToken = await request(app)
      .post(`/api/v1/admin/trainees/${traineeId}/erase`)
      .set('Cookie', admin.cookie)
      .send({ confirmation: 'Remove Person' })
      .expect(403);
    expect(readRecord(readRecord(missingToken.body).error).message).toBe(
      'The security token does not match.',
    );
    const wrong = await request(app)
      .post(`/api/v1/admin/trainees/${traineeId}/erase`)
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .send({ confirmation: 'someone else' })
      .expect(422);
    expect(readRecord(readRecord(wrong.body).error).fieldErrors).toMatchObject({
      confirmation: 'Type the trainee’s display name to confirm.',
    });
    await request(app)
      .get(`/api/v1/admin/trainees/${traineeId}`)
      .set('Cookie', admin.cookie)
      .expect(200);

    current.storage.failDeletes = true;
    current.documents.failDeletes = true;
    try {
      const erased = await request(app)
        .post(`/api/v1/admin/trainees/${traineeId}/erase`)
        .set('Cookie', admin.cookie)
        .set('X-CSRF-Token', admin.csrf)
        .send({ confirmation: 'Remove Person' })
        .expect(200);
      const report = readRecord(erased.body);
      expect(readRecord(report.database).status).toBe('deleted');
      const items = asRecords(report.items);
      const cv = items.find((item) => item.kind === 'cv');
      const photo = items.find((item) => item.kind === 'profile_photo');
      expect(cv?.status).toBe('failed');
      expect(typeof cv?.error).toBe('string');
      expect(String(cv?.error)).not.toContain('service_role');
      expect(photo?.status).toBe('failed');
      expect(JSON.stringify(report)).not.toContain(stored.key);
      await request(app)
        .get(`/api/v1/admin/trainees/${traineeId}`)
        .set('Cookie', admin.cookie)
        .expect(404);
      await request(app)
        .get(`/api/v1/admin/trainees/${otherId}`)
        .set('Cookie', admin.cookie)
        .expect(200);
      const projectStill = await request(app)
        .get(`/api/v1/admin/projects/${projectId}`)
        .set('Cookie', admin.cookie)
        .expect(200);
      expect(readRecord(projectStill.body).title).toBe('Removal project title here');
      const links: unknown = await current.dataSource.query(
        `SELECT trainee_id FROM project_trainees WHERE project_id = $1`,
        [projectId],
      );
      expect(asRecords(links)).toEqual([]);
      const outbox: unknown = await current.dataSource.query(
        `SELECT id FROM email_outbox WHERE trainee_id = $1`,
        [traineeId],
      );
      expect(asRecords(outbox)).toEqual([]);
      expect(current.storage.objects.has(PHOTO_KEY)).toBe(true);
      expect(current.documents.objects.has(stored.key)).toBe(true);

      current.storage.failDeletes = false;
      current.documents.failDeletes = false;
      const retried = await request(app)
        .post(`/api/v1/admin/trainee-removals/${text(report.removalId)}/retry`)
        .set('Cookie', admin.cookie)
        .set('X-CSRF-Token', admin.csrf)
        .expect(200);
      const again = asRecords(readRecord(retried.body).items);
      expect(again.find((item) => item.kind === 'cv')?.status).toBe('deleted');
      expect(again.find((item) => item.kind === 'profile_photo')?.status).toBe('deleted');
      expect(current.storage.objects.has(PHOTO_KEY)).toBe(false);
      expect(current.documents.objects.has(stored.key)).toBe(false);
      const audits: unknown = await current.dataSource.query(
        `SELECT action FROM audit_events WHERE action IN ('trainee.data.removed', 'trainee.removal.retried')`,
      );
      const names = asRecords(audits).map((row) => row.action);
      expect(names).toContain('trainee.data.removed');
      expect(names).toContain('trainee.removal.retried');
    } finally {
      current.storage.failDeletes = false;
      current.documents.failDeletes = false;
    }
  });
});

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

function cookiesFrom(response: Response): Record<string, { value: string }> {
  const cookies: Record<string, { value: string }> = {};
  const headerValue = response.headers['set-cookie'];
  const lines =
    typeof headerValue === 'string' ? [headerValue] : Array.isArray(headerValue) ? headerValue : [];
  for (const line of lines) {
    const pair = line.split(';')[0] ?? '';
    const eq = pair.indexOf('=');
    if (eq < 1) continue;
    cookies[pair.slice(0, eq).trim()] = { value: decodeURIComponent(pair.slice(eq + 1).trim()) };
  }
  return cookies;
}

function header(response: Response, name: string): string {
  const value = response.get(name);
  return typeof value === 'string' ? value : '';
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('Expected text.');
  return value;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && !Array.isArray(item),
  );
}

function asBuffer(body: unknown): Buffer {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === 'string') return Buffer.from(body);
  throw new Error('Expected a zip body.');
}

function binaryParser(
  res: IncomingMessage,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
  res.on('end', () => {
    callback(null, Buffer.concat(chunks));
  });
}

function unzip(bytes: Buffer): Map<string, string> {
  const dir = mkdtempSync(join(tmpdir(), 'export-'));
  const file = join(dir, 'pack.zip');
  writeFileSync(file, bytes);
  const names = execFileSync(
    'python3',
    [
      '-c',
      'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); z.extractall(sys.argv[2]); print("\\n".join(z.namelist()))',
      file,
      dir,
    ],
    { encoding: 'utf8' },
  )
    .split('\n')
    .map((name) => name.trim())
    .filter(Boolean);
  const files = new Map<string, string>();
  for (const name of names) files.set(name, readFileSync(join(dir, name), 'utf8'));
  return files;
}
