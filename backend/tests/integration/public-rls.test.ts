import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDataSource } from '../../src/database/data-source.js';
import {
  DISABLE_PUBLIC_RLS_SQL,
  ENABLE_PUBLIC_RLS_SQL,
  PublicRls1794096000000,
} from '../../src/database/migrations/1794096000000-PublicRls.js';
import { testEnv } from '../support/app-env.js';
import { revertOurMigrations } from '../support/migrations.js';
import { openTestDatabase } from '../support/test-database.js';

/**
 * Ordinary tables this repository creates, plus TypeORM's `schema_migrations`.
 * The migration discovers tables at runtime. This list fails the test when a
 * new `CREATE TABLE` is not covered.
 */
const PUBLIC_TABLES = [
  'access_tokens',
  'audit_events',
  'class_sessions',
  'contact_requests',
  'content_singletons',
  'curriculum_blocks',
  'curriculum_weeks',
  'cv_requests',
  'email_outbox',
  'enquiries',
  'event_lessons',
  'event_media',
  'event_projects',
  'events',
  'lessons',
  'login_throttles',
  'media_assets',
  'modules',
  'pending_registrations',
  'phases',
  'portfolio_items',
  'portfolio_media',
  'portfolio_video_grants',
  'programmes',
  'project_lessons',
  'project_trainees',
  'projects',
  'schema_migrations',
  'session_trainers',
  'sessions',
  'site_images',
  'tracks',
  'trainee_consents',
  'trainee_documents',
  'trainee_events',
  'trainee_lessons',
  'trainee_milestones',
  'trainee_removal_items',
  'trainee_removals',
  'trainee_skills',
  'trainees',
  'trainers',
  'users',
  'week_deliverables',
  'week_trainers',
  'work_photos',
] as const;

const TABLES_WITHOUT_RLS = `
  SELECT c.relname AS name
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND NOT c.relrowsecurity
  ORDER BY c.relname
`;

const FORCED_TABLES = `
  SELECT c.relname AS name
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND c.relforcerowsecurity
  ORDER BY c.relname
`;

const PUBLIC_TABLE_NAMES = `
  SELECT c.relname AS name
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
  ORDER BY c.relname
`;

const EXPOSED_TABLES = `
  SELECT c.relname AS name
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND (
      pg_catalog.has_table_privilege('anon', c.oid, 'SELECT')
      OR pg_catalog.has_table_privilege('anon', c.oid, 'INSERT')
      OR pg_catalog.has_table_privilege('anon', c.oid, 'UPDATE')
      OR pg_catalog.has_table_privilege('anon', c.oid, 'DELETE')
      OR pg_catalog.has_table_privilege('anon', c.oid, 'TRUNCATE')
      OR pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT')
      OR pg_catalog.has_table_privilege('authenticated', c.oid, 'INSERT')
      OR pg_catalog.has_table_privilege('authenticated', c.oid, 'UPDATE')
      OR pg_catalog.has_table_privilege('authenticated', c.oid, 'DELETE')
      OR pg_catalog.has_table_privilege('authenticated', c.oid, 'TRUNCATE')
    )
  ORDER BY c.relname
`;

const EXPOSED_SEQUENCES = `
  SELECT c.relname AS name
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'S'
    AND (
      pg_catalog.has_sequence_privilege('anon', c.oid, 'USAGE')
      OR pg_catalog.has_sequence_privilege('anon', c.oid, 'SELECT')
      OR pg_catalog.has_sequence_privilege('anon', c.oid, 'UPDATE')
      OR pg_catalog.has_sequence_privilege('authenticated', c.oid, 'USAGE')
      OR pg_catalog.has_sequence_privilege('authenticated', c.oid, 'SELECT')
      OR pg_catalog.has_sequence_privilege('authenticated', c.oid, 'UPDATE')
    )
  ORDER BY c.relname
`;

describe('public row level security', () => {
  let dataSource: DataSource | undefined;
  let closeDatabase: (() => Promise<void>) | undefined;
  const createdRoles: string[] = [];

  beforeAll(async () => {
    const database = await openTestDatabase();
    closeDatabase = database.close;
    dataSource = createDataSource(
      testEnv({ databaseUrl: database.url, databaseSsl: false, logLevel: 'silent' }),
    );
    await dataSource.initialize();
    createdRoles.push(...(await createApiRoles(dataSource)));
    await dataSource.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT ALL PRIVILEGES ON TABLES TO anon, authenticated
    `);
    await dataSource.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT ALL PRIVILEGES ON SEQUENCES TO anon, authenticated
    `);
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query('DROP TABLE IF EXISTS public.rls_owner_probe');
      await dataSource.query('DROP TABLE IF EXISTS public.rls_future_probe');
      await revertOurMigrations(dataSource);
      await dataSource.query(`
        REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
        REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public
          REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public
          REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
          REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
          REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
      `);
      for (const role of createdRoles) {
        await dataSource.query(`DROP OWNED BY ${quoteIdent(role)}`);
        await dataSource.query(`DROP ROLE IF EXISTS ${quoteIdent(role)}`);
      }
      await dataSource.destroy();
    }
    if (closeDatabase) await closeDatabase();
  });

  it('enables row level security on every public table without forcing the owner', async () => {
    const current = useDataSource();
    expect(await names(current, PUBLIC_TABLE_NAMES)).toEqual([...PUBLIC_TABLES]);
    expect(await names(current, TABLES_WITHOUT_RLS)).toEqual([]);
    expect(await names(current, FORCED_TABLES)).toEqual([]);
  });

  it('revokes anon and authenticated, including a table created afterwards', async () => {
    const current = useDataSource();
    expect(await names(current, EXPOSED_TABLES)).toEqual([]);
    expect(await names(current, EXPOSED_SEQUENCES)).toEqual([]);

    await current.query('CREATE TABLE public.rls_future_probe (id serial PRIMARY KEY)');
    try {
      const probe: unknown = await current.query(`
        SELECT
          pg_catalog.has_table_privilege('anon', 'public.rls_future_probe', 'SELECT') AS anon_table,
          pg_catalog.has_table_privilege('authenticated', 'public.rls_future_probe', 'SELECT') AS authenticated_table,
          pg_catalog.has_sequence_privilege(
            'anon',
            pg_catalog.pg_get_serial_sequence('public.rls_future_probe', 'id'),
            'USAGE'
          ) AS anon_sequence,
          c.relrowsecurity AS rls_on
        FROM pg_catalog.pg_class AS c
        JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'rls_future_probe'
      `);
      expect(probe).toEqual([
        {
          anon_table: false,
          authenticated_table: false,
          anon_sequence: false,
          rls_on: false,
        },
      ]);
    } finally {
      await current.query('DROP TABLE public.rls_future_probe');
    }
  });

  it('lets a non-superuser owner through and denies a role that only has a grant', async () => {
    const current = useDataSource();
    const flags: unknown = await current.query(`
      SELECT rolsuper, rolbypassrls
      FROM pg_catalog.pg_roles
      WHERE rolname = 'rls_owner'
    `);
    expect(flags).toEqual([{ rolsuper: false, rolbypassrls: false }]);

    await current.query(`
      CREATE TABLE public.rls_owner_probe (id int PRIMARY KEY, note text NOT NULL)
    `);
    await current.query('ALTER TABLE public.rls_owner_probe OWNER TO rls_owner');
    await current.query('ALTER TABLE public.rls_owner_probe ENABLE ROW LEVEL SECURITY');
    await current.query('GRANT SELECT ON public.rls_owner_probe TO rls_subject');

    try {
      await asRole(
        'rls_owner',
        'INSERT INTO public.rls_owner_probe (id, note) VALUES (1, $1)',
        ['owner'],
        true,
      );
      expect(
        await countAs('rls_owner', 'SELECT count(*)::int AS n FROM public.rls_owner_probe'),
      ).toBe(1);
      expect(
        await countAs('rls_subject', 'SELECT count(*)::int AS n FROM public.rls_owner_probe'),
      ).toBe(0);

      await current.query('ALTER TABLE public.rls_owner_probe FORCE ROW LEVEL SECURITY');
      expect(
        await countAs('rls_owner', 'SELECT count(*)::int AS n FROM public.rls_owner_probe'),
      ).toBe(0);
    } finally {
      await current.query('DROP TABLE IF EXISTS public.rls_owner_probe');
    }

    await current.query(
      `
      INSERT INTO users (email, display_name, initials, hue, role, password_hash)
      VALUES ($1, 'RLS Owner', 'RO', 12, 'viewer', $2)
      `,
      ['rls-owner@example.test', 'not-a-password'],
    );
    const stored: unknown = await current.query('SELECT email FROM users WHERE email = $1', [
      'rls-owner@example.test',
    ]);
    expect(stored).toEqual([{ email: 'rls-owner@example.test' }]);
    await current.query('DELETE FROM users WHERE email = $1', ['rls-owner@example.test']);
  });

  it('turns the lock off and on again', async () => {
    const current = useDataSource();
    const migration = new PublicRls1794096000000();
    const runner = current.createQueryRunner();
    await runner.connect();
    try {
      await migration.up(runner);
      await migration.up(runner);
      expect(ENABLE_PUBLIC_RLS_SQL).toContain('ENABLE ROW LEVEL SECURITY');

      await migration.down(runner);
      expect(await names(current, TABLES_WITHOUT_RLS)).toEqual([...PUBLIC_TABLES]);
      const granted: unknown = await current.query(
        `SELECT pg_catalog.has_table_privilege('anon', 'public.users', 'SELECT') AS open`,
      );
      expect(granted).toEqual([{ open: true }]);

      await migration.down(runner);
      await runner.query(DISABLE_PUBLIC_RLS_SQL);
      await migration.up(runner);
      await migration.up(runner);
      expect(await names(current, TABLES_WITHOUT_RLS)).toEqual([]);
      expect(await names(current, EXPOSED_TABLES)).toEqual([]);
      expect(await names(current, FORCED_TABLES)).toEqual([]);
    } finally {
      await runner.release();
    }
  });

  function useDataSource(): DataSource {
    if (!dataSource) throw new Error('The test database was not opened.');
    return dataSource;
  }

  async function countAs(role: string, sql: string): Promise<number> {
    return readCount(await asRole(role, sql, [], false));
  }

  async function asRole(
    role: string,
    sql: string,
    parameters: unknown[],
    commit: boolean,
  ): Promise<unknown> {
    const current = useDataSource();
    const runner = current.createQueryRunner();
    await runner.connect();
    await runner.query('BEGIN');
    try {
      await runner.query(`SET LOCAL ROLE ${quoteIdent(role)}`);
      const rows: unknown = await runner.query(sql, parameters);
      await runner.query(commit ? 'COMMIT' : 'ROLLBACK');
      return rows;
    } catch (error) {
      await runner.query('ROLLBACK');
      throw error;
    } finally {
      await runner.release();
    }
  }
});

async function createApiRoles(dataSource: DataSource): Promise<string[]> {
  const before = await names(
    dataSource,
    `SELECT rolname AS name FROM pg_catalog.pg_roles WHERE rolname IN ('anon', 'authenticated', 'rls_owner', 'rls_subject')`,
  );
  await dataSource.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'rls_owner') THEN
        CREATE ROLE rls_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'rls_subject') THEN
        CREATE ROLE rls_subject NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
      END IF;
    END $$;
  `);
  await dataSource.query('ALTER ROLE rls_owner NOSUPERUSER NOBYPASSRLS NOINHERIT NOLOGIN');
  await dataSource.query('ALTER ROLE rls_subject NOSUPERUSER NOBYPASSRLS NOINHERIT NOLOGIN');
  return ['anon', 'authenticated', 'rls_owner', 'rls_subject'].filter(
    (role) => !before.includes(role),
  );
}

async function names(dataSource: DataSource, sql: string): Promise<string[]> {
  return readNames(await dataSource.query(sql));
}

function readNames(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('Expected rows.');
  const names: string[] = [];
  for (const row of value as readonly unknown[]) {
    if (typeof row !== 'object' || row === null) throw new Error('Expected a name column.');
    const name = (row as { name?: unknown }).name;
    if (typeof name !== 'string') throw new Error('Expected a name column.');
    names.push(name);
  }
  return names;
}

function readCount(value: unknown): number {
  if (!Array.isArray(value) || value.length !== 1) throw new Error('Expected one count row.');
  const row: unknown = value[0];
  if (typeof row !== 'object' || row === null || !('n' in row))
    throw new Error('Expected a count.');
  const count = row.n;
  if (typeof count === 'number') return count;
  if (typeof count === 'string' && count !== '' && Number.isFinite(Number(count)))
    return Number(count);
  throw new Error('Expected a count.');
}

function quoteIdent(value: string): string {
  if (!/^[a-z_]+$/.test(value)) throw new Error('Refusing to quote an unexpected role name.');
  return `"${value}"`;
}
