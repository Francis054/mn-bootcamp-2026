/**
 * Page reads and the session check share a generous ceiling.
 * A low `RATE_LIMIT_MAX` must not pull that ceiling down to the write limit,
 * and a high test setting must not be capped below what the tests send.
 */
export const PUBLIC_READ_RATE_LIMIT_MAX = 600;

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Sign-in, password reset, uploads, and other changes. Reads and preflight are not included. */
export function isWriteMethod(method: string): boolean {
  return WRITE_METHODS.has(method.toUpperCase());
}

export function readRateLimitMax(configuredMax: number): number {
  return Math.max(PUBLIC_READ_RATE_LIMIT_MAX, configuredMax);
}
