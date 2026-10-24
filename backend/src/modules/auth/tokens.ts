import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function newSecretToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Bind the cookie to the server secret. The database stores this digest, not the cookie. */
export function sessionTokenHash(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

export function tokensMatch(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
