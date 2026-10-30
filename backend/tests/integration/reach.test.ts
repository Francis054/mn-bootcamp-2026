import { PDFDocument } from 'pdf-lib';
import request, { type Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { AppContainer } from '../../src/composition/container.js';
import { AppContainer as Container } from '../../src/composition/container.js';
import { MemoryMail } from '../../src/modules/mail/memory-mail.js';
import { testEnv } from '../support/app-env.js';
import { revertOurMigrations } from '../support/migrations.js';
import { readRecord } from '../support/read-json.js';
import { openTestDatabase } from '../support/test-database.js';

const PASSWORD = 'Correct-horse-1';
const SECRET_EMAIL = 'secret.mailbox@example.test';

let container: AppContainer | undefined;
let closeDatabase: (() => Promise<void>) | undefined;

describe('directory, profile PDF, contact, and CV requests', () => {
  beforeAll(async () => {
    const database = await openTestDatabase();
    closeDatabase = database.close;
    container = await Container.create(
      testEnv({ databaseUrl: database.url, databaseSsl: false, logLevel: 'silent' }),
    );
    await container.dataSource.runMigrations();
    await container.users.createUser({
      email: 'editor.reach@example.test',
      password: PASSWORD,
      role: 'editor',
      displayName: 'Reach Editor',
    });
    await container.users.createUser({
      email: 'reach.trainee@example.test',
      password: PASSWORD,
      role: 'trainee',
      displayName: 'Reach Trainee',
    });
  });

  afterAll(async () => {
    if (container?.dataSource.isInitialized) {
      await revertOurMigrations(container.dataSource);
      await container.close();
    }
    if (closeDatabase) await closeDatabase();
  });

  it('lists only a public profile, filters it, and keeps the email out of the PDF', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor.reach@example.test');
    const publicId = await createTrainee(app, editor, 'PDF Person', SECRET_EMAIL);
    const draftId = await createTrainee(app, editor, 'Hidden Person', 'hidden.person@example.test');
    await useContainer().dataSource.query(
      `UPDATE trainees
         SET consent_received = true,
             publication_status = 'published',
             listing = 'public',
             contact_consent = false,
             skills = $2::text[],
             slug = 'pdf-person',
             headline = 'Aspiring analyst',
             bio = 'A public bio with no private address.'
       WHERE id = $1`,
      [publicId, ['Wireshark']],
    );

    const hidden = await request(app).get(`/api/v1/public/trainees/${draftId}`).expect(404);
    expect(JSON.stringify(hidden.body)).not.toContain(SECRET_EMAIL);
    await request(app).get(`/api/v1/public/trainees/${draftId}/profile.pdf`).expect(404);

    const listed = await request(app)
      .get('/api/v1/public/trainees')
      .query({ skill: 'Wireshark' })
      .expect(200);
    const rows = asList(listed.body).map((item) => readRecord(item));
    expect(rows.map((row) => row.id)).toEqual([publicId]);
    expect(JSON.stringify(listed.body)).not.toContain(SECRET_EMAIL);
    expect(rows[0]?.contactAvailable).toBe(false);
    const missed = await request(app)
      .get('/api/v1/public/trainees')
      .query({ q: 'secret.mailbox' })
      .expect(200);
    expect(missed.body).toEqual([]);
    const bySlug = await request(app).get('/api/v1/public/trainees/pdf-person').expect(200);
    expect(readRecord(bySlug.body).displayName).toBe('PDF Person');
    expect(JSON.stringify(bySlug.body)).not.toContain(SECRET_EMAIL);

    const pdf = await request(app)
      .get('/api/v1/public/trainees/pdf-person/profile.pdf')
      .expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(header(pdf, 'content-disposition')).toContain('attachment');
    expect(header(pdf, 'cache-control')).toContain('no-store');
    expect(header(pdf, 'cache-control')).not.toContain('public');
    const bytes = pdfBytes(pdf.body);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.includes(Buffer.from(SECRET_EMAIL))).toBe(false);
    expect(bytes.includes(Buffer.from('hidden.person@example.test'))).toBe(false);

    const refused = await request(app)
      .post(`/api/v1/public/trainees/${publicId}/contact`)
      .send({
        name: 'Employer',
        email: 'employer@example.test',
        message: 'We would like to talk about a role.',
      })
      .expect(404);
    expect(JSON.stringify(refused.body)).not.toContain(SECRET_EMAIL);

    await useContainer().dataSource.query(
      `UPDATE trainees SET contact_consent = true WHERE id = $1`,
      [publicId],
    );
    const honeypot = await request(app)
      .post(`/api/v1/public/trainees/pdf-person/contact`)
      .send({
        name: 'Employer',
        email: 'spam@example.test',
        message: 'We would like to talk about a role.',
        company: 'filled',
      })
      .expect(200);
    expect(JSON.stringify(honeypot.body)).not.toContain(SECRET_EMAIL);
    const spamCount = await count(
      `SELECT count(*)::int AS count FROM contact_requests WHERE from_email = 'spam@example.test'`,
    );
    expect(spamCount).toBe(0);

    const invalid = await request(app)
      .post('/api/v1/public/trainees/pdf-person/contact')
      .send({ email: 'not-an-email', message: 'short' })
      .expect(422);
    const fields = readRecord(readRecord(readRecord(invalid.body).error).fieldErrors);
    expect(String(fields.name)).toMatch(/name/i);
    expect(fields.email).toBeTruthy();

    const sent = await request(app)
      .post('/api/v1/public/trainees/pdf-person/contact')
      .send({
        name: 'Employer',
        email: 'employer@example.test',
        organisation: 'Lab',
        message: 'We would like to talk about a role.',
      })
      .expect(200);
    expect(readRecord(sent.body).delivered).toBe(true);
    expect(JSON.stringify(sent.body)).not.toContain(SECRET_EMAIL);
    const mail = memoryMail(useContainer());
    const note = mail.sent.find((item) => item.to === SECRET_EMAIL);
    expect(note?.replyTo).toBe('employer@example.test');
    expect(note?.text).not.toContain(SECRET_EMAIL);

    const inbox = await request(app)
      .get('/api/v1/admin/contact-requests')
      .set('Cookie', editor.cookie)
      .expect(200);
    expect(JSON.stringify(inbox.body)).not.toContain(SECRET_EMAIL);
    expect(JSON.stringify(inbox.body)).toContain('Employer');
    const messageId = text(readRecord(asList(inbox.body)[0]).id);
    await request(app)
      .post(`/api/v1/admin/contact-requests/${messageId}/block`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    const before = await count('SELECT count(*)::int AS count FROM contact_requests');
    await request(app)
      .post('/api/v1/public/trainees/pdf-person/contact')
      .send({
        name: 'Employer',
        email: 'employer@example.test',
        message: 'This follow-up should not be stored.',
      })
      .expect(200);
    const after = await count('SELECT count(*)::int AS count FROM contact_requests');
    expect(after).toBe(before);

    await link('reach.trainee@example.test', publicId);
    const trainee = await signIn(app, 'reach.trainee@example.test');
    const file = await pdfWithTitle('On request CV');
    await request(app)
      .post('/api/v1/portal/cv')
      .set('Cookie', trainee.cookie)
      .set('X-CSRF-Token', trainee.csrf)
      .attach('file', file, { filename: 'cv.pdf', contentType: 'application/pdf' })
      .expect(201);
    const queue = await request(app)
      .get('/api/v1/admin/review-queue/cvs')
      .set('Cookie', editor.cookie)
      .expect(200);
    const waiting = asList(queue.body)
      .map((item) => readRecord(item))
      .find((item) => item.traineeId === publicId);
    if (!waiting) throw new Error('Expected the CV in the review queue.');
    await request(app)
      .post(`/api/v1/admin/review-queue/cvs/${text(waiting.id)}/approve`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    await request(app).post(`/api/v1/public/trainees/pdf-person/cv-link`).expect(404);
    const asked = await request(app)
      .post('/api/v1/public/trainees/pdf-person/cv-request')
      .send({
        name: 'Recruiter',
        email: 'recruiter@example.test',
        message: 'Please share the CV.',
      })
      .expect(200);
    expect(readRecord(asked.body).delivered).toBe(true);
    expect(JSON.stringify(asked.body)).not.toContain(SECRET_EMAIL);
    expect(JSON.stringify(asked.body)).not.toContain('/public/cv/');
    const linkMail = [...mail.sent].reverse().find((item) => item.to === 'recruiter@example.test');
    expect(linkMail?.text).not.toContain(SECRET_EMAIL);
    const url = linkMail?.text.split('\n').find((line) => line.includes('/api/v1/public/cv/'));
    if (!url) throw new Error('Expected a signed download link in the mail.');
    const path = url.slice(url.indexOf('/api/v1/public/cv/'));
    const downloaded = await request(app).get(path).expect(200);
    expect(downloaded.headers['content-type']).toContain('application/pdf');
    expect(header(downloaded, 'content-disposition')).toContain('attachment');
    expect(pdfBytes(downloaded.body).subarray(0, 5).toString()).toBe('%PDF-');

    const kept = await request(app)
      .patch('/api/v1/portal/cv')
      .set('Cookie', trainee.cookie)
      .set('X-CSRF-Token', trainee.csrf)
      .send({ visibility: 'public' })
      .expect(200);
    expect(readRecord(kept.body).reviewStatus).toBe('approved');
    expect(readRecord(kept.body).visibility).toBe('public');
  }, 60_000);
});

async function count(sql: string): Promise<number> {
  const rows: unknown = await useContainer().dataSource.query(sql);
  const countValue = readRecord(asList(rows)[0]).count;
  return typeof countValue === 'number' ? countValue : Number(countValue);
}

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

function memoryMail(current: AppContainer): MemoryMail {
  if (!(current.mail instanceof MemoryMail)) throw new Error('Expected in-memory mail.');
  return current.mail;
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
