import request, { type Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { runSeed } from '../../src/commands/seed.js';
import type { AppContainer } from '../../src/composition/container.js';
import { AppContainer as Container } from '../../src/composition/container.js';
import { PortfolioItemEntity } from '../../src/modules/portfolio/portfolio-item.entity.js';
import { TraineeEventEntity } from '../../src/modules/progress/trainee-event.entity.js';
import { TraineeSkillEntity } from '../../src/modules/progress/trainee-skill.entity.js';
import { testEnv } from '../support/app-env.js';
import { revertOurMigrations } from '../support/migrations.js';
import { readError, readRecord } from '../support/read-json.js';
import { openTestDatabase } from '../support/test-database.js';

const PASSWORD = 'Correct-horse-1';
const EMAIL = 'journey.secret@example.test';
const OTHER_EMAIL = 'journey.other@example.test';
const REPO = 'https://example.test/journey-repo-secret';
const NOTE = 'JOURNEY-INTERNAL-NOTE';

let container: AppContainer | undefined;
let closeDatabase: (() => Promise<void>) | undefined;

describe('trainee journey', () => {
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
      email: 'editor.journey@example.test',
      password: PASSWORD,
      role: 'editor',
      displayName: 'Journey Editor',
    });
    await container.users.createUser({
      email: EMAIL,
      password: PASSWORD,
      role: 'trainee',
      displayName: 'Ama Mensah',
    });
    await container.users.createUser({
      email: OTHER_EMAIL,
      password: PASSWORD,
      role: 'trainee',
      displayName: 'Other Trainee',
    });
  });

  afterAll(async () => {
    if (container?.dataSource.isInitialized) {
      await revertOurMigrations(container.dataSource);
      await container.close();
    }
    if (closeDatabase) await closeDatabase();
  });

  it('shows only public items, and only for a published consented profile', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor.journey@example.test');
    const traineeId = await createTrainee(app, editor);
    await link(EMAIL, traineeId);
    await link(OTHER_EMAIL, await createTrainee(app, editor, 'Other Person', 'journey.roster.other@example.test'));
    await seedWork(traineeId);
    const published = await request(app)
      .post('/api/v1/admin/projects')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(projectBody({
        title: 'Published SOC lab',
        traineeIds: [traineeId],
        publicationStatus: 'published',
        listing: 'public',
        repositoryUrl: REPO,
        internalNotes: NOTE,
      }))
      .expect(201);
    const draft = await request(app)
      .post('/api/v1/admin/projects')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(projectBody({
        title: 'Unpublished journey capstone',
        traineeIds: [traineeId],
        publicationStatus: 'draft',
        listing: 'hidden',
        abstract: 'Draft abstract stays off the public journey.',
        internalNotes: NOTE,
        repositoryUrl: '',
        demoUrl: '',
      }))
      .expect(201);
    expect(readRecord(published.body).id).toBeTruthy();
    expect(readRecord(draft.body).id).toBeTruthy();

    const hidden = await request(app).get(`/api/v1/public/trainees/${traineeId}/journey`).expect(404);
    expect(readError(hidden.body).message).toBe('That page is not available.');
    expect(JSON.stringify(hidden.body)).not.toContain(EMAIL);

    await useContainer().dataSource.query(
      `UPDATE trainees
       SET consent_received = true,
           consent_received_at = '2026-10-08T00:00:00Z',
           publication_status = 'published',
           listing = 'public',
           profile_review_status = 'approved',
           profile_reviewed_at = '2026-10-07T00:00:00Z',
           slug = 'ama-mensah'
       WHERE id = $1`,
      [traineeId],
    );

    const trainee = await signIn(app, EMAIL);
    const other = await signIn(app, OTHER_EMAIL);
    const created = await request(app)
      .post('/api/v1/portal/journey/milestones')
      .set('Cookie', trainee.cookie)
      .set('X-CSRF-Token', trainee.csrf)
      .send({ title: 'Open house talk', occurredOn: '2026-10-15', visibility: 'public', summary: 'A public note.' })
      .expect(201);
    const publicId = text(readRecord(created.body).id);
    const quiet = await request(app)
      .post('/api/v1/portal/journey/milestones')
      .set('Cookie', trainee.cookie)
      .set('X-CSRF-Token', trainee.csrf)
      .send({ title: 'Quiet checkpoint', occurredOn: '2026-10-15', visibility: 'private', summary: 'A private note.' })
      .expect(201);
    const privateId = text(readRecord(quiet.body).id);

    const blocked = await request(app)
      .patch(`/api/v1/portal/journey/milestones/${privateId}`)
      .set('Cookie', other.cookie)
      .set('X-CSRF-Token', other.csrf)
      .send({ title: 'Taken' })
      .expect(404);
    expect(JSON.stringify(blocked.body)).not.toContain('Quiet checkpoint');

    const portal = await request(app).get('/api/v1/portal/journey').set('Cookie', trainee.cookie).expect(200);
    const portalText = JSON.stringify(portal.body);
    expect(portalText).toContain('Quiet checkpoint');
    expect(portalText).toContain('Draft lab secret');
    expect(portalText).toContain('Hidden skill');
    expect(portalText).toContain('Private meetup');
    expect(portalText).toContain('Unpublished journey capstone');
    expect(portalText).not.toContain(EMAIL);
    expect(portalText).not.toContain(NOTE);
    expect(portalText).not.toContain(REPO);

    const pub = await request(app).get('/api/v1/public/trainees/ama-mensah/journey').expect(200);
    expect(readRecord(pub.body).displayName).toBe('Ama Mensah');
    const pubText = JSON.stringify(pub.body);
    const titles = asList(readRecord(pub.body).items).map((item) => text(readRecord(item).title));
    expect(titles).toContain('Packet lab');
    expect(titles).toContain('Packet analysis');
    expect(titles).toContain('Local CTF');
    expect(titles).toContain('Published SOC lab');
    expect(titles).toContain('Open house talk');
    expect(titles).toContain('Signed up');
    expect(titles).toContain('Email confirmed');
    expect(titles).toContain('Profile published');
    const week = asList(readRecord(pub.body).items).map(readRecord).find((item) => item.kind === 'week');
    expect(week?.kind).toBe('week');
    expect(Array.isArray(week?.deliverables) && week.deliverables.length > 0).toBe(true);
    expect(typeof week?.href === 'string' && week.href.startsWith('/schedule?week=')).toBe(true);
    expect(pubText).not.toContain('Quiet checkpoint');
    expect(pubText).not.toContain('Draft lab secret');
    expect(pubText).not.toContain('Hidden skill');
    expect(pubText).not.toContain('Private meetup');
    expect(pubText).not.toContain('Unpublished journey capstone');
    expect(pubText).not.toContain(EMAIL);
    expect(pubText).not.toContain(NOTE);
    expect(pubText).not.toContain(REPO);
    expect(pubText).not.toContain('/admin');
    expect(pubText).not.toContain('certificateUrl');
    expect(pubText).not.toContain('internalNotes');
    expect(asList(readRecord(pub.body).items).every((item) => readRecord(item).visibility === 'public')).toBe(true);

    const otherPortal = await request(app).get('/api/v1/portal/journey').set('Cookie', other.cookie).expect(200);
    expect(JSON.stringify(otherPortal.body)).not.toContain('Quiet checkpoint');
    expect(JSON.stringify(otherPortal.body)).not.toContain('Packet lab');

    await request(app)
      .delete(`/api/v1/portal/journey/milestones/${publicId}`)
      .set('Cookie', other.cookie)
      .set('X-CSRF-Token', other.csrf)
      .expect(404);
  });

  it('requires the security token and names the field that failed', async () => {
    const app = appFor(useContainer());
    const trainee = await signIn(app, EMAIL);
    const missing = await request(app)
      .post('/api/v1/portal/journey/milestones')
      .set('Cookie', trainee.cookie)
      .send({ title: 'No token', occurredOn: '2026-10-15', visibility: 'private' })
      .expect(403);
    expect(readError(missing.body).message).toBe('The security token does not match.');

    const invalid = await request(app)
      .post('/api/v1/portal/journey/milestones')
      .set('Cookie', trainee.cookie)
      .set('X-CSRF-Token', trainee.csrf)
      .send({})
      .expect(422);
    expect(field(invalid.body, 'title')).toBe('Enter a title.');
    expect(field(invalid.body, 'occurredOn')).toBe('Pick a date.');
    expect(field(invalid.body, 'visibility')).toBe('Choose private or public.');

    const saved = await request(app)
      .post('/api/v1/portal/journey/milestones')
      .set('Cookie', trainee.cookie)
      .set('X-CSRF-Token', trainee.csrf)
      .send({ title: 'Edited later', occurredOn: '2026-10-20', visibility: 'private' })
      .expect(201);
    const id = text(readRecord(saved.body).id);
    const renamed = await request(app)
      .patch(`/api/v1/portal/journey/milestones/${id}`)
      .set('Cookie', trainee.cookie)
      .set('X-CSRF-Token', trainee.csrf)
      .send({ visibility: 'public', title: 'Now public' })
      .expect(200);
    expect(readRecord(renamed.body).visibility).toBe('public');
    const gone = await request(app)
      .delete(`/api/v1/portal/journey/milestones/${id}`)
      .set('Cookie', trainee.cookie)
      .set('X-CSRF-Token', trainee.csrf)
      .expect(200);
    expect(readRecord(gone.body).id).toBe(id);
  });
});

async function seedWork(traineeId: string): Promise<void> {
  const db = useContainer().dataSource;
  const labs = db.getRepository(PortfolioItemEntity);
  await labs.save(labs.create({
    traineeId,
    kind: 'lab',
    title: 'Packet lab',
    summary: 'A published lab.',
    reviewStatus: 'approved',
    skills: [],
    completedOn: '2026-10-16',
    reviewedAt: new Date('2026-10-17T00:00:00Z'),
  }));
  await labs.save(labs.create({
    traineeId,
    kind: 'lab',
    title: '',
    summary: '',
    reviewStatus: 'draft',
    skills: [],
    hasPending: true,
    pendingKind: 'lab',
    pendingTitle: 'Draft lab secret',
    pendingSummary: 'Keep this draft off the public page.',
  }));
  const skills = db.getRepository(TraineeSkillEntity);
  await skills.save(skills.create({
    traineeId,
    slug: 'packet-analysis',
    reviewStatus: 'approved',
    name: 'Packet analysis',
    level: 3,
    reviewedAt: new Date('2026-10-18T00:00:00Z'),
  }));
  await skills.save(skills.create({
    traineeId,
    slug: 'hidden-skill',
    reviewStatus: 'draft',
    name: 'Hidden skill',
    level: 1,
  }));
  const events = db.getRepository(TraineeEventEntity);
  await events.save(events.create({
    traineeId,
    reviewStatus: 'approved',
    title: 'Local CTF',
    eventDate: '2026-11-02',
    organiser: 'Accra Sec',
    reviewedAt: new Date('2026-11-03T00:00:00Z'),
  }));
  await events.save(events.create({
    traineeId,
    reviewStatus: 'draft',
    title: 'Private meetup',
    eventDate: '2026-11-04',
    organiser: 'Friends',
  }));
}

function projectBody(overrides: Record<string, unknown>) {
  return {
    title: 'Journey project title here',
    type: 'Lab',
    abstract: 'A published project abstract for the cohort page.',
    moduleId: 'network',
    tools: 'A labelled tool list.',
    steps: ['Scope and plan', 'Build and test'],
    team: ['Ama Mensah'],
    repositoryUrl: '',
    demoUrl: '',
    labOnlyConfirmed: true,
    shareAgreed: false,
    publicationStatus: 'draft',
    listing: 'hidden',
    internalNotes: '',
    ...overrides,
  };
}

async function createTrainee(app: ReturnType<typeof appFor>, editor: Session, displayName = 'Ama Mensah', email = EMAIL): Promise<string> {
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
    `UPDATE users SET trainee_id = $1, email_verified_at = '2026-10-02T00:00:00Z' WHERE email = $2`,
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
