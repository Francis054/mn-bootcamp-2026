/**
 * Reports row level security on public tables, and whether `anon` or
 * `authenticated` still hold table or sequence privileges.
 *
 * DATABASE_URL is the only connection setting. The script never prints it,
 * the user, or the password. A connection failure is printed with those
 * pieces removed.
 *
 * Exit 0 when every ordinary and partitioned table in `public` has row
 * level security on, `PublicRls1794096000000` is recorded, and neither role
 * holds a privilege. FORCE ROW LEVEL SECURITY is reported and is not
 * required: the API connects as the table owner, and that owner bypasses
 * row level security unless force is set.
 *
 * `--require-roles` also fails when `anon` or `authenticated` is missing.
 * Use that on the hosted Supabase project. A local Postgres often has
 * neither role, and the script says so without failing.
 *
 * Exit 1 when a check fails. Exit 2 when DATABASE_URL is missing or the
 * server cannot be reached.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const MIGRATION_NAME = 'PublicRls1794096000000';
const DATA_API_ROLES = ['anon', 'authenticated'];

const TABLE_SQL = `
  SELECT c.relname AS name,
         c.relrowsecurity AS rls_enabled,
         c.relforcerowsecurity AS rls_forced
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
  ORDER BY c.relname
`;

const ROLE_SQL = `
  SELECT r.rolname AS name
  FROM pg_catalog.pg_roles AS r
  WHERE r.rolname = ANY($1::text[])
  ORDER BY r.rolname
`;

const MIGRATION_SQL = `
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'schema_migrations'
  ) AS present
`;

const MIGRATION_ROW_SQL = `
  SELECT 1
  FROM public.schema_migrations
  WHERE name = $1
  LIMIT 1
`;

/**
 * @param {string} role
 * @param {'table' | 'sequence'} kind
 */
function privilegeSql(role, kind) {
  const privilege =
    kind === 'table'
      ? `pg_catalog.has_table_privilege($1, c.oid, 'SELECT')
        OR pg_catalog.has_table_privilege($1, c.oid, 'INSERT')
        OR pg_catalog.has_table_privilege($1, c.oid, 'UPDATE')
        OR pg_catalog.has_table_privilege($1, c.oid, 'DELETE')
        OR pg_catalog.has_table_privilege($1, c.oid, 'TRUNCATE')`
      : `pg_catalog.has_sequence_privilege($1, c.oid, 'USAGE')
        OR pg_catalog.has_sequence_privilege($1, c.oid, 'SELECT')
        OR pg_catalog.has_sequence_privilege($1, c.oid, 'UPDATE')`;
  const relkind = kind === 'table' ? `c.relkind IN ('r', 'p')` : `c.relkind = 'S'`;
  return `
    SELECT c.relname AS name
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND ${relkind}
      AND (${privilege})
    ORDER BY c.relname
  `;
}

/**
 * @param {string | undefined} value
 * @returns {{ ok: true, requireRoles: boolean } | { ok: false, message: string }}
 */
export function readCheckArgs(argv) {
  const extra = argv.slice(2).filter((arg) => arg !== '--require-roles');
  if (extra.length > 0) {
    return {
      ok: false,
      message: 'public-rls: the only option is --require-roles.',
    };
  }
  return { ok: true, requireRoles: argv.includes('--require-roles') };
}

/**
 * @param {string} text
 * @param {string | undefined} databaseUrl
 */
export function redactDatabaseUrl(text, databaseUrl) {
  let cleaned = text;
  if (databaseUrl && databaseUrl.length > 0) {
    cleaned = cleaned.split(databaseUrl).join('[database]');
  }
  try {
    if (databaseUrl) {
      const parsed = new URL(databaseUrl);
      if (parsed.password) cleaned = cleaned.split(parsed.password).join('[redacted]');
      if (parsed.username) cleaned = cleaned.split(parsed.username).join('[redacted]');
    }
  } catch {
    // A value that is not a URL has no user or password to strip.
  }
  return cleaned;
}

/**
 * @param {{
 *   tables: { name: string, rlsEnabled: boolean, rlsForced: boolean }[],
 *   rolesPresent: string[],
 *   grants: { role: string, tables: string[], sequences: string[] }[],
 *   migrationRecorded: boolean | null,
 *   requireRoles: boolean,
 * }} input
 */
export function reportPublicRls(input) {
  const rlsOff = input.tables.filter((table) => !table.rlsEnabled).map((table) => table.name);
  const forced = input.tables.filter((table) => table.rlsForced).map((table) => table.name);
  /** @type {string[]} */
  const grantLines = [];
  for (const grant of input.grants) {
    for (const table of grant.tables) grantLines.push(`${grant.role} table ${table}`);
    for (const sequence of grant.sequences) grantLines.push(`${grant.role} sequence ${sequence}`);
  }
  const missingRoles = DATA_API_ROLES.filter((role) => !input.rolesPresent.includes(role));
  /** @type {string[]} */
  const problems = [];
  if (input.tables.length === 0) problems.push('no public tables');
  if (rlsOff.length > 0) problems.push(`row level security is off: ${rlsOff.join(', ')}`);
  if (grantLines.length > 0) problems.push(`grants remain: ${grantLines.join(', ')}`);
  if (input.requireRoles && missingRoles.length > 0) {
    problems.push(`missing roles: ${missingRoles.join(', ')}`);
  }
  if (input.migrationRecorded === null) problems.push('schema_migrations was not found');
  if (input.migrationRecorded === false) {
    problems.push(`${MIGRATION_NAME} is not in schema_migrations`);
  }

  /** @type {string[]} */
  const lines = [
    `public-rls: tables=${input.tables.length} rls_off=${rlsOff.length} forced=${forced.length}`,
  ];
  if (missingRoles.length === DATA_API_ROLES.length) {
    lines.push(
      'public-rls: anon and authenticated are absent. A local Postgres often has neither role. On Supabase, run this again with --require-roles.',
    );
  } else {
    lines.push(
      `public-rls: roles=${input.rolesPresent.join(',') || 'none'} grants=${grantLines.length}`,
    );
  }
  if (input.migrationRecorded === null) {
    lines.push('public-rls: schema_migrations was not found');
  } else if (input.migrationRecorded) {
    lines.push(`public-rls: migration ${MIGRATION_NAME} is recorded`);
  } else {
    lines.push(`public-rls: migration ${MIGRATION_NAME} is not recorded`);
  }
  if (forced.length === 0) {
    lines.push(
      'public-rls: FORCE ROW LEVEL SECURITY is unset. The table owner bypasses row level security. That is the API design. Do not add a policy whose expression is true.',
    );
  } else {
    lines.push(`public-rls: FORCE ROW LEVEL SECURITY is set on: ${forced.join(', ')}`);
  }
  return { ok: problems.length === 0, lines, problems };
}

/**
 * @param {import('pg').Client} client
 * @param {boolean} requireRoles
 */
export async function collectPublicRls(client, requireRoles) {
  const tables = await client.query(TABLE_SQL);
  const roles = await client.query(ROLE_SQL, [DATA_API_ROLES]);
  const rolesPresent = roles.rows.map((row) => String(row.name));
  /** @type {{ role: string, tables: string[], sequences: string[] }[]} */
  const grants = [];
  for (const role of rolesPresent) {
    const tableGrants = await client.query(privilegeSql(role, 'table'), [role]);
    const sequenceGrants = await client.query(privilegeSql(role, 'sequence'), [role]);
    grants.push({
      role,
      tables: tableGrants.rows.map((row) => String(row.name)),
      sequences: sequenceGrants.rows.map((row) => String(row.name)),
    });
  }
  const migrationTable = await client.query(MIGRATION_SQL);
  const present = migrationTable.rows[0]?.present === true;
  let migrationRecorded = /** @type {boolean | null} */ (null);
  if (present) {
    const recorded = await client.query(MIGRATION_ROW_SQL, [MIGRATION_NAME]);
    migrationRecorded = recorded.rowCount !== null && recorded.rowCount > 0;
  }
  return reportPublicRls({
    tables: tables.rows.map((row) => ({
      name: String(row.name),
      rlsEnabled: row.rls_enabled === true,
      rlsForced: row.rls_forced === true,
    })),
    rolesPresent,
    grants,
    migrationRecorded,
    requireRoles,
  });
}

/**
 * @param {string | undefined} databaseUrl
 * @param {boolean} requireRoles
 */
export async function checkPublicRls(databaseUrl, requireRoles) {
  if (databaseUrl === undefined || databaseUrl.trim() === '') {
    return {
      status: 2,
      lines: [],
      errors: ['public-rls: DATABASE_URL is not set. The address was not printed.'],
    };
  }
  const client = new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
  });
  try {
    await client.connect();
    const report = await collectPublicRls(client, requireRoles);
    return {
      status: report.ok ? 0 : 1,
      lines: report.lines,
      errors: report.problems.map((problem) => `public-rls: ${problem}`),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'connection failed';
    return {
      status: 2,
      lines: [],
      errors: [
        `public-rls: could not read the catalog. ${redactDatabaseUrl(message, databaseUrl)}`,
      ],
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

function isDirectRun() {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isDirectRun()) {
  const args = readCheckArgs(process.argv);
  if (!args.ok) {
    console.error(args.message);
    process.exit(1);
  }
  checkPublicRls(process.env.DATABASE_URL, args.requireRoles)
    .then((result) => {
      for (const line of result.lines) console.log(line);
      for (const line of result.errors) console.error(line);
      process.exit(result.status);
    })
    .catch(() => {
      console.error('public-rls: stopped before a report. The address was not logged.');
      process.exit(2);
    });
}
