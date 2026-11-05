import { createHmac, timingSafeEqual } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SignedCvLink {
  documentId: string;
  expired: boolean;
  /** Missing on older public links. A request link is emailed for an on-request CV. */
  purpose: 'public' | 'request';
}

/**
 * HMAC token for a public CV download. The payload is the document id and an
 * expiry. It is not a storage URL. A bad signature is rejected before the expiry is read.
 */
export function signCvLink(input: {
  secret: string;
  documentId: string;
  nowMs: number;
  ttlMs: number;
  purpose?: 'public' | 'request';
}): string {
  const body: { id: string; exp: number; purpose?: 'request' } = {
    id: input.documentId,
    exp: input.nowMs + input.ttlMs,
  };
  if (input.purpose === 'request') body.purpose = 'request';
  const payload = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
  const signature = createHmac('sha256', input.secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function readCvLink(token: string, secret: string, nowMs: number): SignedCvLink | null {
  const dot = token.indexOf('.');
  if (dot <= 0 || dot !== token.lastIndexOf('.')) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!isRecord(parsed) || typeof parsed.id !== 'string' || typeof parsed.exp !== 'number')
    return null;
  if (!UUID.test(parsed.id) || !Number.isFinite(parsed.exp)) return null;
  if (parsed.purpose !== undefined && parsed.purpose !== 'request') return null;
  return {
    documentId: parsed.id,
    expired: nowMs >= parsed.exp,
    purpose: parsed.purpose === 'request' ? 'request' : 'public',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
