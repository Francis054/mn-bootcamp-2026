import { describe, expect, it } from 'vitest';
import { EnvError, loadEnv } from '../../src/config/env.js';

const SECRET = 'super-secret-session-value-not-for-logs';
const DATABASE = 'postgres://app:super-secret-db-password@db.internal:5432/mn_bootcamp';

function productionSource(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: DATABASE,
    FRONTEND_URL: 'https://example.org',
    SESSION_SECRET: SECRET,
    ...extra,
  };
}

describe('loadEnv', () => {
  it('fills development defaults and does not invent a session secret', () => {
    const env = loadEnv(
      { DATABASE_URL: 'postgres://127.0.0.1:5432/mn_bootcamp' },
      { loadDotenv: false },
    );
    expect(env.nodeEnv).toBe('development');
    expect(env.port).toBe(3000);
    expect(env.frontendUrl).toBe('http://127.0.0.1:5173');
    expect(env.databaseSsl).toBe(false);
    expect(env.trustProxy).toBe(false);
    expect(env.logLevel).toBe('info');
    expect(env.rateLimitMax).toBe(300);
    expect(env.sessionSecret).toBeUndefined();
  });

  it('requires the database, the public origin, and a long session secret in production', () => {
    const env = loadEnv(productionSource(), { loadDotenv: false });
    expect(env.databaseSsl).toBe(true);
    expect(env.trustProxy).toBe(true);
    expect(env.frontendUrl).toBe('https://example.org');
    expect(env.sessionSecret).toBe(SECRET);
  });

  it('uses the origin only, so a path on FRONTEND_URL cannot widen CORS', () => {
    const env = loadEnv(productionSource({ FRONTEND_URL: 'https://example.org/admin' }), {
      loadDotenv: false,
    });
    expect(env.frontendUrl).toBe('https://example.org');
  });

  it('turns sslmode=require on when DATABASE_SSL is unset outside production', () => {
    const env = loadEnv(
      { DATABASE_URL: 'postgres://127.0.0.1:5432/mn_bootcamp?sslmode=require' },
      { loadDotenv: false },
    );
    expect(env.databaseSsl).toBe(true);
  });

  it('names missing production variables and does not repeat secret values', () => {
    expect.assertions(2);
    try {
      loadEnv(
        {
          NODE_ENV: 'production',
          DATABASE_URL: 'not a url',
          SESSION_SECRET: 'short',
          DATABASE_SSL: 'maybe',
        },
        { loadDotenv: false },
      );
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      const message = error instanceof Error ? error.message : '';
      expect(message).toBe(
        'DATABASE_URL must be a postgres connection URL. DATABASE_SSL must be true or false. FRONTEND_URL is required in production. SESSION_SECRET must be at least 32 characters.',
      );
    }
  });

  it('rejects a blank database URL without echoing other variables', () => {
    expect(() => loadEnv({ DATABASE_URL: '  ' }, { loadDotenv: false })).toThrow(
      'DATABASE_URL is required.',
    );
  });
});
