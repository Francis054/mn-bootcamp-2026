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
const ALT = 'A labelled drawing of a banner for this test.';
const CAPTION = 'Labelled caption used only by this test case.';
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('gallery', () => {
  let container: AppContainer | undefined;
  let closeDatabase: (() => Promise<void>) | undefined;
  let databaseUrl = '';

  beforeAll(async () => {
    const database = await openTestDatabase();
    databaseUrl = database.url;
    closeDatabase = database.close;
    container = await Container.create(
      testEnv({
        databaseUrl: database.url,
        databaseSsl: false,
        logLevel: 'silent',
        uploadMaxBytes: 200,
      }),
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

  it('keeps the labelled seed off the public gallery', async () => {
    const app = appFor(useContainer());
    const response = await request(app).get('/api/v1/public/media').expect(200);
    expect(response.body).toEqual([]);
    const missing = await request(app).get('/api/v1/public/media/sample-banner').expect(404);
    expect(readError(missing.body).message).toBe('That page is not available.');
    expect(JSON.stringify(missing.body)).not.toContain('Sample image');
  });

  it('lets a viewer read the admin list and refuses their edits', async () => {
    const app = appFor(useContainer());
    await request(app).get('/api/v1/admin/media').expect(401);
    const viewer = await signIn(app, 'viewer@example.test');
    const list = await request(app)
      .get('/api/v1/admin/media')
      .set('Cookie', viewer.cookie)
      .expect(200);
    const rows = list.body as unknown;
    if (!Array.isArray(rows)) throw new Error('Expected an admin media list.');
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => readRecord(row).id)).toEqual([
      'sample-banner',
      'sample-bench',
      'sample-mark',
    ]);
    const refused = await request(app)
      .post('/api/v1/admin/media')
      .set('Cookie', viewer.cookie)
      .set('X-CSRF-Token', viewer.csrf)
      .send({ alt: ALT })
      .expect(403);
    expect(readError(refused.body).code).toBe('forbidden');
    await request(app)
      .post('/api/v1/admin/media/bulk')
      .set('Cookie', viewer.cookie)
      .set('X-CSRF-Token', viewer.csrf)
      .send({ ids: ['sample-banner'], action: 'publish' })
      .expect(404);
  });

  it('requires the CSRF token and starts a JSON photo as pending, draft, and hidden', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const blocked = await request(app)
      .post('/api/v1/admin/media')
      .set('Cookie', editor.cookie)
      .send({ alt: ALT })
      .expect(403);
    expect(readError(blocked.body).message).toBe('The security token does not match.');

    const created = await request(app)
      .post('/api/v1/admin/media')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ alt: ALT, caption: CAPTION, album: 'community' })
      .expect(201);
    const row = readRecord(created.body);
    expect(row.consent).toBe('pending');
    expect(row.publicationStatus).toBe('draft');
    expect(row.listing).toBe('hidden');
    expect(row.src).toBe('');
    expect(row.file).toBe('upload');
    expect(row).not.toHaveProperty('storageKey');
    const id = text(row.id);
    await request(app).get(`/api/v1/public/media/${id}`).expect(404);

    const extra = await request(app)
      .post('/api/v1/admin/media')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ alt: ALT, src: 'https://example.test/secret-photo.jpg', consent: 'verified' })
      .expect(422);
    expect(JSON.stringify(extra.body)).not.toContain('secret-photo');
  });

  it('does not publish when consent is verified, and refuses publish until then', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const created = await request(app)
      .post('/api/v1/admin/media')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ alt: ALT, album: 'hackathon' })
      .expect(201);
    const id = text(readRecord(created.body).id);

    const together = await request(app)
      .patch(`/api/v1/admin/media/${id}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ consent: 'verified', publicationStatus: 'published' })
      .expect(422);
    expect(readError(together.body).message).toBe('Verifying consent does not publish the photo.');

    const early = await request(app)
      .post(`/api/v1/admin/media/${id}/publish`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(422);
    expect(readError(early.body).message).toBe(
      'Verify consent before this photo can be published.',
    );

    const verified = await request(app)
      .patch(`/api/v1/admin/media/${id}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ consent: 'verified' })
      .expect(200);
    const verifiedRow = readRecord(verified.body);
    expect(verifiedRow.consent).toBe('verified');
    expect(verifiedRow.publicationStatus).toBe('draft');
    expect(verifiedRow.consentRecordedBy).toBe(editor.userId);
    expect(typeof verifiedRow.consentVerifiedAt).toBe('string');
    await request(app).get(`/api/v1/public/media/${id}`).expect(404);

    const published = await request(app)
      .post(`/api/v1/admin/media/${id}/publish`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    expect(readRecord(published.body).publicationStatus).toBe('published');
    expect(readRecord(published.body).listing).toBe('hidden');
    await request(app).get(`/api/v1/public/media/${id}`).expect(404);

    const visible = await request(app)
      .patch(`/api/v1/admin/media/${id}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ listing: 'public' })
      .expect(200);
    expect(readRecord(visible.body).listing).toBe('public');
    const publicRow = await request(app).get(`/api/v1/public/media/${id}`).expect(200);
    const shown = readRecord(publicRow.body);
    expect(shown.alt).toBe(ALT);
    expect(shown).not.toHaveProperty('consent');
    expect(shown).not.toHaveProperty('listing');
    expect(shown).not.toHaveProperty('publicationStatus');
    expect(shown).not.toHaveProperty('storageKey');

    const withdrawnFlag = await request(app)
      .patch(`/api/v1/admin/media/${id}`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .send({ consent: 'withdrawn' })
      .expect(422);
    expect(field(withdrawnFlag.body, 'consent')).toBe(
      'Use the withdrawal action to remove consent.',
    );
  });

  it('stores a sniffed upload and rejects a renamed or oversized file', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const stored = await request(app)
      .post('/api/v1/admin/media')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .field('alt', ALT)
      .field('caption', CAPTION)
      .field('album', 'anniversary')
      .attach('file', TINY_PNG, { filename: 'person-name.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const row = readRecord(stored.body);
    expect(row.file).toBe('upload');
    expect(row.width).toBe(1);
    expect(row.height).toBe(1);
    expect(row.consent).toBe('pending');
    expect(row.storageProvider).toBe('memory');
    expect(text(row.src).startsWith('memory:')).toBe(true);
    expect(JSON.stringify(row)).not.toContain('person-name');
    const memory = memoryOf(useContainer());
    const key = text(row.src).slice('memory:'.length);
    expect(memory.objects.has(key)).toBe(true);

    const fake = await request(app)
      .post('/api/v1/admin/media')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .field('alt', ALT)
      .attach('file', Buffer.from('SECRET-FILE-BYTES'), {
        filename: 'portrait.jpg',
        contentType: 'image/jpeg',
      })
      .expect(422);
    expect(field(fake.body, 'file')).toBe('Use a JPEG, PNG, or WebP image.');
    expect(JSON.stringify(fake.body)).not.toContain('SECRET-FILE-BYTES');
    expect(JSON.stringify(fake.body)).not.toContain('portrait.jpg');

    const big = await request(app)
      .post('/api/v1/admin/media')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .field('alt', ALT)
      .attach('file', Buffer.alloc(250, 1), { filename: 'large.png', contentType: 'image/png' })
      .expect(422);
    expect(field(big.body, 'file')).toBe('Use an image of at most 200 bytes.');
  });

  it('withdraws consent, deletes uploaded bytes, and leaves a static seed file in place', async () => {
    const app = appFor(useContainer());
    const editor = await signIn(app, 'editor@example.test');
    const memory = memoryOf(useContainer());
    const before = memory.objects.size;
    const stored = await request(app)
      .post('/api/v1/admin/media')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .field('alt', ALT)
      .attach('file', TINY_PNG, { filename: 'upload.png', contentType: 'image/png' })
      .expect(201);
    const id = text(readRecord(stored.body).id);
    const key = text(readRecord(stored.body).src).slice('memory:'.length);

    memory.failDeletes = true;
    const failed = await request(app)
      .post(`/api/v1/admin/media/${id}/withdraw-consent`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(500);
    expect(readError(failed.body).message).toBe(
      'Delivery removal failed. The photo is already off the public site. Try again.',
    );
    const stuck: unknown = await useContainer().dataSource.query(
      `SELECT consent, publication_status, listing, src, storage_key FROM media_assets WHERE id = $1`,
      [id],
    );
    const stuckText = JSON.stringify(stuck);
    expect(stuckText).toContain('"consent":"withdrawn"');
    expect(stuckText).toContain('"publication_status":"draft"');
    expect(stuckText).toContain('"listing":"hidden"');
    expect(stuckText).toContain('"src":""');
    expect(stuckText).toContain(key);
    expect(memory.objects.has(key)).toBe(true);
    await request(app).get(`/api/v1/public/media/${id}`).expect(404);

    memory.failDeletes = false;
    const cleared = await request(app)
      .post(`/api/v1/admin/media/${id}/withdraw-consent`)
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    expect(readRecord(cleared.body).src).toBe('');
    expect(readRecord(cleared.body).consent).toBe('withdrawn');
    expect(memory.objects.has(key)).toBe(false);
    const gone: unknown = await useContainer().dataSource.query(
      `SELECT storage_key FROM media_assets WHERE id = $1`,
      [id],
    );
    expect(JSON.stringify(gone)).toContain('"storage_key":""');

    const seeded = await request(app)
      .post('/api/v1/admin/media/sample-banner/withdraw-consent')
      .set('Cookie', editor.cookie)
      .set('X-CSRF-Token', editor.csrf)
      .expect(200);
    expect(readRecord(seeded.body).consent).toBe('withdrawn');
    expect(readRecord(seeded.body).src).toBe('');
    expect(readRecord(seeded.body).storageProvider).toBe('static');
    expect(memory.objects.size).toBe(before);
    const still = await request(app)
      .get('/api/v1/admin/media/sample-banner')
      .set('Cookie', editor.cookie)
      .expect(200);
    expect(readRecord(still.body).id).toBe('sample-banner');
  });

  it('records the change without the photo text and leaves an edited seed row alone', async () => {
    const current = useContainer();
    const rows: unknown = await current.dataSource.query('SELECT * FROM audit_events');
    const stored = JSON.stringify(rows);
    expect(stored).toContain('curriculum.media.created');
    expect(stored).toContain('curriculum.media.published');
    expect(stored).toContain('curriculum.media.unpublished');
    expect(stored).toContain('"subject_type":"media"');
    expect(stored).not.toContain(ALT);
    expect(stored).not.toContain(CAPTION);
    expect(stored).not.toContain('memory:');
    expect(stored).not.toContain('Sample image');
    expect(stored).not.toContain(PASSWORD);
    expect(stored).not.toContain('SECRET-FILE-BYTES');

    await current.dataSource.query(
      `UPDATE media_assets SET caption = $1 WHERE id = 'sample-mark'`,
      ['Edited sample caption stays'],
    );
    const before: unknown = await current.dataSource.query(
      `SELECT count(*)::int AS total FROM media_assets`,
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
    const caption: unknown = await current.dataSource.query(
      `SELECT caption FROM media_assets WHERE id = 'sample-mark'`,
    );
    expect(JSON.stringify(caption)).toContain('Edited sample caption stays');
    const after: unknown = await current.dataSource.query(
      `SELECT count(*)::int AS total FROM media_assets`,
    );
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
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

function memoryOf(container: AppContainer): MemoryStorage {
  if (!(container.storage instanceof MemoryStorage)) {
    throw new Error('The test provider is not the in-memory store.');
  }
  return container.storage;
}

function text(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('Expected text.');
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
