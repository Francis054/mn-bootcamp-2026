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
    expect(env.sessionIdleTtlMs).toBe(1_800_000);
    expect(env.sessionAbsoluteTtlMs).toBe(43_200_000);
    expect(env.loginFailureLimit).toBe(5);
    expect(env.loginLockMs).toBe(60_000);
    expect(env.loginIpFailureLimit).toBe(30);
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

  it('defaults the upload cap to 5 MB and leaves Cloudinary unset', () => {
    const env = loadEnv(
      { DATABASE_URL: 'postgres://127.0.0.1:5432/mn_bootcamp' },
      { loadDotenv: false },
    );
    expect(env.uploadMaxBytes).toBe(5 * 1024 * 1024);
    expect(env.cloudinaryCloudName).toBeUndefined();
    expect(env.cloudinaryApiKey).toBeUndefined();
    expect(env.cloudinaryApiSecret).toBeUndefined();
  });

  it('refuses a partial Cloudinary setup and does not repeat the values', () => {
    expect.assertions(3);
    try {
      loadEnv(
        productionSource({
          CLOUDINARY_CLOUD_NAME: 'example-cloud',
          CLOUDINARY_API_KEY: 'key-value',
        }),
        { loadDotenv: false },
      );
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      const message = error instanceof Error ? error.message : '';
      expect(message).toBe(
        'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must all be set, or all left blank.',
      );
      expect(message).not.toContain('example-cloud');
    }
  });

  it('leaves mail unset until both values are present, and does not repeat a partial value', () => {
    const blank = loadEnv(
      { DATABASE_URL: 'postgres://127.0.0.1:5432/mn_bootcamp' },
      { loadDotenv: false },
    );
    expect(blank.resendApiKey).toBeUndefined();
    expect(blank.emailFrom).toBeUndefined();
    expect.assertions(5);
    try {
      loadEnv(productionSource({ RESEND_API_KEY: 'secret-key-value' }), { loadDotenv: false });
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      const message = error instanceof Error ? error.message : '';
      expect(message).toBe('RESEND_API_KEY and EMAIL_FROM must both be set, or both left blank.');
      expect(message).not.toContain('secret-key-value');
    }
  });
});
