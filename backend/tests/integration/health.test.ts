import request from 'supertest';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { AppContainer } from '../../src/composition/container.js';
import { testEnv } from '../support/app-env.js';
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
      await revertBaselineIfPresent(container.dataSource);
      await container.close();
    }
    if (closeDatabase) await closeDatabase();
  });

  it('applies the baseline migration and reports the database up', async () => {
    if (!container) throw new Error('The test database was not opened.');
    const names: unknown = await container.dataSource.query(
      'SELECT name FROM schema_migrations ORDER BY id',
    );
    expect(names).toEqual([{ name: 'Baseline1792800000000' }]);

    const app = createApp(container);
    const response = await request(app).get('/api/v1/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
    expect(JSON.stringify(response.body)).not.toContain('postgres');
  });
});

async function revertBaselineIfPresent(dataSource: DataSource): Promise<void> {
  const rows: unknown = await dataSource.query('SELECT name FROM schema_migrations ORDER BY id');
  if (!Array.isArray(rows) || rows.length !== 1) return;
  if (migrationName(rows[0]) === 'Baseline1792800000000') {
    await dataSource.undoLastMigration();
  }
}

function migrationName(row: unknown): string | undefined {
  if (typeof row !== 'object' || row === null || !('name' in row)) return undefined;
  return typeof row.name === 'string' ? row.name : undefined;
}
