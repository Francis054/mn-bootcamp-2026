import { ApiError } from '../../shared/errors/api-error.js';
import { isProjectType } from './project-types.js';

const SORTS = ['title', 'type', 'moduleId', 'publicationStatus', 'updatedAt'] as const;

export type ProjectSort = (typeof SORTS)[number];

export interface ProjectListQuery {
  q: string;
  page: number;
  pageSize: number;
  sort?: ProjectSort;
  dir: 'asc' | 'desc';
  filters: { type?: string };
}

/** Read `q`, `page`, `pageSize`, `sort`, `dir`, and `filters.type`. */
export function readProjectListQuery(query: Record<string, unknown>): ProjectListQuery {
  const fieldErrors: Record<string, string> = {};
  const q = readString(query.q) ?? '';
  if (q.length > 200) fieldErrors.q = 'Use at most 200 characters.';

  const page = readPositive(query.page, 1, 'page', fieldErrors);
  const pageSize = readPositive(query.pageSize, 8, 'pageSize', fieldErrors);
  if (pageSize > 100) fieldErrors.pageSize = 'Use a page size from 1 to 100.';

  const sortRaw = readString(query.sort);
  let sort: ProjectSort | undefined;
  if (sortRaw !== undefined) {
    if ((SORTS as readonly string[]).includes(sortRaw)) sort = sortRaw as ProjectSort;
    else fieldErrors.sort = 'Sort by title, type, moduleId, publicationStatus, or updatedAt.';
  }

  const dirRaw = readString(query.dir) ?? 'asc';
  if (dirRaw !== 'asc' && dirRaw !== 'desc') fieldErrors.dir = 'Choose asc or desc.';

  const filters: ProjectListQuery['filters'] = {};
  for (const [key, value] of Object.entries(query)) {
    if (!key.startsWith('filters.')) continue;
    const name = key.slice('filters.'.length);
    const text = readString(value);
    if (!text) continue;
    if (name !== 'type') {
      fieldErrors[key] = 'That filter is not available.';
      continue;
    }
    if (!isProjectType(text)) fieldErrors[key] = 'Choose a type.';
    else filters.type = text;
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError('validation', 'Check the highlighted fields.', fieldErrors);
  }

  const parsed: ProjectListQuery = {
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
