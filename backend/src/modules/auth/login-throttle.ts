/** Same sentence for a known mailbox and an unknown one. It does not name a duration. */
export const TOO_MANY_REQUESTS = 'Too many requests. Wait and try again.';

export interface ThrottleState {
  failureCount: number;
  lockedUntil: Date | null;
}

export function isThrottleLocked(state: ThrottleState | null, now: Date): boolean {
  const until = state?.lockedUntil;
  return until instanceof Date && until.getTime() > now.getTime();
}

/**
 * Count one more failure. The `limit`-th failure locks the subject and
 * resets the counter. The default window is 15 minutes. The development adapter uses the same window.
 */
export function nextFailure(
  state: ThrottleState | null,
  now: Date,
  limit: number,
  lockMs: number,
): { next: ThrottleState; locked: boolean } {
  if (isThrottleLocked(state, now)) {
    return {
      next: {
        failureCount: state?.failureCount ?? 0,
        lockedUntil: state?.lockedUntil ?? null,
      },
      locked: true,
    };
  }
  const count = (state?.failureCount ?? 0) + 1;
  if (count >= limit) {
    return {
      next: { failureCount: 0, lockedUntil: new Date(now.getTime() + lockMs) },
      locked: true,
    };
  }
  return { next: { failureCount: count, lockedUntil: null }, locked: false };
}
