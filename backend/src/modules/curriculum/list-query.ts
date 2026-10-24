import { ApiError } from '../../shared/errors/api-error.js';
import { isPublicationStatus } from './publication.js';
import { isScheduleStatus } from './schedule.js';

const SORTS = [
  'week',
  'title',
  'date',
  'moduleId',
  'publicationStatus',
  'scheduleStatus',
  'updatedAt',
] as const;

const FILTERS = ['moduleId', 'scheduleStatus', 'publicationStatus'] as const;

export type LessonSort = (typeof SORTS)[number];

export interface LessonListQuery {
  q: string;
  page: number;
  pageSize: number;
  sort?: LessonSort;
  dir: 'asc' | 'desc';
  filters: {
    moduleId?: string;
    scheduleStatus?: string;
    publicationStatus?: string;
  };
}

/**
 * Read the query string the website sends. Filters use a dot, as in
 * `filters.moduleId=network`, not a JSON blob.
 */
export function readLessonListQuery(query: Record<string, unknown>): LessonListQuery {
  const fieldErrors: Record<string, string> = {};
  const q = readString(query.q) ?? '';
  if (q.length > 200) fieldErrors.q = 'Use at most 200 characters.';

  const page = readPositive(query.page, 1, 'page', fieldErrors);
  const pageSize = readPositive(query.pageSize, 8, 'pageSize', fieldErrors);
  if (pageSize > 100) fieldErrors.pageSize = 'Use a page size from 1 to 100.';

  const sortRaw = readString(query.sort);
  let sort: LessonSort | undefined;
  if (sortRaw !== undefined) {
    if ((SORTS as readonly string[]).includes(sortRaw)) {
      sort = sortRaw as LessonSort;
    } else {
      fieldErrors.sort =
        'Sort by week, title, date, moduleId, publicationStatus, scheduleStatus, or updatedAt.';
    }
  }

  const dirRaw = readString(query.dir) ?? 'asc';
  if (dirRaw !== 'asc' && dirRaw !== 'desc') fieldErrors.dir = 'Choose asc or desc.';

  const filters: LessonListQuery['filters'] = {};
  for (const [key, value] of Object.entries(query)) {
    if (!key.startsWith('filters.')) continue;
    const name = key.slice('filters.'.length);
    const text = readString(value);
    if (!text) continue;
    if (!(FILTERS as readonly string[]).includes(name)) {
      fieldErrors[key] = 'That filter is not available.';
      continue;
    }
    if (name === 'moduleId') filters.moduleId = text;
    if (name === 'scheduleStatus') {
      if (!isScheduleStatus(text)) fieldErrors[key] = 'Choose done, now, or upcoming.';
      else filters.scheduleStatus = text;
    }
    if (name === 'publicationStatus') {
      if (!isPublicationStatus(text)) fieldErrors[key] = 'Choose a workflow state.';
      else filters.publicationStatus = text;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError('validation', 'Check the highlighted fields.', fieldErrors);
  }

  const parsed: LessonListQuery = {
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
