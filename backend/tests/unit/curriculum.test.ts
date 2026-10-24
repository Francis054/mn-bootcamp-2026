import { describe, expect, it } from 'vitest';
import { validateDto } from '../../src/shared/validation/validate-dto.js';
import { AUDIT_ACTIONS } from '../../src/modules/auth/audit-event.entity.js';
import { LessonCreateDto } from '../../src/modules/curriculum/lesson.dto.js';
import { lessonFieldErrors } from '../../src/modules/curriculum/lesson.rules.js';
import { readLessonListQuery } from '../../src/modules/curriculum/list-query.js';
import { isPublicRecord } from '../../src/modules/curriculum/publication.js';
import {
  SAMPLE_TRACKS,
  buildSampleLessons,
} from '../../src/modules/curriculum/sample-catalogue.js';
import { phaseForWeek, scheduleFor, weekStart } from '../../src/modules/curriculum/schedule.js';
import { ApiError } from '../../src/shared/errors/api-error.js';

describe('curriculum rules', () => {
  it('keeps a draft off the public site even when it is labelled sample', () => {
    expect(isPublicRecord({ publicationStatus: 'draft', listing: 'sample' })).toBe(false);
    expect(isPublicRecord({ publicationStatus: 'scheduled', listing: 'public' })).toBe(false);
    expect(isPublicRecord({ publicationStatus: 'published', listing: 'hidden' })).toBe(false);
    expect(isPublicRecord({ publicationStatus: 'published', listing: 'sample' })).toBe(true);
    expect(isPublicRecord({ publicationStatus: 'published', listing: 'public' })).toBe(true);
  });

  it('places weeks in the same three phases as the website', () => {
    expect(phaseForWeek(1)).toBe(1);
    expect(phaseForWeek(4)).toBe(1);
    expect(phaseForWeek(5)).toBe(2);
    expect(phaseForWeek(8)).toBe(2);
    expect(phaseForWeek(9)).toBe(3);
    expect(phaseForWeek(18)).toBe(3);
  });

  it('marks a lesson from its date, not from the server timezone', () => {
    expect(weekStart(1)).toBe('2026-10-05');
    expect(scheduleFor('2026-10-05', '2026-10-24')).toBe('done');
    expect(scheduleFor('2026-10-19', '2026-10-24')).toBe('now');
    expect(scheduleFor('2026-10-26', '2026-10-24')).toBe('upcoming');
  });

  it('uses the class form sentences and does not echo the summary', () => {
    const errors = lessonFieldErrors({
      title: 'No',
      moduleId: '',
      week: 0,
      date: '',
      summary: 'Too short',
    });
    expect(errors.title).toBe('Use at least 6 characters.');
    expect(errors.moduleId).toBe('Choose a module.');
    expect(errors.week).toBe('Enter a week from 1 to 18.');
    expect(errors.date).toBe('Pick a date.');
    expect(errors.summary).toBe('Use at least 20 characters.');
    expect(JSON.stringify(errors)).not.toContain('Too short');
  });

  it('rejects a short title through the DTO', async () => {
    await expect(
      validateDto(LessonCreateDto, {
        title: 'No',
        moduleId: 'network',
        week: 1,
        date: '2026-10-05',
        summary: 'This summary is long enough for the card.',
      }),
    ).rejects.toMatchObject({
      fieldErrors: { title: 'Use at least 6 characters.' },
    });
  });

  it('reads filters.moduleId and refuses an unknown sort', () => {
    const query = readLessonListQuery({
      q: 'firewall',
      page: '2',
      pageSize: '8',
      sort: 'week',
      dir: 'asc',
      'filters.moduleId': 'network',
    });
    expect(query.filters.moduleId).toBe('network');
    expect(query.page).toBe(2);
    expect(() => readLessonListQuery({ sort: 'password' })).toThrow(ApiError);
  });

  it('labels the third track GRC & Awareness and does not invent foundation counters', () => {
    expect(SAMPLE_TRACKS.map((track) => track.name)).toEqual([
      'Blue team',
      'Red team',
      'GRC & Awareness',
    ]);
    const lessons = buildSampleLessons();
    expect(lessons).toHaveLength(12);
    expect(lessons[0]?.publicationStatus).toBe('published');
    expect(lessons[3]?.publicationStatus).toBe('scheduled');
    const text = JSON.stringify({ tracks: SAMPLE_TRACKS, lessons });
    expect(text).not.toContain('76000');
    expect(text).not.toContain('173');
    expect(AUDIT_ACTIONS).toContain('curriculum.lesson.published');
  });
});
