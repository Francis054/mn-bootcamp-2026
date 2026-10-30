import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { type AppEnv, loadEnv } from '../../src/config/env.js';
import { createDataSource } from '../../src/database/data-source.js';
import { connectionUrlForDriver } from '../../src/database/ssl.js';
import { testEnv } from '../support/app-env.js';
import { MIGRATION_NAMES } from '../support/migrations.js';

const require = createRequire(import.meta.url);
const CA = '-----BEGIN CERTIFICATE-----\nMIIBTESTCERTIFICATEBODYX\n-----END CERTIFICATE-----';

interface PgClient {
  connectionParameters: { ssl: unknown };
}

/** What node-postgres keeps after it parses the URL. Construction does not connect. */
function sslSeenByPg(connectionString: string, ssl: unknown): unknown {
  const pg = require('pg') as {
    Client: new (config: { connectionString: string; ssl: unknown }) => PgClient;
  };
  return new pg.Client({ connectionString, ssl }).connectionParameters.ssl;
}

function postgresOptions(
  env: Pick<AppEnv, 'databaseUrl' | 'databaseSsl' | 'databaseSslCa' | 'nodeEnv'>,
) {
  const dataSource = createDataSource(env);
  if (dataSource.options.type !== 'postgres') {
    throw new Error('Expected a postgres data source.');
  }
  return dataSource.options;
}

describe('createDataSource', () => {
  it('does not synchronize the schema and names the migration table', () => {
    const dataSource = createDataSource(testEnv());
    expect(dataSource.options.synchronize).toBe(false);
    expect(dataSource.options.migrationsTableName).toBe('schema_migrations');
    expect(dataSource.options.type).toBe('postgres');
    const migrations = dataSource.options.migrations;
    if (!Array.isArray(migrations)) throw new Error('Expected a migration list.');
    expect(
      migrations.map((migration) => (typeof migration === 'function' ? migration.name : '')),
    ).toEqual([...MIGRATION_NAMES]);
  });

  it('drops sslmode when SSL is off so the driver cannot turn it back on', () => {
    const options = postgresOptions(
      testEnv({
        databaseUrl: 'postgres://app:p%40ss@127.0.0.1:5432/mn_bootcamp_test?sslmode=require',
        databaseSsl: false,
      }),
    );
    expect(options.ssl).toBe(false);
    expect(options.url).toBe('postgres://app:p%40ss@127.0.0.1:5432/mn_bootcamp_test');
    expect(sslSeenByPg(options.url ?? '', options.ssl)).toBe(false);
  });

  it('checks the certificate and keeps the rest of the URL', () => {
    const options = postgresOptions(
      testEnv({
        databaseUrl:
          'postgresql://postgres.example:p%40ss%23word@db.internal:5432/postgres?application_name=api&sslmode=require',
        databaseSsl: true,
      }),
    );
    expect(options.ssl).toEqual({ rejectUnauthorized: true });
    expect(options.url).toBe(
      'postgresql://postgres.example:p%40ss%23word@db.internal:5432/postgres?application_name=api',
    );
    expect(sslSeenByPg(options.url ?? '', options.ssl)).toEqual({ rejectUnauthorized: true });
  });

  it('keeps the CA when the URL would otherwise replace TLS options', () => {
    const options = postgresOptions(
      testEnv({
        databaseUrl:
          'postgres://app:p%40ss@db.internal:5432/mn_bootcamp?uselibpqcompat=true&sslmode=require&sslrootcert=/no/such/ca.crt&application_name=bootcamp',
        databaseSsl: true,
        databaseSslCa: CA,
      }),
    );
    expect(options.url).toBe(
      'postgres://app:p%40ss@db.internal:5432/mn_bootcamp?application_name=bootcamp',
    );
    expect(options.ssl).toEqual({ rejectUnauthorized: true, ca: CA });
    expect(sslSeenByPg(options.url ?? '', options.ssl)).toEqual({
      rejectUnauthorized: true,
      ca: CA,
    });
  });

  it('uses the parsed CA for the same options migrations pass to the driver', () => {
    const env = loadEnv(
      {
        DATABASE_URL: 'postgres://app:p%40ss@db.internal:5432/mn_bootcamp?sslmode=require',
        DATABASE_SSL: 'true',
        DATABASE_SSL_CA:
          '"-----BEGIN CERTIFICATE-----\\nMIIBTESTCERTIFICATEBODYX\\n-----END CERTIFICATE-----"',
      },
      { loadDotenv: false },
    );
    const options = postgresOptions(env);
    expect(options.ssl).toEqual({ rejectUnauthorized: true, ca: CA });
    expect(options.url).toBe('postgres://app:p%40ss@db.internal:5432/mn_bootcamp');
    expect(sslSeenByPg(options.url ?? '', options.ssl)).toEqual(options.ssl);
  });
});

describe('connectionUrlForDriver', () => {
  it('keeps a fragment and drops only SSL query keys', () => {
    expect(
      connectionUrlForDriver(
        'postgres://127.0.0.1:5432/mn?foo=1&&ssl=true&sslmode=verify-full#note',
      ),
    ).toBe('postgres://127.0.0.1:5432/mn?foo=1#note');
  });
});
