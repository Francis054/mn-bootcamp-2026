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
    sessionSecret: 'test-session-secret-at-least-32-chars',
    sessionIdleTtlMs: 1_800_000,
    sessionAbsoluteTtlMs: 43_200_000,
    loginFailureLimit: 5,
    loginLockMs: 60_000,
    loginIpFailureLimit: 30,
    uploadMaxBytes: 5 * 1024 * 1024,
    videoUploadMaxBytes: 50 * 1024 * 1024,
    traineeSignupMode: 'roster',
    devMailLog: false,
    ...overrides,
  };
}
