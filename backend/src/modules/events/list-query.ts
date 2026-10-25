import { ApiError } from '../../shared/errors/api-error.js';
import { filterEntries, readPositive, readString } from '../../shared/validation/query-fields.js';
import { isEventKind } from './event-types.js';

const SORTS = ['title', 'date', 'place', 'kind', 'publicationStatus', 'updatedAt'] as const;
const VERIFICATION = ['verified', 'tbc', 'sample'] as const;

export type EventSort = (typeof SORTS)[number];
export type EventVerification = (typeof VERIFICATION)[number];

export interface EventListQuery {
  q: string;
  page: number;
  pageSize: number;
  sort?: EventSort;
  dir: 'asc' | 'desc';
  filters: { kind?: string; verification?: EventVerification };
}

/** Read `q`, `page`, `pageSize`, `sort`, `dir`, `filters.kind`, and `filters.verification`. */
export function readEventListQuery(query: Record<string, unknown>): EventListQuery {
  const fieldErrors: Record<string, string> = {};
  const q = readString(query.q) ?? '';
  if (q.length > 200) fieldErrors.q = 'Use at most 200 characters.';

  const page = readPositive(query.page, 1, 'page', fieldErrors);
  const pageSize = readPositive(query.pageSize, 8, 'pageSize', fieldErrors);
  if (pageSize > 100) fieldErrors.pageSize = 'Use a page size from 1 to 100.';

  const sortRaw = readString(query.sort);
  let sort: EventSort | undefined;
  if (sortRaw !== undefined) {
    if ((SORTS as readonly string[]).includes(sortRaw)) sort = sortRaw as EventSort;
    else fieldErrors.sort = 'Sort by title, date, place, kind, publicationStatus, or updatedAt.';
  }

  const dirRaw = readString(query.dir) ?? 'asc';
  if (dirRaw !== 'asc' && dirRaw !== 'desc') fieldErrors.dir = 'Choose asc or desc.';

  const filters: EventListQuery['filters'] = {};
  for (const { key, name, value } of filterEntries(query)) {
    if (name === 'kind') {
      if (!isEventKind(value)) fieldErrors[key] = 'Choose a kind.';
      else filters.kind = value;
      continue;
    }
    if (name === 'verification') {
      if ((VERIFICATION as readonly string[]).includes(value)) {
        filters.verification = value as EventVerification;
      } else fieldErrors[key] = 'Choose verified, tbc, or sample.';
      continue;
    }
    fieldErrors[key] = 'That filter is not available.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError('validation', 'Check the highlighted fields.', fieldErrors);
  }

  const parsed: EventListQuery = {
    q,
    page,
    pageSize: Math.min(pageSize, 100),
    dir: dirRaw === 'desc' ? 'desc' : 'asc',
    filters,
  };
  if (sort) parsed.sort = sort;
  return parsed;
}
