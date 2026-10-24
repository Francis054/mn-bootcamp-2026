import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scripts/keep-alive.mjs',
);

describe('keep-alive script', () => {
  it('exits 0 and does not call the network when KEEPALIVE_URL is unset', async () => {
    const result = await run({});
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('KEEPALIVE_URL is not set');
    expect(result.stderr).toBe('');
  });

  it('treats a blank KEEPALIVE_URL the same way', async () => {
    const result = await run({ KEEPALIVE_URL: '   ' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('KEEPALIVE_URL is not set');
  });

  it('rejects a URL with a password and does not print it', async () => {
    const secret = 's3cret-password';
    const result = await run({
      KEEPALIVE_URL: `https://user:${secret}@example.com/api/v1/health`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('must not include a username or password');
    expect(result.stdout).not.toContain(secret);
    expect(result.stderr).not.toContain(secret);
  });

  it('rejects a non-http URL and does not print the value', async () => {
    const secret = 's3cret-token';
    const result = await run({ KEEPALIVE_URL: `ftp://example.com/health?token=${secret}` });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('must start with http:// or https://');
    expect(`${result.stdout}${result.stderr}`).not.toContain(secret);
  });

  it('logs origin and path only when asked to show the address', async () => {
    const secret = 's3cret-query';
    const result = await run({
      KEEPALIVE_DRY_RUN: '1',
      KEEPALIVE_URL: `https://example.com/api/v1/health?token=${secret}`,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('would request https://example.com/api/v1/health');
    expect(result.stdout).not.toContain(secret);
    expect(result.stderr).not.toContain(secret);
  });

  it('records a local 200 and leaves the query string out of the log', async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.end('ok');
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        resolve();
      });
    });
    const address = server.address();
    if (address === null || typeof address === 'string') {
      server.close();
      throw new Error('The test server did not bind a port.');
    }
    const secret = 's3cret-query';
    const result = await run({
      KEEPALIVE_URL: `http://127.0.0.1:${address.port}/api/v1/health?token=${secret}`,
    });
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('-> 200');
    expect(result.stdout).toContain('/api/v1/health');
    expect(`${result.stdout}${result.stderr}`).not.toContain(secret);
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
