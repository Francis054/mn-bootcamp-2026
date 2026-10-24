import type { DevSession, SessionUser } from '@/domain/types';

export interface SessionSnapshot {
  session: DevSession | null;
  expired: boolean;
}

type Listener = () => void;

let snapshot: SessionSnapshot = { session: null, expired: false };
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getSessionSnapshot(): SessionSnapshot {
  return snapshot;
}

export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSession(session: DevSession): void {
  snapshot = { session, expired: false };
  emit();
}

/** Keeps the signed-in user in memory. The session cookie stays HttpOnly. */
export function rememberSignedIn(user: SessionUser, expiresAt: string | number): void {
  const parsed = typeof expiresAt === 'number' ? expiresAt : Date.parse(expiresAt);
  setSession({
    mode: 'cookie',
    user,
    expiresAt: Number.isFinite(parsed) ? parsed : Date.now() + 1_800_000,
  });
}

export function clearSession(): void {
  snapshot = { session: null, expired: false };
  emit();
}

export function markSessionExpired(): void {
  snapshot = { session: null, expired: true };
  emit();
}

export function expireIfNeeded(): boolean {
  const current = snapshot.session;
  if (current && current.expiresAt <= Date.now()) {
    markSessionExpired();
    return true;
  }
  return false;
}

export function readActiveSession(): DevSession | null {
  expireIfNeeded();
  return snapshot.session;
}
