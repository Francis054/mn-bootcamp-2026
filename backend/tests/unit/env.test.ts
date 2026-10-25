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
    expect(env.databaseSslCa).toBeUndefined();
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
    expect(env.databaseSslCa).toBeUndefined();
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

  it('keeps a PEM CA and turns literal line breaks into real ones', () => {
    const body = 'MIIBTESTCERTIFICATEBODYX';
    const pem = `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----`;
    const withNewlines = loadEnv(productionSource({ DATABASE_SSL_CA: pem }), {
      loadDotenv: false,
    });
    expect(withNewlines.databaseSslCa).toBe(pem);

    const escaped = loadEnv(
      productionSource({
        DATABASE_SSL_CA: `"-----BEGIN CERTIFICATE-----\\n${body}\\n-----END CERTIFICATE-----"`,
      }),
      { loadDotenv: false },
    );
    expect(escaped.databaseSslCa).toBe(pem);
    expect(escaped.databaseSsl).toBe(true);

    const wrapped = [
      '-----BEGIN CERTIFICATE-----',
      'MIIB',
      'TEST',
      'CERT',
      'IFIC',
      'ATEB',
      'ODYX',
      '-----END CERTIFICATE-----',
    ].join('\n');
    const fromFile = loadEnv(productionSource({ DATABASE_SSL_CA: wrapped }), {
      loadDotenv: false,
    });
    expect(fromFile.databaseSslCa).toBe(wrapped);
  });

  it('accepts a chain of PEM certificates', () => {
    const chain = [
      '-----BEGIN CERTIFICATE-----',
      'MIIBTESTCERTIFICATEBODYX',
      '-----END CERTIFICATE-----',
      '-----BEGIN CERTIFICATE-----',
      'QUJDRA==',
      '-----END CERTIFICATE-----',
    ].join('\n');
    const env = loadEnv(productionSource({ DATABASE_SSL_CA: `\uFEFF${chain}\r\n` }), {
      loadDotenv: false,
    });
    expect(env.databaseSslCa).toBe(chain);
  });

  it('rejects a CA that is not a PEM and does not repeat the value', () => {
    const marker = 'not-the-certificate-text';
    expect.assertions(3);
    try {
      loadEnv(productionSource({ DATABASE_SSL_CA: marker }), { loadDotenv: false });
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      const message = error instanceof Error ? error.message : '';
      expect(message).toBe('DATABASE_SSL_CA must be a PEM certificate.');
      expect(message).not.toContain(marker);
    }
  });

  it('rejects a CA file path instead of reading it', () => {
    const path = '/tmp/prod-ca-2021.crt';
    expect.assertions(2);
    try {
      loadEnv(productionSource({ DATABASE_SSL_CA: path }), { loadDotenv: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      expect(message).toBe('DATABASE_SSL_CA must be a PEM certificate.');
      expect(message).not.toContain(path);
    }
  });

  it('rejects a CA that is too large without repeating it', () => {
    expect.assertions(2);
    try {
      loadEnv(productionSource({ DATABASE_SSL_CA: 'A'.repeat(64 * 1024 + 1) }), {
        loadDotenv: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      expect(message).toBe('DATABASE_SSL_CA is too large.');
      expect(message).not.toContain('AAA');
    }
  });

  it('refuses a CA when SSL is off, and does not repeat the certificate', () => {
    const body = 'MIIBTESTCERTIFICATEBODYX';
    expect.assertions(2);
    try {
      loadEnv(
        {
          DATABASE_URL: 'postgres://127.0.0.1:5432/mn_bootcamp',
          DATABASE_SSL: 'false',
          DATABASE_SSL_CA: `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----`,
        },
        { loadDotenv: false },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      expect(message).toBe(
        'DATABASE_SSL_CA requires DATABASE_SSL=true. Leave DATABASE_SSL_CA blank when SSL is off.',
      );
      expect(message).not.toContain(body);
    }
  });

  it('refuses to disable TLS checks and does not repeat the database URL', () => {
    expect.assertions(3);
    try {
      loadEnv(productionSource({ NODE_TLS_REJECT_UNAUTHORIZED: '0' }), { loadDotenv: false });
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      const message = error instanceof Error ? error.message : '';
      expect(message).toBe(
        'NODE_TLS_REJECT_UNAUTHORIZED must not be 0. Certificate checks stay on.',
      );
      expect(message).not.toContain('super-secret-db-password');
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
