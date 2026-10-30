import { type Response } from 'supertest';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSeed } from '../../src/commands/seed.js';
import { createApp } from '../../src/app.js';
import type { AppContainer } from '../../src/composition/container.js';
import { AppContainer as Container } from '../../src/composition/container.js';
import { REPOSITORY_LINK_NOTE } from '../../src/modules/projects/visibility.js';
import { revertOurMigrations } from '../support/migrations.js';
import { testEnv } from '../support/app-env.js';
import { readError, readRecord } from '../support/read-json.js';
import { openTestDatabase } from '../support/test-database.js';

const PASSWORD = 'Correct-horse-1';
const TITLE = 'Link consent project title';
const DEMO = 'https://example.test/labelled-demo';
const REPO = 'https://example.test/labelled-repo';
const NOTE = 'PRIVATE-PROJECT-NOTE';
const TEAM = 'Team Placeholder Label';
const GITHUB = 'https://github.com/example/labelled-missing';
const GITHUB_DEMO = 'https://example.test/github-demo';
const SECRET = 's3cret-token';
const TRAINEE_EMAIL = 'link.consent@example.test';
const TRAINEE_NAME = 'Link Consent Person';
const ABSTRACT = 'A labelled project used only by this test case.';

describe('projects', () => {
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
    const response = await request(app).get('/api/v1/public/projects').expect(200);
    expect(response.body).toEqual([]);
    const missing = await request(app).get('/api/v1/public/projects/1').expect(404);
    expect(readError(missing.body).message).toBe('That page is not available.');
    expect(JSON.stringify(missing.body)).not.toContain('Home network');
  });

  it('lets a viewer read the admin list and refuses their edits', async () => {
    const app = appFor(useContainer());
    await request(app).get('/api/v1/admin/projects').expect(401);
    const viewer = await signIn(app, 'viewer@example.test');
    const list = await request(app)
      .get('/api/v1/admin/projects')
      .query({ sort: 'title', pageSize: '20' })
      .set('Cookie', viewer.cookie)
      .expect(200);
    expect(readRecord(list.body).total).toBe(6);
    expect(JSON.stringify(list.body)).toContain('Home network hardening lab');
    const refused = await request(app)
      .post('/api/v1/admin/projects')
      .set('Cookie', viewer.cookie)
      .set('X-CSRF-Token', viewer.csrf)
      .send(projectBody())
      .expect(403);
    expect(readError(refused.body).code).toBe('forbidden');
  });

  it('requires the CSRF token and rejects a link that is not a public https address', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const blocked = await request(app)
      .post('/api/v1/admin/projects')
      .set('Cookie', editor.cookie)
      .send(projectBody())
      .expect(403);
    expect(readError(blocked.body).message).toBe('The security token does not match.');

    const type = await request(app)
      .post('/api/v1/admin/projects')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(projectBody({ type: 'Homework' }))
      .expect(422);
    expect(field(type.body, 'type')).toBe('Choose a type.');

    const http = await request(app)
      .post('/api/v1/admin/projects')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(projectBody({ demoUrl: 'http://example.test/demo' }))
      .expect(422);
    expect(field(http.body, 'demoUrl')).toBe('Enter a full link starting with https://.');

    const script = await request(app)
      .post('/api/v1/admin/projects')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(projectBody({ repositoryUrl: 'javascript:alert(1)' }))
      .expect(422);
    expect(field(script.body, 'repositoryUrl')).toBe('Enter a full link starting with https://.');

    const credentials = await request(app)
      .post('/api/v1/admin/projects')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(projectBody({ repositoryUrl: `https://user:${SECRET}@example.test/repo` }))
      .expect(422);
    expect(field(credentials.body, 'repositoryUrl')).toBe(
      'Enter a full link starting with https://.',
    );
    expect(JSON.stringify(credentials.body)).not.toContain(SECRET);

    const privateHost = await request(app)
      .post('/api/v1/admin/projects')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(projectBody({ demoUrl: 'https://10.1.1.1/lab' }))
      .expect(422);
    expect(field(privateHost.body, 'demoUrl')).toBe('Use a public https address.');

    const sort = await request(app)
      .get('/api/v1/admin/projects')
      .query({ sort: 'password' })
      .set('Cookie', editor.cookie)
      .expect(422);
    expect(field(sort.body, 'sort')).toBe(
      'Sort by title, type, moduleId, publicationStatus, or updatedAt.',
    );

    const filter = await request(app)
      .get('/api/v1/admin/projects')
      .query({ 'filters.type': 'Homework' })
      .set('Cookie', editor.cookie)
      .expect(422);
    expect(field(filter.body, 'filters.type')).toBe('Choose a type.');
  });

  it('shows code and demo links only while every linked trainee agrees', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const trainee = await request(app)
      .post('/api/v1/admin/trainees')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(traineeBody())
      .expect(201);
    const traineeId = text(readRecord(trainee.body).id, 'Expected a trainee id.');

    const created = await request(app)
      .post('/api/v1/admin/projects')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(
        projectBody({
          traineeIds: [traineeId],
          shareAgreed: true,
          publicationStatus: 'published',
          listing: 'public',
        }),
      )
      .expect(201);
    const project = readRecord(created.body);
    const projectId = text(project.id, 'Expected a project id.');
    expect(project.shareAgreed).toBe(true);
    expect(project.repositoryUrl).toBe(REPO);
    expect(project.demoUrl).toBe(DEMO);
    expect(project.repositoryLinkNote).toBeNull();

    const hiddenLinks = await request(app).get(`/api/v1/public/projects/${projectId}`).expect(200);
    expect(JSON.stringify(hiddenLinks.body)).not.toContain(DEMO);
    expect(JSON.stringify(hiddenLinks.body)).not.toContain(REPO);
    expect(JSON.stringify(hiddenLinks.body)).not.toContain(NOTE);
    expect(JSON.stringify(hiddenLinks.body)).not.toContain('shareAgreed');
    expect(JSON.stringify(hiddenLinks.body)).not.toContain('traineeIds');
    expect(readRecord(hiddenLinks.body).publicationStatus).toBe('published');

    const agreed = await request(app)
      .patch(`/api/v1/admin/trainees/${traineeId}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ linksShareConsent: true })
      .expect(200);
    const agreedRow = readRecord(agreed.body);
    expect(agreedRow.linksShareConsent).toBe(true);
    expect(agreedRow.linksShareConsentRecordedBy).toBe(editor.userId);
    expect(typeof agreedRow.linksShareConsentAt).toBe('string');
    expect(agreedRow.publicationStatus).toBe('published');

    const visible = await request(app).get(`/api/v1/public/projects/${projectId}`).expect(200);
    expect(readRecord(visible.body).demoUrl).toBe(DEMO);
    expect(readRecord(visible.body).repositoryUrl).toBe(REPO);

    const withHoldout = await request(app)
      .patch(`/api/v1/admin/projects/${projectId}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ traineeIds: [traineeId, '1'] })
      .expect(200);
    expect(readRecord(withHoldout.body).repositoryUrl).toBe(REPO);
    const held = await request(app).get(`/api/v1/public/projects/${projectId}`).expect(200);
    expect(JSON.stringify(held.body)).not.toContain(DEMO);
    expect(JSON.stringify(held.body)).not.toContain(REPO);

    await request(app)
      .patch(`/api/v1/admin/projects/${projectId}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ traineeIds: [traineeId] })
      .expect(200);

    const withdrawn = await request(app)
      .patch(`/api/v1/admin/trainees/${traineeId}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ linksShareConsent: false })
      .expect(200);
    const after = readRecord(withdrawn.body);
    expect(after.linksShareConsent).toBe(false);
    expect(typeof after.linksShareConsentWithdrawnAt).toBe('string');
    expect(after.publicationStatus).toBe('published');

    const admin = await request(app)
      .get(`/api/v1/admin/projects/${projectId}`)
      .set('Cookie', editor.cookie)
      .expect(200);
    const stored = readRecord(admin.body);
    expect(stored.publicationStatus).toBe('published');
    expect(stored.listing).toBe('public');
    expect(stored.repositoryUrl).toBe(REPO);
    expect(stored.demoUrl).toBe(DEMO);
    const gone = await request(app).get(`/api/v1/public/projects/${projectId}`).expect(200);
    expect(JSON.stringify(gone.body)).not.toContain(DEMO);
    expect(JSON.stringify(gone.body)).not.toContain(REPO);
  });

  it('omits a GitHub repository that does not answer 200 and keeps the demo', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const trainee = await request(app)
      .post('/api/v1/admin/trainees')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(
        traineeBody({
          email: 'github.consent@example.test',
          displayName: 'GitHub Consent Person',
          linksShareConsent: true,
        }),
      )
      .expect(201);
    const traineeId = text(readRecord(trainee.body).id, 'Expected a trainee id.');

    const created = await withMissingGithub(() =>
      request(app)
        .post('/api/v1/admin/projects')
        .set('Cookie', editor.cookie)
        .set('X-CSRF-Token', editor.csrf)
        .send(
          projectBody({
            title: 'GitHub visibility project title',
            traineeIds: [traineeId],
            repositoryUrl: GITHUB,
            demoUrl: GITHUB_DEMO,
            publicationStatus: 'published',
            listing: 'public',
            shareAgreed: false,
          }),
        )
        .expect(201),
    );
    const projectId = text(readRecord(created.body).id, 'Expected a project id.');
    expect(readRecord(created.body).repositoryLinkNote).toBe(REPOSITORY_LINK_NOTE);

    const listed = await request(app)
      .get('/api/v1/admin/projects')
      .query({ q: 'GitHub visibility', pageSize: '20' })
      .set('Cookie', editor.cookie)
      .expect(200);
    const items = readRecord(listed.body).items;
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Expected the GitHub project on the admin list.');
    }
    expect(readRecord(items[0]).repositoryLinkNote).toBeNull();

    const detail = await withMissingGithub(() =>
      request(app)
        .get(`/api/v1/admin/projects/${projectId}`)
        .set('Cookie', editor.cookie)
        .expect(200),
    );
    expect(readRecord(detail.body).repositoryLinkNote).toBe(REPOSITORY_LINK_NOTE);
    expect(readRecord(detail.body).repositoryUrl).toBe(GITHUB);

    const visible = await withMissingGithub(() =>
      request(app).get(`/api/v1/public/projects/${projectId}`).expect(200),
    );
    const body = readRecord(visible.body);
    expect(body.demoUrl).toBe(GITHUB_DEMO);
    expect(body.repositoryUrl).toBeUndefined();
    expect(JSON.stringify(visible.body)).not.toContain(GITHUB);
  });

  it('keeps a hidden project off the public site after publish', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const created = await request(app)
      .post('/api/v1/admin/projects')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(
        projectBody({
          title: 'Hidden listing project title',
          publicationStatus: 'draft',
          listing: 'hidden',
          repositoryUrl: '',
          demoUrl: '',
        }),
      )
      .expect(201);
    const projectId = text(readRecord(created.body).id, 'Expected a project id.');
    const published = await request(app)
      .post(`/api/v1/admin/projects/${projectId}/publish`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    expect(readRecord(published.body).publicationStatus).toBe('published');
    expect(readRecord(published.body).listing).toBe('hidden');
    const missing = await request(app).get(`/api/v1/public/projects/${projectId}`).expect(404);
    expect(readError(missing.body).message).toBe('That page is not available.');

    const labs = await request(app)
      .get('/api/v1/admin/projects')
      .query({ 'filters.type': 'Lab', pageSize: '20' })
      .set('Cookie', editor.cookie)
      .expect(200);
    const items = readRecord(labs.body).items;
    if (!Array.isArray(items)) throw new Error('Expected a page of projects.');
    expect(items.every((item) => readRecord(item).type === 'Lab')).toBe(true);
  });

  it('refuses to delete a module or a trainee that a project still uses', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    await request(app)
      .post('/api/v1/admin/modules')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({
        id: 'project-extra',
        name: 'Project extra module',
        short: 'Extra',
        icon: 'terminal',
        summary: 'A labelled module used only by this test.',
        publicationStatus: 'draft',
        listing: 'hidden',
      })
      .expect(201);
    const created = await request(app)
      .post('/api/v1/admin/projects')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send(
        projectBody({
          title: 'Module block project title',
          moduleId: 'project-extra',
          publicationStatus: 'draft',
          listing: 'hidden',
          repositoryUrl: '',
          demoUrl: '',
          internalNotes: '',
          team: [],
        }),
      )
      .expect(201);
    const projectId = text(readRecord(created.body).id, 'Expected a project id.');
    const blockedModule = await request(app)
      .delete('/api/v1/admin/modules/project-extra')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(422);
    expect(readError(blockedModule.body).message).toBe(
      'That module still has projects. Move or delete those projects first.',
    );
    const blockedTrainee = await request(app)
      .delete('/api/v1/admin/trainees/1')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(422);
    expect(readError(blockedTrainee.body).message).toBe(
      'That trainee is still listed on a project. Remove them there first.',
    );
    await request(app)
      .delete(`/api/v1/admin/projects/${projectId}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    await request(app)
      .delete('/api/v1/admin/modules/project-extra')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
  });

  it('records the change without the project text', async () => {
    const rows: unknown = await useContainer().dataSource.query('SELECT * FROM audit_events');
    const stored = JSON.stringify(rows);
    expect(stored).toContain('curriculum.project.created');
    expect(stored).toContain('curriculum.project.published');
    expect(stored).toContain('curriculum.project.updated');
    expect(stored).toContain('curriculum.project.deleted');
    expect(stored).toContain('"subject_type":"project"');
    expect(stored).not.toContain(TITLE);
    expect(stored).not.toContain(DEMO);
    expect(stored).not.toContain(REPO);
    expect(stored).not.toContain(NOTE);
    expect(stored).not.toContain(TEAM);
    expect(stored).not.toContain(GITHUB);
    expect(stored).not.toContain(SECRET);
    expect(stored).not.toContain(PASSWORD);
    expect(stored).not.toContain(TRAINEE_EMAIL);
    expect(stored).not.toContain(TRAINEE_NAME);
    expect(stored).not.toContain('Sample Trainee');
    expect(stored).not.toContain('Sample project');
    expect(stored).not.toContain(REPOSITORY_LINK_NOTE);
  });

  it('loads the sample seed again without overwriting a project', async () => {
    const current = useContainer();
    await current.dataSource.query(`UPDATE projects SET title = $1 WHERE id = '1'`, [
      'Edited sample project stays',
    ]);
    const before: unknown = await current.dataSource.query(
      `SELECT count(*)::int AS total FROM projects`,
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
      `SELECT title FROM projects WHERE id = '1'`,
    );
    expect(JSON.stringify(stored)).toContain('Edited sample project stays');
    const after: unknown = await current.dataSource.query(
      `SELECT count(*)::int AS total FROM projects`,
    );
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });

  function useContainer(): AppContainer {
    if (!container) throw new Error('The test database was not opened.');
    return container;
  }
});

function projectBody(overrides: Record<string, unknown> = {}) {
  return {
    title: TITLE,
    type: 'Lab',
    abstract: ABSTRACT,
    moduleId: 'network',
    tools: 'A labelled tool list.',
    steps: ['Scope and plan', 'Build and test'],
    team: [TEAM],
    repositoryUrl: REPO,
    demoUrl: DEMO,
    labOnlyConfirmed: true,
    shareAgreed: false,
    publicationStatus: 'draft',
    listing: 'hidden',
    internalNotes: NOTE,
    ...overrides,
  };
}

function traineeBody(overrides: Record<string, unknown> = {}) {
  return {
    displayName: TRAINEE_NAME,
    email: TRAINEE_EMAIL,
    track: 'GRC & Awareness',
    focus: 'awareness',
    skills: ['Policy writing'],
    bio: 'A labelled profile used only by this test.',
    quote: 'A labelled quote.',
    linkedin: '',
    portfolio: '',
    consentReceived: true,
    linksShareConsent: false,
    listing: 'hidden',
    publicationStatus: 'published',
    statusLabel: 'In training',
    internalNotes: '',
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

function text(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(message);
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

async function withMissingGithub<T>(body: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response(null, { status: 404 }));
  try {
    return await body();
  } finally {
    globalThis.fetch = original;
  }
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
