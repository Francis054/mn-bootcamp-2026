import type { Role } from '../users/role.js';

export interface Actor {
  userId: string | null;
  /** Present on media routes so an administrator can consent and publish together. */
  role?: Role | null;
  ip: string | null;
  requestId: string | null;
}

export function isoTimestamp(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}
