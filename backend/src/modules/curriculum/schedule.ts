export const BOOTCAMP_START = '2026-10-05';

/** The date the sample seed uses when it labels a lesson published or scheduled. */
export const SAMPLE_CLOCK = '2026-10-24';

export type ScheduleStatus = 'done' | 'now' | 'upcoming';

export function isScheduleStatus(value: string): value is ScheduleStatus {
  return value === 'done' || value === 'now' || value === 'upcoming';
}

/** Calendar day in Africa/Accra, as YYYY-MM-DD. Accra does not use daylight saving. */
export function accraToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Accra',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map((part) => Number(part));
  if (!year || !month || !day) return isoDate;
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function weekStart(week: number): string {
  return addDays(BOOTCAMP_START, (week - 1) * 7);
}

/**
 * A lesson spans seven days from its date. `today` is a YYYY-MM-DD string so
 * the comparison does not depend on the server's timezone.
 */
export function scheduleFor(date: string, today: string): ScheduleStatus {
  const end = addDays(date, 6);
  if (today > end) return 'done';
  if (today >= date) return 'now';
  return 'upcoming';
}

/** The same week bands the website uses: 1–4, 5–8, then the rest. */
export function phaseForWeek(week: number): 1 | 2 | 3 {
  if (week <= 4) return 1;
  if (week <= 8) return 2;
  return 3;
}
