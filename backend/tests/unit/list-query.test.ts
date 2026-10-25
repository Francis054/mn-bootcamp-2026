import { describe, expect, it } from 'vitest';
import { readEventListQuery } from '../../src/modules/events/list-query.js';
import { readLessonListQuery } from '../../src/modules/curriculum/list-query.js';
import { readProjectListQuery } from '../../src/modules/projects/list-query.js';
import { readTraineeListQuery } from '../../src/modules/trainees/list-query.js';
import { ApiError } from '../../src/shared/errors/api-error.js';

describe('admin list queries', () => {
  it('accepts a numeric page size and a nested filter', () => {
    const lessons = readLessonListQuery({
      page: 2,
      pageSize: 100,
      filters: { moduleId: 'network' },
    });
    expect(lessons.page).toBe(2);
    expect(lessons.pageSize).toBe(100);
    expect(lessons.filters.moduleId).toBe('network');

    const trainees = readTraineeListQuery({ pageSize: 20, filters: { focus: 'ethical' } });
    expect(trainees.filters.focus).toBe('ethical');

    const projects = readProjectListQuery({ pageSize: 8, filters: { type: 'Lab' } });
    expect(projects.filters.type).toBe('Lab');

    const events = readEventListQuery({
      pageSize: 8,
      'filters.kind': 'Milestone',
    });
    expect(events.filters.kind).toBe('Milestone');
  });

  it('lets a dotted filter override the nested value', () => {
    const query = readLessonListQuery({
      filters: { moduleId: 'network' },
      'filters.moduleId': 'ethical',
    });
    expect(query.filters.moduleId).toBe('ethical');
  });

  it('still refuses a page size above 100', () => {
    expect(() => readLessonListQuery({ pageSize: 101 })).toThrow(ApiError);
    expect(() => readEventListQuery({ pageSize: '1000' })).toThrow(ApiError);
    try {
      readProjectListQuery({ pageSize: 101 });
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).fieldErrors?.pageSize).toBe('Use a page size from 1 to 100.');
    }
  });

  it('still refuses an unknown filter', () => {
    expect(() => readTraineeListQuery({ 'filters.password': 'secret' })).toThrow(ApiError);
  });
});
