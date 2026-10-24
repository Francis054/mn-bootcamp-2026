export const APP_TODAY = new Date('2026-10-24T10:00:00Z');
export const BOOTCAMP_START = '2026-10-05';

export function parseUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function formatDate(input: Date | string, options: Intl.DateTimeFormatOptions = {}): string {
  const date = typeof input === 'string' ? parseUtcDate(input) : input;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC', ...options });
}

export function weekStart(week: number): string {
  const date = parseUtcDate(BOOTCAMP_START);
  date.setUTCDate(date.getUTCDate() + (week - 1) * 7);
  return date.toISOString().slice(0, 10);
}

export function scheduleFor(date: string, today: Date = APP_TODAY): 'done' | 'now' | 'upcoming' {
  const start = parseUtcDate(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  if (today > end) return 'done';
  if (today >= start) return 'now';
  return 'upcoming';
}

export function currentWeek(today: Date = APP_TODAY): number {
  const elapsed = today.getTime() - parseUtcDate(BOOTCAMP_START).getTime();
  return Math.min(12, Math.floor(elapsed / 604_800_000) + 1);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function includesQuery(query: string, parts: Array<string | undefined>): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return parts.filter(Boolean).join(' ').toLowerCase().includes(needle);
}

export function paginate<T>(items: T[], page = 1, pageSize = 8): { items: T[]; page: number; pageSize: number; total: number } {
  const size = Math.max(1, pageSize);
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * size;
  return { items: items.slice(start, start + size), page: current, pageSize: size, total };
}

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
