import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { AppContainer } from '../../src/composition/container.js';
import { testEnv } from '../support/app-env.js';
import { MIGRATION_NAMES, revertOurMigrations } from '../support/migrations.js';
import { openTestDatabase } from '../support/test-database.js';

describe('health against Postgres', () => {
  let container: AppContainer | undefined;
  let closeDatabase: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    const database = await openTestDatabase();
    closeDatabase = database.close;
    container = await AppContainer.create(
      testEnv({ databaseUrl: database.url, databaseSsl: false, logLevel: 'silent' }),
    );
    await container.dataSource.runMigrations();
  });

  afterAll(async () => {
    if (container?.dataSource.isInitialized) {
      await revertOurMigrations(container.dataSource);
      await container.close();
    }
    if (closeDatabase) await closeDatabase();
  });

  it('applies the baseline migration and reports the database up', async () => {
    if (!container) throw new Error('The test database was not opened.');
    const names: unknown = await container.dataSource.query(
      'SELECT name FROM schema_migrations ORDER BY id',
    );
    expect(names).toEqual(MIGRATION_NAMES.map((name) => ({ name })));

    const app = createApp(container);
    const response = await request(app).get('/api/v1/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
    expect(JSON.stringify(response.body)).not.toContain('postgres');
  });
});
