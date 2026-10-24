import { describe, expect, it } from 'vitest';
import { createDataSource } from '../../src/database/data-source.js';
import { testEnv } from '../support/app-env.js';

describe('createDataSource', () => {
  it('does not synchronize the schema and names the migration table', () => {
    const dataSource = createDataSource(testEnv());
    expect(dataSource.options.synchronize).toBe(false);
    expect(dataSource.options.migrationsTableName).toBe('schema_migrations');
    expect(dataSource.options.type).toBe('postgres');
  });
});
