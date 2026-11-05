import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  readCheckArgs,
  redactDatabaseUrl,
  reportPublicRls,
} from '../../scripts/check-public-rls.mjs';

const script = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scripts/check-public-rls.mjs',
);

const locked = {
  name: 'users',
  rlsEnabled: true,
  rlsForced: false,
};

describe('public row level security report', () => {
  it('accepts locked tables when the Data API roles are absent', () => {
    const report = reportPublicRls({
      tables: [locked],
      rolesPresent: [],
      grants: [],
      migrationRecorded: true,
      requireRoles: false,
    });
    expect(report.ok).toBe(true);
    expect(report.lines.join('\n')).toContain('tables=1 rls_off=0 forced=0');
    expect(report.lines.join('\n')).toContain('anon and authenticated are absent');
    expect(report.lines.join('\n')).toContain('PublicRls1794096000000 is recorded');
    expect(report.lines.join('\n')).toContain('FORCE ROW LEVEL SECURITY is unset');
  });

  it('fails when a table has row level security off or the migration row is missing', () => {
    const report = reportPublicRls({
      tables: [locked, { name: 'events', rlsEnabled: false, rlsForced: false }],
      rolesPresent: [],
      grants: [],
      migrationRecorded: false,
      requireRoles: false,
    });
    expect(report.ok).toBe(false);
    expect(report.problems.join('\n')).toContain('events');
    expect(report.problems.join('\n')).toContain('PublicRls1794096000000');
  });

  it('fails when anon still holds a table grant', () => {
    const report = reportPublicRls({
      tables: [locked],
      rolesPresent: ['anon', 'authenticated'],
      grants: [
        { role: 'anon', tables: ['users'], sequences: [] },
        { role: 'authenticated', tables: [], sequences: [] },
      ],
      migrationRecorded: true,
      requireRoles: true,
    });
    expect(report.ok).toBe(false);
    expect(report.problems.join('\n')).toContain('anon table users');
    expect(report.lines.join('\n')).toContain('grants=1');
  });

  it('requires the Data API roles only when asked', () => {
    const input = {
      tables: [locked],
      rolesPresent: ['anon'],
      grants: [{ role: 'anon', tables: [], sequences: [] }],
      migrationRecorded: true,
      requireRoles: false,
    };
    expect(reportPublicRls(input).ok).toBe(true);
    expect(reportPublicRls({ ...input, requireRoles: true }).ok).toBe(false);
  });

  it('does not treat FORCE ROW LEVEL SECURITY as a failure', () => {
    const report = reportPublicRls({
      tables: [{ name: 'users', rlsEnabled: true, rlsForced: true }],
      rolesPresent: [],
      grants: [],
      migrationRecorded: true,
      requireRoles: false,
    });
    expect(report.ok).toBe(true);
    expect(report.lines.join('\n')).toContain('forced=1');
  });

  it('rejects unknown options and strips a database password from errors', () => {
    expect(readCheckArgs(['node', 'check-public-rls.mjs']).ok).toBe(true);
    expect(readCheckArgs(['node', 'check-public-rls.mjs', '--require-roles'])).toEqual({
      ok: true,
      requireRoles: true,
    });
    const unknown = readCheckArgs(['node', 'check-public-rls.mjs', '--print-url']);
    expect(unknown.ok).toBe(false);
    const secret = 's3cret-db-password';
    const url = `postgres://mn:${secret}@127.0.0.1:5432/mn_bootcamp_test`;
    const cleaned = redactDatabaseUrl(`connect failed for ${url} as mn`, url);
    expect(cleaned).not.toContain(secret);
    expect(cleaned).not.toContain('mn:');
    expect(cleaned).toContain('[database]');
  });

  it('exits 2 when DATABASE_URL is unset and does not print a decoy secret', async () => {
    const secret = 's3cret-not-a-url';
    const result = await run({ DECOY_SECRET: secret });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('DATABASE_URL is not set');
    expect(`${result.stdout}${result.stderr}`).not.toContain(secret);
  });

  it('refuses to print a password when the server cannot be reached', async () => {
    const secret = 's3cret-db-password';
    const result = await run({
      DATABASE_URL: `postgres://mn:${secret}@127.0.0.1:1/mn_bootcamp_test`,
    });
    expect(result.status).toBe(2);
    expect(`${result.stdout}${result.stderr}`).not.toContain(secret);
    expect(result.stderr).toContain('could not read the catalog');
  });
});

function run(extra: Record<string, string>): Promise<{
  status: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      env: { PATH: process.env.PATH ?? '', ...extra },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}
