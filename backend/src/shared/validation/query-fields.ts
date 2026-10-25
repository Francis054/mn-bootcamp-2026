/**
 * Shared readers for admin list queries. The website sends filters as
 * `filters.moduleId=network`. Express can also nest that as `filters[moduleId]`
 * or `{ filters: { moduleId } }`, and a page size can arrive as a number.
 */

export function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function readPositive(
  value: unknown,
  fallback: number,
  name: string,
  fieldErrors: Record<string, string>,
): number {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      fieldErrors[name] = 'Use a whole number.';
      return fallback;
    }
    if (value < 1) {
      fieldErrors[name] = 'Use a whole number of at least 1.';
      return fallback;
    }
    return value;
  }
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!/^[0-9]+$/.test(raw)) {
    fieldErrors[name] = 'Use a whole number.';
    return fallback;
  }
  const parsed = Number(raw);
  if (parsed < 1) {
    fieldErrors[name] = 'Use a whole number of at least 1.';
    return fallback;
  }
  return parsed;
}

export interface FilterEntry {
  /** The query key to name in a validation message, such as `filters.moduleId`. */
  key: string;
  name: string;
  value: string;
}

/**
 * Collect filter values. A dotted key overrides the same name nested under
 * `filters`. Empty values are skipped.
 */
export function filterEntries(query: Record<string, unknown>): FilterEntry[] {
  const found = new Map<string, FilterEntry>();
  const nested = query.filters;
  if (isRecord(nested)) {
    for (const [name, value] of Object.entries(nested)) {
      const text = readString(value);
      if (!text) continue;
      found.set(name, { key: `filters.${name}`, name, value: text });
    }
  }
  for (const [key, value] of Object.entries(query)) {
    const name = filterName(key);
    if (!name) continue;
    const text = readString(value);
    if (!text) continue;
    found.set(name, { key, name, value: text });
  }
  return [...found.values()];
}

function filterName(key: string): string | undefined {
  if (key.startsWith('filters.') && key.length > 'filters.'.length) {
    return key.slice('filters.'.length);
  }
  const bracket = /^filters\[([^\]]+)\]$/.exec(key);
  return bracket?.[1];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
