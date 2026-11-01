import { describe, expect, it } from 'vitest';
import { appToday, currentWeek, setAppTodayForTests } from '@/domain/format';

describe('site clock', () => {
  it('uses the real clock unless a test pins it', () => {
    setAppTodayForTests(null);
    const real = appToday();
    expect(Math.abs(real.getTime() - Date.now())).toBeLessThan(2_000);
    setAppTodayForTests(new Date('2026-10-24T10:00:00Z'));
    expect(currentWeek()).toBe(3);
    setAppTodayForTests(new Date('2026-11-01T12:00:00Z'));
    expect(currentWeek()).toBe(4);
    setAppTodayForTests(new Date('2026-10-24T10:00:00Z'));
  });
});
