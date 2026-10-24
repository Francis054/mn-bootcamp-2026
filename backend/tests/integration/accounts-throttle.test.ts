import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { AppContainer } from '../../src/composition/container.js';
import { AppContainer as Container } from '../../src/composition/container.js';
import { MemoryMail } from '../../src/modules/mail/memory-mail.js';
import { TOO_MANY_REQUESTS } from '../../src/modules/auth/login-throttle.js';
import { revertOurMigrations } from '../support/migrations.js';
import { testEnv } from '../support/app-env.js';
import { readError } from '../support/read-json.js';
import { openTestDatabase } from '../support/test-database.js';

const PASSWORD = 'Correct-horse-1';
const RESET_BODY = {
  accepted: true,
  delivered: false,
  message: 'If an account exists for that address, a reset message will be sent.',
};

describe('reset and enquiry rate limits', () => {
  let container: AppContainer | undefined;
  let closeDatabase: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    const database = await openTestDatabase();
    closeDatabase = database.close;
    container = await Container.create(
      testEnv({
        databaseUrl: database.url,
        databaseSsl: false,
        logLevel: 'silent',
        loginFailureLimit: 2,
        loginIpFailureLimit: 30,
      }),
    );
    await container.dataSource.runMigrations();
    await container.users.createUser({
      email: 'known@example.test',
      password: PASSWORD,
      role: 'viewer',
      displayName: 'Known Person',
    });
  });

  afterAll(async () => {
    if (container?.dataSource.isInitialized) {
      await revertOurMigrations(container.dataSource);
      await container.close();
    }
    if (closeDatabase) await closeDatabase();
  });

  it('limits reset requests without saying whether the mailbox exists', async () => {
    const app = appFor(useContainer());
    const unknown = await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'missing@example.test' })
      .expect(200);
    const known = await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'known@example.test' })
      .expect(200);
    expect(unknown.body).toEqual(RESET_BODY);
    expect(known.body).toEqual(RESET_BODY);
    const lockedKnown = await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'known@example.test' })
      .expect(429);
    const lockedUnknown = await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'missing@example.test' })
      .expect(429);
    expect(readError(lockedKnown.body).message).toBe(TOO_MANY_REQUESTS);
    expect(readError(lockedUnknown.body).message).toBe(TOO_MANY_REQUESTS);
    expect(JSON.stringify(lockedKnown.body)).not.toContain('known@example.test');
    expect(JSON.stringify(lockedUnknown.body)).not.toContain('missing@example.test');
    const mail = useContainer().mail;
    if (!(mail instanceof MemoryMail)) throw new Error('Expected in-memory mail.');
    expect(mail.sent.filter((item) => item.to === 'known@example.test')).toHaveLength(1);
    expect(mail.sent.filter((item) => item.to === 'missing@example.test')).toHaveLength(0);
  });

  it('limits enquiry posts from one address', async () => {
    const app = appFor(useContainer());
    const body = {
      name: 'Ada',
      email: 'ada@example.test',
      topic: 'The 2026 bootcamp',
      message: 'Please tell me about the sample bootcamp week.',
      consent: true,
    };
    await request(app).post('/api/v1/public/enquiries').send(body).expect(200);
    const locked = await request(app).post('/api/v1/public/enquiries').send(body).expect(429);
    expect(readError(locked.body).message).toBe(TOO_MANY_REQUESTS);
    expect(JSON.stringify(locked.body)).not.toContain('sample bootcamp week');
  });

  function useContainer(): AppContainer {
    if (!container) throw new Error('The test database is not open.');
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
