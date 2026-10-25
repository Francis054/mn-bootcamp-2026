import type { Server } from 'node:http';
import { createApp } from './app.js';
import { EnvError, loadEnv } from './config/env.js';
import { AppContainer } from './composition/container.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const container = await AppContainer.create(env);
  const app = createApp(container);
  const server = app.listen(env.port, () => {
    container.logger.info({ port: env.port }, 'API listening');
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    container.logger.error(
      { name: error.name, code: safeCode(error.code) },
      'Could not start listening',
    );
    process.exit(1);
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      void shutdown(signal, server, container).catch((error: unknown) => {
        container.logger.error({ name: errorName(error) }, 'Shutdown failed');
        process.exit(1);
      });
    });
  }
}

async function shutdown(signal: string, server: Server, container: AppContainer): Promise<void> {
  container.logger.info({ signal }, 'Shutting down');
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  await container.close();
  process.exit(0);
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'Error';
}

/** Node error codes are short tokens. Anything else might be a URL, so drop it. */
function safeCode(code: unknown): string | undefined {
  if (typeof code !== 'string' || !/^[A-Za-z0-9_]{1,32}$/.test(code)) return undefined;
  return code;
}

function reportStartupFailure(error: unknown): void {
  if (error instanceof EnvError) {
    process.stderr.write(`${error.message}\n`);
    return;
  }
  const code = safeCode(
    typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined,
  );
  const suffix = code === undefined ? '' : ` ${code}`;
  const hint =
    code === 'SELF_SIGNED_CERT_IN_CHAIN'
      ? ' Set DATABASE_SSL_CA to the certificate from Supabase Database settings, SSL Configuration. Do not set DATABASE_SSL=false.'
      : '';
  process.stderr.write(`The API could not start (${errorName(error)}${suffix}).${hint}\n`);
}

void main().catch((error: unknown) => {
  reportStartupFailure(error);
  process.exit(1);
});
