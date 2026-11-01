import { describe, expect, it } from 'vitest';
import { isThrottleLocked, nextFailure } from '../../src/modules/auth/login-throttle.js';

describe('login throttle', () => {
  const now = new Date('2026-10-24T12:00:00Z');

  it('locks on the fifth failure and stays locked until the window passes', () => {
    let state = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const step = nextFailure(state, now, 5, 60_000);
      expect(step.locked).toBe(false);
      state = step.next;
    }
    const fifth = nextFailure(state, now, 5, 60_000);
    expect(fifth.locked).toBe(true);
    expect(isThrottleLocked(fifth.next, new Date(now.getTime() + 1_000))).toBe(true);
    expect(isThrottleLocked(fifth.next, new Date(now.getTime() + 60_000))).toBe(false);
  });

  it('keeps the lock for the whole window the caller passes', () => {
    let state = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      state = nextFailure(state, now, 5, 15 * 60_000).next;
    }
    const fifth = nextFailure(state, now, 5, 15 * 60_000);
    expect(fifth.locked).toBe(true);
    expect(isThrottleLocked(fifth.next, new Date(now.getTime() + 14 * 60_000))).toBe(true);
    expect(isThrottleLocked(fifth.next, new Date(now.getTime() + 15 * 60_000))).toBe(false);
  });
});
