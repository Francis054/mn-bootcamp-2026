import { ApiError } from '../../shared/errors/api-error.js';
import { isTraineeTrack } from './tracks.js';

const SORTS = [
  'displayName',
  'track',
  'focus',
  'publicationStatus',
  'statusLabel',
  'updatedAt',
] as const;

const FILTERS = ['track', 'focus'] as const;

export type TraineeSort = (typeof SORTS)[number];

export interface TraineeListQuery {
  q: string;
  page: number;
  pageSize: number;
  sort?: TraineeSort;
  dir: 'asc' | 'desc';
  filters: {
    track?: string;
    focus?: string;
  };
}

/**
 * Read the query string the website sends. Filters use a dot, as in
 * `filters.track=Blue team`. The search box matches the display name, the
 * track, and the skills. It does not match the email.
 */
export function readTraineeListQuery(query: Record<string, unknown>): TraineeListQuery {
  const fieldErrors: Record<string, string> = {};
  const q = readString(query.q) ?? '';
  if (q.length > 200) fieldErrors.q = 'Use at most 200 characters.';

  const page = readPositive(query.page, 1, 'page', fieldErrors);
  const pageSize = readPositive(query.pageSize, 8, 'pageSize', fieldErrors);
  if (pageSize > 100) fieldErrors.pageSize = 'Use a page size from 1 to 100.';

  const sortRaw = readString(query.sort);
  let sort: TraineeSort | undefined;
  if (sortRaw !== undefined) {
    if ((SORTS as readonly string[]).includes(sortRaw)) {
      sort = sortRaw as TraineeSort;
    } else {
      fieldErrors.sort =
        'Sort by displayName, track, focus, publicationStatus, statusLabel, or updatedAt.';
    }
  }

  const dirRaw = readString(query.dir) ?? 'asc';
  if (dirRaw !== 'asc' && dirRaw !== 'desc') fieldErrors.dir = 'Choose asc or desc.';

  const filters: TraineeListQuery['filters'] = {};
  for (const [key, value] of Object.entries(query)) {
    if (!key.startsWith('filters.')) continue;
    const name = key.slice('filters.'.length);
    const text = readString(value);
    if (!text) continue;
    if (!(FILTERS as readonly string[]).includes(name)) {
      fieldErrors[key] = 'That filter is not available.';
      continue;
    }
    if (name === 'track') {
      if (!isTraineeTrack(text)) {
        fieldErrors[key] = 'Choose Blue team, Red team, or GRC & Awareness.';
      } else {
        filters.track = text;
      }
    }
    if (name === 'focus') {
      if (!/^[a-z][a-z0-9-]{0,39}$/.test(text)) fieldErrors[key] = 'Choose a module.';
      else filters.focus = text;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError('validation', 'Check the highlighted fields.', fieldErrors);
  }

  const parsed: TraineeListQuery = {
    q,
    page,
    pageSize: Math.min(pageSize, 100),
    dir: dirRaw === 'desc' ? 'desc' : 'asc',
    filters,
  };
  if (sort) parsed.sort = sort;
  return parsed;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function readPositive(
  value: unknown,
  fallback: number,
  name: string,
  fieldErrors: Record<string, string>,
): number {
  if (value === undefined || value === '') return fallback;
  const raw = typeof value === 'string' ? value : '';
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
