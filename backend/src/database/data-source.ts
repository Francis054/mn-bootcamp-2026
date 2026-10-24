import { DataSource } from 'typeorm';
import type { AppEnv } from '../config/env.js';
import { Baseline1792800000000 } from './migrations/1792800000000-Baseline.js';

/**
 * `synchronize` stays false. Schema changes are migration files, reviewed like
 * any other change. Add each new migration class to this list. Entities are
 * listed here when a later milestone adds them.
 */
export function createDataSource(
  env: Pick<AppEnv, 'databaseUrl' | 'databaseSsl' | 'nodeEnv'>,
): DataSource {
  return new DataSource({
    type: 'postgres',
    url: env.databaseUrl,
    synchronize: false,
    logging: env.nodeEnv === 'development' ? ['error'] : false,
    entities: [],
    migrations: [Baseline1792800000000],
    migrationsTableName: 'schema_migrations',
    ssl: env.databaseSsl ? { rejectUnauthorized: true } : false,
  });
}
