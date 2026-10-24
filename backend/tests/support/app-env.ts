import type { AppEnv } from '../../src/config/env.js';

export function testEnv(overrides: Partial<AppEnv> = {}): AppEnv {
  return {
    nodeEnv: 'test',
    port: 0,
    databaseUrl: 'postgres://127.0.0.1:5432/mn_bootcamp_test',
    databaseSsl: false,
    frontendUrl: 'http://127.0.0.1:5173',
    logLevel: 'silent',
    trustProxy: false,
    rateLimitWindowMs: 60_000,
    rateLimitMax: 10_000,
    ...overrides,
  };
}
