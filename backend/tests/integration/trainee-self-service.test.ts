import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { AppContainer } from '../../src/composition/container.js';
import { AppContainer as Container } from '../../src/composition/container.js';
import { TRAINEE_SIGN_IN_OFF, TRAINEE_SIGN_UP_OFF } from '../../src/modules/trainee-auth/signup.rules.js';
import { UserEntity } from '../../src/modules/users/user.entity.js';
import { testEnv } from '../support/app-env.js';
import { revertOurMigrations } from '../support/migrations.js';
import { readRecord } from '../support/read-json.js';
import { openTestDatabase } from '../support/test-database.js';

const PASSWORD = 'Correct-horse-1';
const ADMIN_EMAIL = 'staff-closed@example.test';
const TRAINEE_EMAIL = 'trainee-closed@example.test';

let container: AppContainer | undefined;
let closeDatabase: (() => Promise<void>) | undefined;

describe('trainee self-service switched off', () => {

  beforeAll(async () => {
    const database = await openTestDatabase();
    closeDatabase = database.close;
    container = await Container.create(
      testEnv({
        databaseUrl: database.url,
        databaseSsl: false,
        logLevel: 'silent',
        traineeSelfService: false,
      }),
    );
    await container.dataSource.runMigrations();
    await container.users.createUser({
      email: ADMIN_EMAIL,
      password: PASSWORD,
      role: 'administrator',
      displayName: 'Ada Admin',
    });
    await container.users.createUser({
      email: TRAINEE_EMAIL,
      password: PASSWORD,
      role: 'trainee',
      displayName: 'Closed Trainee',
    });
  });

  afterAll(async () => {
    if (container?.dataSource.isInitialized) {
      await revertOurMigrations(container.dataSource);
      await container.close();
    }
    if (closeDatabase) await closeDatabase();
  });

  it('answers 404 for trainee sign-up and does not store the registration', async () => {
    const current = useContainer();
    const response = await request(appFor(current))
      .post('/api/v1/public/trainee-signup')
      .send({
        email: 'new-trainee@example.test',
        password: PASSWORD,
        confirm: PASSWORD,
        displayName: 'New Person',
        acceptTerms: true,
      })
      .expect(404);
    expect(readRecord(response.body).error).toMatchObject({
      code: 'not_found',
      message: TRAINEE_SIGN_UP_OFF,
    });
    expect(JSON.stringify(response.body)).not.toContain(PASSWORD);
    const pending: unknown = await current.dataSource.query(
      `SELECT email FROM pending_registrations WHERE email = $1`,
      ['new-trainee@example.test'],
    );
    expect(pending).toEqual([]);
  });

  it('refuses a correct trainee password, keeps a wrong password quiet, and still signs staff in', async () => {
    const current = useContainer();
    const app = appFor(current);
    const closed = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TRAINEE_EMAIL, password: PASSWORD })
      .expect(403);
    expect(readRecord(closed.body).error).toMatchObject({
      code: 'TRAINEE_SELF_SERVICE_DISABLED',
      message: TRAINEE_SIGN_IN_OFF,
    });
    expect(JSON.stringify(closed.body)).not.toContain(PASSWORD);

    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TRAINEE_EMAIL, password: 'Wrong-password-1' })
      .expect(401);
    expect(JSON.stringify(wrong.body)).not.toContain('TRAINEE_SELF_SERVICE_DISABLED');

    const staff = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: PASSWORD })
      .expect(200);
    expect(readRecord(readRecord(staff.body).user).role).toBe('administrator');

    const trainee = await current.dataSource.getRepository(UserEntity).findOneByOrFail({ email: TRAINEE_EMAIL });
    const started = await current.sessions.start(trainee, new Date());
    expect(await current.sessions.authenticate(started.token, new Date())).toBeNull();
    const admin = await current.dataSource.getRepository(UserEntity).findOneByOrFail({ email: ADMIN_EMAIL });
    const staffSession = await current.sessions.start(admin, new Date());
    expect(await current.sessions.authenticate(staffSession.token, new Date())).not.toBeNull();
  });

  it('does not issue a trainee password-reset token', async () => {
    const current = useContainer();
    const app = appFor(current);
    await request(app).post('/api/v1/auth/password-reset/request').send({ email: TRAINEE_EMAIL }).expect(200);
    const traineeTokens: Array<{ count: string }> = await current.dataSource.query(
      `SELECT count(*)::text AS count FROM access_tokens WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
      [TRAINEE_EMAIL],
    );
    expect(traineeTokens[0]?.count).toBe('0');

    await request(app).post('/api/v1/auth/password-reset/request').send({ email: ADMIN_EMAIL }).expect(200);
    const staffTokens: Array<{ count: string }> = await current.dataSource.query(
      `SELECT count(*)::text AS count FROM access_tokens WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
      [ADMIN_EMAIL],
    );
    expect(Number(staffTokens[0]?.count ?? '0')).toBeGreaterThan(0);
  });
});

function useContainer(): AppContainer {
  if (!container) throw new Error('container missing');
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
