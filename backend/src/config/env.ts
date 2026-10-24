import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvError';
  }
}

export type NodeEnv = 'development' | 'test' | 'production';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'silent';

/**
 * Values the process is allowed to see. Session secret is optional until
 * production, where boot refuses to start without it. Nothing in this object
 * should be written to a log.
 */
export interface AppEnv {
  nodeEnv: NodeEnv;
  port: number;
  databaseUrl: string;
  databaseSsl: boolean;
  frontendUrl: string;
  sessionSecret?: string;
  logLevel: LogLevel;
  trustProxy: boolean;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  sessionIdleTtlMs: number;
  sessionAbsoluteTtlMs: number;
  loginFailureLimit: number;
  loginLockMs: number;
  loginIpFailureLimit: number;
  /** Largest accepted upload. Defaults to 5 MB. */
  uploadMaxBytes: number;
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
}

const NODE_ENVS: readonly NodeEnv[] = ['development', 'test', 'production'];
const LOG_LEVELS: readonly LogLevel[] = ['fatal', 'error', 'warn', 'info', 'debug', 'silent'];
const SESSION_SECRET_MIN = 32;

export interface LoadEnvOptions {
  /** When false, an existing .env file is ignored. Tests use this. */
  loadDotenv?: boolean;
}

/**
 * Read process environment (and an optional .env file) and return a checked
 * configuration. Error text names the variable that failed and never repeats
 * the value, because the value may be a password or a connection URL.
 */
export function loadEnv(
  source: NodeJS.ProcessEnv = process.env,
  options: LoadEnvOptions = {},
): AppEnv {
  if (options.loadDotenv !== false) {
    loadDotenv({
      path: fileURLToPath(new URL('../../.env', import.meta.url)),
      override: false,
      quiet: true,
    });
  }

  const problems: string[] = [];
  const nodeEnv = readNodeEnv(source.NODE_ENV, problems);
  const port = readPort(source.PORT, problems);
  const databaseUrl = readDatabaseUrl(source.DATABASE_URL, problems);
  const databaseSsl = readDatabaseSsl(source.DATABASE_SSL, nodeEnv, databaseUrl, problems);
  const frontendUrl = readFrontendUrl(source.FRONTEND_URL, nodeEnv, problems);
  const sessionSecret = readSessionSecret(source.SESSION_SECRET, nodeEnv, problems);
  const logLevel = readLogLevel(source.LOG_LEVEL, problems);
  const trustProxy = readBooleanDefault(
    source.TRUST_PROXY,
    nodeEnv === 'production',
    'TRUST_PROXY',
    problems,
  );
  const rateLimitWindowMs = readPositiveInt(
    source.RATE_LIMIT_WINDOW_MS,
    60_000,
    'RATE_LIMIT_WINDOW_MS',
    problems,
  );
  const rateLimitMax = readPositiveInt(source.RATE_LIMIT_MAX, 300, 'RATE_LIMIT_MAX', problems);
  const sessionIdleTtlMs = readPositiveInt(
    source.SESSION_IDLE_TTL_MS,
    1_800_000,
    'SESSION_IDLE_TTL_MS',
    problems,
  );
  const sessionAbsoluteTtlMs = readPositiveInt(
    source.SESSION_ABSOLUTE_TTL_MS,
    43_200_000,
    'SESSION_ABSOLUTE_TTL_MS',
    problems,
  );
  const loginFailureLimit = readPositiveInt(
    source.LOGIN_FAILURE_LIMIT,
    5,
    'LOGIN_FAILURE_LIMIT',
    problems,
  );
  const loginLockMs = readPositiveInt(source.LOGIN_LOCK_MS, 60_000, 'LOGIN_LOCK_MS', problems);
  const loginIpFailureLimit = readPositiveInt(
    source.LOGIN_IP_FAILURE_LIMIT,
    30,
    'LOGIN_IP_FAILURE_LIMIT',
    problems,
  );
  const uploadMaxBytes = readUploadMax(source.UPLOAD_MAX_BYTES, problems);
  const cloudinaryCloudName = readOptional(source.CLOUDINARY_CLOUD_NAME);
  const cloudinaryApiKey = readOptional(source.CLOUDINARY_API_KEY);
  const cloudinaryApiSecret = readOptional(source.CLOUDINARY_API_SECRET);
  const cloudinaryCount = [cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret].filter(
    (value) => value !== undefined,
  ).length;
  if (cloudinaryCount !== 0 && cloudinaryCount !== 3) {
    problems.push(
      'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must all be set, or all left blank.',
    );
  }

  if (problems.length > 0) {
    throw new EnvError(problems.join(' '));
  }

  const env: AppEnv = {
    nodeEnv,
    port,
    databaseUrl,
    databaseSsl,
    frontendUrl,
    logLevel,
    trustProxy,
    rateLimitWindowMs,
    rateLimitMax,
    sessionIdleTtlMs,
    sessionAbsoluteTtlMs,
    loginFailureLimit,
    loginLockMs,
    loginIpFailureLimit,
    uploadMaxBytes,
  };
  if (sessionSecret !== undefined) env.sessionSecret = sessionSecret;
  if (cloudinaryCloudName !== undefined) env.cloudinaryCloudName = cloudinaryCloudName;
  if (cloudinaryApiKey !== undefined) env.cloudinaryApiKey = cloudinaryApiKey;
  if (cloudinaryApiSecret !== undefined) env.cloudinaryApiSecret = cloudinaryApiSecret;
  return env;
}

function readNodeEnv(raw: string | undefined, problems: string[]): NodeEnv {
  const value = raw?.trim() || 'development';
  if (isNodeEnv(value)) return value;
  problems.push('NODE_ENV must be development, test, or production.');
  return 'development';
}

function readPort(raw: string | undefined, problems: string[]): number {
  if (raw === undefined || raw.trim() === '') return 3000;
  if (!/^[0-9]+$/.test(raw.trim())) {
    problems.push('PORT must be a whole number from 1 to 65535.');
    return 3000;
  }
  const port = Number(raw.trim());
  if (port < 1 || port > 65535) {
    problems.push('PORT must be a whole number from 1 to 65535.');
    return 3000;
  }
  return port;
}

function readDatabaseUrl(raw: string | undefined, problems: string[]): string {
  const value = raw?.trim() ?? '';
  if (value === '') {
    problems.push('DATABASE_URL is required.');
    return '';
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    problems.push('DATABASE_URL must be a postgres connection URL.');
    return '';
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    problems.push('DATABASE_URL must be a postgres connection URL.');
    return '';
  }
  return value;
}

function readDatabaseSsl(
  raw: string | undefined,
  nodeEnv: NodeEnv,
  databaseUrl: string,
  problems: string[],
): boolean {
  if (raw === undefined || raw.trim() === '') {
    if (nodeEnv === 'production') return true;
    return /[?&]sslmode=(require|verify-full|verify-ca)(?:&|$)/.test(databaseUrl);
  }
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  problems.push('DATABASE_SSL must be true or false.');
  return false;
}

function readFrontendUrl(raw: string | undefined, nodeEnv: NodeEnv, problems: string[]): string {
  const value = raw?.trim() ?? '';
  if (value === '') {
    if (nodeEnv === 'production') {
      problems.push('FRONTEND_URL is required in production.');
      return '';
    }
    return 'http://127.0.0.1:5173';
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    problems.push('FRONTEND_URL must be an http or https origin.');
    return '';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    problems.push('FRONTEND_URL must be an http or https origin.');
    return '';
  }
  if (parsed.username !== '' || parsed.password !== '') {
    problems.push('FRONTEND_URL must not include a username or password.');
    return '';
  }
  if (parsed.origin === 'null') {
    problems.push('FRONTEND_URL must be an http or https origin.');
    return '';
  }
  return parsed.origin;
}

function readSessionSecret(
  raw: string | undefined,
  nodeEnv: NodeEnv,
  problems: string[],
): string | undefined {
  if (raw === undefined || raw === '') {
    if (nodeEnv === 'production') {
      problems.push('SESSION_SECRET is required in production and must be at least 32 characters.');
    }
    return undefined;
  }
  if (raw.length < SESSION_SECRET_MIN) {
    problems.push('SESSION_SECRET must be at least 32 characters.');
    return undefined;
  }
  return raw;
}

function readLogLevel(raw: string | undefined, problems: string[]): LogLevel {
  const value = raw?.trim() || 'info';
  if (isLogLevel(value)) return value;
  problems.push('LOG_LEVEL must be fatal, error, warn, info, debug, or silent.');
  return 'info';
}

function readBooleanDefault(
  raw: string | undefined,
  fallback: boolean,
  name: string,
  problems: string[],
): boolean {
  if (raw === undefined || raw.trim() === '') return fallback;
  if (raw.trim() === 'true') return true;
  if (raw.trim() === 'false') return false;
  problems.push(`${name} must be true or false.`);
  return fallback;
}

function readPositiveInt(
  raw: string | undefined,
  fallback: number,
  name: string,
  problems: string[],
): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  if (!/^[0-9]+$/.test(raw.trim())) {
    problems.push(`${name} must be a positive whole number.`);
    return fallback;
  }
  const value = Number(raw.trim());
  if (value < 1) {
    problems.push(`${name} must be a positive whole number.`);
    return fallback;
  }
  return value;
}

const UPLOAD_MAX_DEFAULT = 5 * 1024 * 1024;
const UPLOAD_MAX_CEILING = 10 * 1024 * 1024;

function readUploadMax(raw: string | undefined, problems: string[]): number {
  if (raw === undefined || raw.trim() === '') return UPLOAD_MAX_DEFAULT;
  if (!/^[0-9]+$/.test(raw.trim())) {
    problems.push('UPLOAD_MAX_BYTES must be a whole number from 1 to 10485760.');
    return UPLOAD_MAX_DEFAULT;
  }
  const value = Number(raw.trim());
  if (value < 1 || value > UPLOAD_MAX_CEILING) {
    problems.push('UPLOAD_MAX_BYTES must be a whole number from 1 to 10485760.');
    return UPLOAD_MAX_DEFAULT;
  }
  return value;
}

function readOptional(raw: string | undefined): string | undefined {
  const value = raw?.trim() ?? '';
  return value === '' ? undefined : value;
}

function isNodeEnv(value: string): value is NodeEnv {
  return NODE_ENVS.some((item) => item === value);
}

function isLogLevel(value: string): value is LogLevel {
  return LOG_LEVELS.some((item) => item === value);
}
