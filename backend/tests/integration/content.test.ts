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
const HEADLINE = 'Learn.\nBuild.\n*Secure the Future.*';
const BANNER = 'Hackathon details to be confirmed — check back soon';
const MISSION =
  'To create career perspectives for young people with the use of information technology.';
const EMAIL = 'mninfo@maximnyansa.com';

describe('content singletons', () => {
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
    await container.users.createUser({
      email: 'administrator@example.test',
      password: PASSWORD,
      role: 'administrator',
      displayName: 'Ada Admin',
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

  it('keeps drafts off the public site', async () => {
    const app = appFor(useContainer());
    const home = await request(app).get('/api/v1/public/home').expect(404);
    expect(readError(home.body).message).toBe('That page is not available.');
    expect(JSON.stringify(home.body)).not.toContain('Secure the Future');
    await request(app).get('/api/v1/public/about').expect(404);
    const milestones = await request(app).get('/api/v1/public/milestones').expect(200);
    expect(milestones.body).toEqual([]);
    const stats = await request(app).get('/api/v1/public/foundation-stats').expect(200);
    expect(stats.body).toEqual([]);
    const enquiry = await request(app)
      .post('/api/v1/public/enquiries')
      .send({ name: 'Ada' })
      .expect(422);
    expect(readError(enquiry.body).code).toBe('validation');
  });

  it('lets a viewer read the homepage draft and refuses settings', async () => {
    const app = appFor(useContainer());
    await request(app).get('/api/v1/admin/home').expect(401);
    await request(app).get('/api/v1/admin/settings').expect(401);
    const viewer = await signIn(app, 'viewer@example.test');
    const home = await request(app)
      .get('/api/v1/admin/home')
      .set('Cookie', viewer.cookie)
      .expect(200);
    expect(readRecord(home.body).headline).toBe(HEADLINE);
    expect(readRecord(home.body).publicationStatus).toBe('draft');
    expect(readRecord(home.body).showAnnouncement).toBe(false);
    const refused = await request(app)
      .put('/api/v1/admin/home')
      .set('Cookie', viewer.cookie)
      .set('X-CSRF-Token', viewer.csrf)
      .send({ eyebrow: 'Changed by a viewer' })
      .expect(403);
    expect(readError(refused.body).code).toBe('forbidden');
    const settings = await request(app)
      .get('/api/v1/admin/settings')
      .set('Cookie', viewer.cookie)
      .expect(403);
    expect(readError(settings.body).code).toBe('forbidden');
  });

  it('publishes the homepage only from the publish action, and keeps the banner on that document', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const blocked = await request(app)
      .put('/api/v1/admin/home')
      .set('Cookie', editor.cookie)
      .send({ announcement: 'Banner that should not save' })
      .expect(403);
    expect(readError(blocked.body).message).toBe('The security token does not match.');

    const edited = await request(app)
      .put('/api/v1/admin/home')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ announcement: 'Sample banner for this test', showAnnouncement: true })
      .expect(200);
    expect(readRecord(edited.body).announcement).toBe('Sample banner for this test');
    expect(readRecord(edited.body).showAnnouncement).toBe(true);
    expect(readRecord(edited.body).publicationStatus).toBe('draft');
    expect(readRecord(edited.body).headline).toBe(HEADLINE);
    await request(app).get('/api/v1/public/home').expect(404);

    const ignored = await request(app)
      .put('/api/v1/admin/home')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ publicationStatus: 'published' })
      .expect(200);
    expect(readRecord(ignored.body).publicationStatus).toBe('draft');

    const published = await request(app)
      .post('/api/v1/admin/home/publish')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    expect(readRecord(published.body).publicationStatus).toBe('published');
    const live = await request(app).get('/api/v1/public/home').expect(200);
    const shown = readRecord(live.body);
    expect(shown.announcement).toBe('Sample banner for this test');
    expect(shown.showAnnouncement).toBe(true);
    expect(shown).not.toHaveProperty('publicationStatus');

    const drafted = await request(app)
      .put('/api/v1/admin/home')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ headline: 'Draft headline stays in preview' })
      .expect(200);
    expect(readRecord(drafted.body).headline).toBe('Draft headline stays in preview');
    const still = await request(app).get('/api/v1/public/home').expect(200);
    expect(readRecord(still.body).headline).toBe(HEADLINE);

    await request(app)
      .post('/api/v1/admin/home/publish')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    const next = await request(app).get('/api/v1/public/home').expect(200);
    expect(readRecord(next.body).headline).toBe('Draft headline stays in preview');

    await request(app)
      .post('/api/v1/admin/home/unpublish')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    const hidden = await request(app).get('/api/v1/public/home').expect(404);
    expect(JSON.stringify(hidden.body)).not.toContain('Draft headline');
  });

  it('keeps an omitted about address and does not publish counters from figures permission', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const saved = await request(app)
      .put('/api/v1/admin/about')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ mission: 'Sample mission for this test.', figuresPermission: true })
      .expect(200);
    const about = readRecord(saved.body);
    expect(about.mission).toBe('Sample mission for this test.');
    expect(about.address).toBe('Coral Avenue – Tantra Hills, Accra, Ghana');
    expect(about.email).toBe(EMAIL);
    expect(about.figuresPermission).toBe(true);
    expect(about.publicationStatus).toBe('draft');
    const stats = await request(app).get('/api/v1/public/foundation-stats').expect(200);
    expect(stats.body).toEqual([]);
  });

  it('reorders the timeline without publishing it', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const current = await request(app)
      .get('/api/v1/admin/milestones')
      .set('Cookie', editor.cookie)
      .expect(200);
    const rows = asList(current.body);
    const reversed = rows.slice().reverse();
    const saved = await request(app)
      .put('/api/v1/admin/milestones')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ milestones: reversed })
      .expect(200);
    const stored = asList(saved.body);
    const first = stored[0];
    if (first === undefined) throw new Error('Expected the saved timeline.');
    expect(readRecord(first).id).toBe('y2026');
    const live = await request(app).get('/api/v1/public/milestones').expect(200);
    expect(live.body).toEqual([]);
    await request(app)
      .post('/api/v1/admin/milestones/publish')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    const published = await request(app).get('/api/v1/public/milestones').expect(200);
    const publicRows = asList(published.body);
    const firstPublic = publicRows[0];
    if (firstPublic === undefined) throw new Error('Expected a public timeline.');
    expect(readRecord(firstPublic).id).toBe('y2026');
    expect(readRecord(firstPublic)).not.toHaveProperty('publicationStatus');
  });

  it('lets an administrator publish labelled counters and refuses an editor', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    await request(app).get('/api/v1/admin/settings').set('Cookie', editor.cookie).expect(403);
    const admin = await signIn(app, 'administrator@example.test');
    const loaded = await request(app)
      .get('/api/v1/admin/settings')
      .set('Cookie', admin.cookie)
      .expect(200);
    const draft = readRecord(loaded.body);
    expect(draft.publicationStatus).toBe('draft');
    const stats = asList(draft.foundationStats);
    expect(stats).toHaveLength(4);
    expect(stats.every((item) => readRecord(item).value === 0)).toBe(true);
    expect(JSON.stringify(stats)).toContain('Sample counter');
    expect(JSON.stringify(stats)).not.toContain('76000');
    expect(JSON.stringify(stats)).not.toContain('173');

    const bad = await request(app)
      .put('/api/v1/admin/settings')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .send({ contactEmail: 'not-an-email' })
      .expect(422);
    expect(field(bad.body, 'contactEmail')).toBe(
      'Enter a valid email address, like name@example.com.',
    );
    expect(JSON.stringify(bad.body)).not.toContain('not-an-email');

    const renamed = await request(app)
      .put('/api/v1/admin/settings')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .send({
        siteName: 'Sample site name',
        foundationStats: [
          { id: 'schools', label: 'Sample counter — school projects', value: 4, suffix: '' },
        ],
      })
      .expect(200);
    expect(readRecord(renamed.body).siteName).toBe('Sample site name');
    expect(readRecord(renamed.body).contactEmail).toBe(EMAIL);
    await request(app).get('/api/v1/public/foundation-stats').expect(200).expect([]);

    await request(app)
      .post('/api/v1/admin/settings/publish')
      .set('Cookie', admin.cookie)
      .set('X-CSRF-Token', admin.csrf)
      .expect(200);
    const live = await request(app).get('/api/v1/public/foundation-stats').expect(200);
    const liveStats = asList(live.body);
    expect(liveStats).toHaveLength(1);
    expect(readRecord(liveStats[0]).value).toBe(4);
    expect(JSON.stringify(live.body)).not.toContain(EMAIL);
    expect(JSON.stringify(live.body)).not.toContain('76000');
  });

  it('records the change without the page text and leaves an edited seed row alone', async () => {
    const current = useContainer();
    const rows: unknown = await current.dataSource.query('SELECT * FROM audit_events');
    const stored = JSON.stringify(rows);
    expect(stored).toContain('curriculum.homepage.published');
    expect(stored).toContain('curriculum.about.updated');
    expect(stored).toContain('curriculum.milestone.published');
    expect(stored).toContain('curriculum.settings.published');
    expect(stored).not.toContain(BANNER);
    expect(stored).not.toContain('Sample banner for this test');
    expect(stored).not.toContain(MISSION);
    expect(stored).not.toContain(EMAIL);
    expect(stored).not.toContain('Sample counter');
    expect(stored).not.toContain(PASSWORD);
    expect(stored).not.toContain('76000');

    await current.dataSource.query(
      `UPDATE content_singletons SET draft = jsonb_set(draft, '{eyebrow}', '"Edited sample eyebrow stays"') WHERE id = 'homepage'`,
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
    expect(stdout).toEqual(['Sample curriculum is ready.']);
    const eyebrow: unknown = await current.dataSource.query(
      `SELECT draft->>'eyebrow' AS eyebrow FROM content_singletons WHERE id = 'homepage'`,
    );
    expect(JSON.stringify(eyebrow)).toContain('Edited sample eyebrow stays');
    const count: unknown = await current.dataSource.query(
      `SELECT count(*)::int AS total FROM content_singletons`,
    );
    expect(JSON.stringify(count)).toContain('"total":4');
  });

  function useContainer(): AppContainer {
    if (!container) throw new Error('The test database was not opened.');
    return container;
  }
});

function appFor(container: AppContainer) {
  return createApp({
    env: container.env,
    logger: container.logger,
    health: container.health,
    authRouter: container.authRouter,
    curriculumRouter: container.curriculumRouter,
  });
}

function asList(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected a list.');
  return value.map((entry) => {
    const item: unknown = entry;
    return item;
  });
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
