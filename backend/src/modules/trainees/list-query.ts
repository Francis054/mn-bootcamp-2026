import { ApiError } from '../../shared/errors/api-error.js';
import { filterEntries, readPositive, readString } from '../../shared/validation/query-fields.js';
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
  for (const { key, name, value } of filterEntries(query)) {
    if (!(FILTERS as readonly string[]).includes(name)) {
      fieldErrors[key] = 'That filter is not available.';
      continue;
    }
    if (name === 'track') {
      if (!isTraineeTrack(value)) {
        fieldErrors[key] = 'Choose Blue team, Red team, or GRC & Awareness.';
      } else {
        filters.track = value;
      }
    }
    if (name === 'focus') {
      if (!/^[a-z][a-z0-9-]{0,39}$/.test(value)) fieldErrors[key] = 'Choose a module.';
      else filters.focus = value;
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
