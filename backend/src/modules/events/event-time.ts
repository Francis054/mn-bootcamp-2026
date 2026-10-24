import type { Listing, PublicationStatus } from '../curriculum/publication.js';

/**
 * Ghana does not use daylight saving. Africa/Accra wall time is UTC all year,
 * so a start of 17:00 is 17:00 UTC. An empty clock means midnight on that date.
 */
export function accraInstant(date: string, time: string): Date | undefined {
  if (!isCalendarDate(date)) return undefined;
  const clock = time === '' ? '00:00' : time;
  const parts = readClock(clock);
  if (!parts) return undefined;
  const [year, month, day] = date.split('-').map((part) => Number(part));
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, parts.hour, parts.minute, 0));
}

export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * A published event is public unless it is hidden. A scheduled event stays off
 * the public routes until its Accra start. A date that is still to be confirmed
 * has no start, so it does not become public on its own.
 */
export function isPublicEvent(
  row: {
    publicationStatus: PublicationStatus;
    listing: Listing;
    date: string;
    dateTbc: boolean;
    startTime: string;
  },
  now: Date,
): boolean {
  if (row.listing === 'hidden') return false;
  if (row.publicationStatus === 'published') return true;
  if (row.publicationStatus !== 'scheduled' || row.dateTbc) return false;
  const start = accraInstant(row.date, row.startTime);
  if (!start) return false;
  return now.getTime() >= start.getTime();
}

export function dateMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return 'Pick a date.';
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (!isCalendarDate(trimmed)) return 'Pick a date.';
  return undefined;
}

export function clockMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return 'Use 24-hour time, like 17:00.';
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (!readClock(trimmed)) return 'Use 24-hour time, like 17:00.';
  return undefined;
}

export function scheduleProblems(input: {
  date: string;
  dateTbc: boolean;
  startTime: string;
  endTime: string;
}): Record<string, string> {
  const problems: Record<string, string> = {};
  if (!input.dateTbc && input.date === '') problems.date = 'Pick a date.';
  if (input.dateTbc && (input.startTime !== '' || input.endTime !== '')) {
    problems.startTime = 'Leave the times blank while the date is to be confirmed.';
    return problems;
  }
  if (input.endTime !== '' && input.startTime === '') {
    problems.startTime = 'Enter a start time.';
  }
  if (input.startTime !== '' && input.endTime !== '') {
    const start = minutes(input.startTime);
    const end = minutes(input.endTime);
    if (start !== undefined && end !== undefined && end <= start) {
      problems.endTime = 'End the event after it starts.';
    }
  }
  return problems;
}

function readClock(value: string): { hour: number; minute: number } | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return undefined;
  return { hour, minute };
}

function minutes(value: string): number | undefined {
  const clock = readClock(value);
  if (!clock) return undefined;
  return clock.hour * 60 + clock.minute;
}
