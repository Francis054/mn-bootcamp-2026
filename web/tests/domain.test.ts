import { describe, expect, it } from 'vitest';
import { can } from '@/domain/permissions';
import { isPubliclyListable } from '@/domain/publish';
import { toPublicLesson, toPublicTrainee } from '@/domain/publicView';
import { collect, emailAddress, minLength } from '@/domain/validate';
import { buildLessons, buildTrainees } from '@/dev/fixtures';

describe('publication rules', () => {
  it('shows labelled samples and hides drafts that are not samples', () => {
    expect(isPubliclyListable({ listing: 'sample', publicationStatus: 'draft' })).toBe(true);
    expect(isPubliclyListable({ listing: 'hidden', publicationStatus: 'published' })).toBe(false);
    expect(isPubliclyListable({ listing: 'public', publicationStatus: 'draft' })).toBe(false);
    expect(isPubliclyListable({ listing: 'public', publicationStatus: 'published' })).toBe(true);
  });

  it('strips private lesson and trainee fields', () => {
    const lesson = toPublicLesson(buildLessons()[0]!);
    const trainee = toPublicTrainee(buildTrainees()[0]!);
    expect(lesson).not.toHaveProperty('internalNotes');
    expect(trainee).not.toHaveProperty('email');
    expect(trainee).not.toHaveProperty('linkedin');
    expect(trainee.displayName).toMatch(/Sample/);
  });
});

describe('permissions', () => {
  it('does not treat every signed-in role as an administrator', () => {
    expect(can('viewer', 'content.write')).toBe(false);
    expect(can('viewer', 'content.read')).toBe(true);
    expect(can('editor', 'content.write')).toBe(true);
    expect(can('editor', 'users.manage')).toBe(false);
    expect(can('administrator', 'settings.manage')).toBe(true);
  });
});

describe('validation', () => {
  it('collects field messages', () => {
    const errors = collect({
      email: emailAddress('not-an-email'),
      note: minLength('short', 20),
    });
    expect(errors.email).toBeTruthy();
    expect(errors.note).toMatch(/20/);
  });
});
