import { pino, type Logger } from 'pino';
import type { AppEnv } from '../../config/env.js';

export type AppLogger = Logger;

/**
 * JSON logs on stdout. Redact common secret fields if a later caller passes
 * them by mistake. Do not log request bodies, cookies, or connection URLs.
 */
export function createLogger(env: AppEnv): AppLogger {
  return pino({
    level: env.logLevel,
    base: null,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'password',
        'sessionSecret',
        'databaseUrl',
        'databaseSslCa',
        'DATABASE_URL',
        'DATABASE_SSL_CA',
        'SESSION_SECRET',
        'ADMIN_PASSWORD',
        'ADMIN_BOOTSTRAP_PASSWORD',
        'passwordHash',
      ],
      censor: '[redacted]',
    },
  });
}
