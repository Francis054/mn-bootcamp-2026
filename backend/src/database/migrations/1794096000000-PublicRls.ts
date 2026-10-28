import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Closes the Supabase Data API (PostgREST) on `public`.
 *
 * The website and this API do not use supabase-js, the anon key, or the Data
 * API. They connect with `DATABASE_URL`. On the hosted project that is the
 * `postgres` role (`postgres.psxzqwztgjkqnnncxddc` on the session pooler).
 * Supabase documents that role as having `bypassrls`. The same role runs the
 * migrations, so it owns these tables. `FORCE ROW LEVEL SECURITY` is left
 * unset: a table owner bypasses row level security even without `bypassrls`.
 * `anon` and `authenticated` do not.
 *
 * No policies are added. With row level security on and no policy, those roles
 * receive no rows. Grants are revoked as well, because a grant without a
 * policy is still how the Security Advisor decides a table is exposed, and a
 * later policy must not inherit a blanket grant. `service_role` is left as
 * Supabase created it. This process does not use that key.
 *
 * `anon` and `authenticated` exist on Supabase and not on a local Postgres.
 * The statements that name them are skipped when the role is missing, so this
 * file still applies in tests. It is safe to run more than once.
 *
 * Default privileges are cleared for the current role and for `postgres` when
 * this session is allowed to change that role. A table created afterwards by
 * those roles is not granted to `anon` or `authenticated`. A later migration
 * that creates a table should still enable row level security on it. An event
 * trigger would do that automatically, and Supabase does not let `postgres`
 * create one.
 *
 * Down turns row level security off and grants `anon` and `authenticated`
 * every privilege again. That is the exposed state this migration removes.
 * Do not run it on the hosted database.
 *
 * The same statements are in docs/security.md for the Supabase SQL editor.
 */
export const ENABLE_PUBLIC_RLS_SQL = `
DO $lock_public$
DECLARE
  public_table text;
  target_role text;
  grantor_role text;
BEGIN
  FOR public_table IN
    SELECT c.relname
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', public_table);
  END LOOP;

  FOR target_role IN
    SELECT r.rolname
    FROM pg_catalog.pg_roles AS r
    WHERE r.rolname IN ('anon', 'authenticated')
    ORDER BY r.rolname
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM %I',
      target_role
    );
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %I',
      target_role
    );
  END LOOP;

  FOR grantor_role IN
    SELECT r.rolname
    FROM pg_catalog.pg_roles AS r
    WHERE r.rolname IN (CURRENT_USER, 'postgres')
      AND (
        r.rolname = CURRENT_USER
        OR pg_catalog.pg_has_role(CURRENT_USER, r.rolname, 'MEMBER')
      )
    ORDER BY r.rolname
  LOOP
    FOR target_role IN
      SELECT r.rolname
      FROM pg_catalog.pg_roles AS r
      WHERE r.rolname IN ('anon', 'authenticated')
      ORDER BY r.rolname
    LOOP
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM %I',
        grantor_role,
        target_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM %I',
        grantor_role,
        target_role
      );
    END LOOP;
  END LOOP;
END
$lock_public$;
`;

export const DISABLE_PUBLIC_RLS_SQL = `
DO $unlock_public$
DECLARE
  public_table text;
  target_role text;
  grantor_role text;
BEGIN
  FOR public_table IN
    SELECT c.relname
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', public_table);
  END LOOP;

  FOR target_role IN
    SELECT r.rolname
    FROM pg_catalog.pg_roles AS r
    WHERE r.rolname IN ('anon', 'authenticated')
    ORDER BY r.rolname
  LOOP
    EXECUTE format(
      'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO %I',
      target_role
    );
    EXECUTE format(
      'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO %I',
      target_role
    );
  END LOOP;

  FOR grantor_role IN
    SELECT r.rolname
    FROM pg_catalog.pg_roles AS r
    WHERE r.rolname IN (CURRENT_USER, 'postgres')
      AND (
        r.rolname = CURRENT_USER
        OR pg_catalog.pg_has_role(CURRENT_USER, r.rolname, 'MEMBER')
      )
    ORDER BY r.rolname
  LOOP
    FOR target_role IN
      SELECT r.rolname
      FROM pg_catalog.pg_roles AS r
      WHERE r.rolname IN ('anon', 'authenticated')
      ORDER BY r.rolname
    LOOP
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO %I',
        grantor_role,
        target_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO %I',
        grantor_role,
        target_role
      );
    END LOOP;
  END LOOP;
END
$unlock_public$;
`;

export class PublicRls1794096000000 implements MigrationInterface {
  name = 'PublicRls1794096000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(ENABLE_PUBLIC_RLS_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DISABLE_PUBLIC_RLS_SQL);
  }
}
