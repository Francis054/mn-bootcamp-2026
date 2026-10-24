import { describe, expect, it } from 'vitest';
import { validateDto } from '../../src/shared/validation/validate-dto.js';
import { AUDIT_ACTIONS } from '../../src/modules/auth/audit-event.entity.js';
import { ApiError } from '../../src/shared/errors/api-error.js';
import { readTraineeListQuery } from '../../src/modules/trainees/list-query.js';
import { toPublicTrainee, type TraineeRecord } from '../../src/modules/trainees/records.js';
import { TraineeCreateDto } from '../../src/modules/trainees/trainee.dto.js';
import {
  displayNameMessage,
  emailMessage,
  optionalHttpUrlMessage,
  trackMessage,
} from '../../src/modules/trainees/trainee.rules.js';
import { consentWrite, isPublicTrainee } from '../../src/modules/trainees/visibility.js';

const profile: TraineeRecord = {
  id: '1',
  displayName: 'Sample Trainee 01',
  initials: 'T1',
  hue: 140,
  email: 'trainee01@example.test',
  track: 'Blue team',
  focus: 'network',
  skills: ['Linux'],
  bio: 'Placeholder biography.',
  quote: 'Sample quote.',
  linkedin: 'https://profiles.example.test/private-link',
  portfolio: 'https://profiles.example.test/private-portfolio',
  consentReceived: true,
  consentReceivedAt: '2026-10-24T00:00:00.000Z',
  consentRecordedBy: 'account-id',
  consentWithdrawnAt: null,
  listing: 'sample',
  publicationStatus: 'published',
  statusLabel: 'In training',
  internalNotes: 'Development fixture. Do not replace with a real person without written consent.',
  updatedAt: '2026-10-24T00:00:00.000Z',
};

describe('trainee rules', () => {
  it('shows a profile only when it is published, not hidden, and consent was given', () => {
    expect(isPublicTrainee(profile)).toBe(true);
    expect(isPublicTrainee({ ...profile, consentReceived: false })).toBe(false);
    expect(isPublicTrainee({ ...profile, listing: 'hidden' })).toBe(false);
    expect(isPublicTrainee({ ...profile, publicationStatus: 'draft' })).toBe(false);
    expect(isPublicTrainee({ ...profile, publicationStatus: 'scheduled' })).toBe(false);
  });

  it('unpublishes as soon as consent is withdrawn, and refuses a publish without it', () => {
    expect(
      consentWrite({
        currentConsent: true,
        requestedConsent: false,
        requestedStatus: 'published',
      }),
    ).toEqual({ publicationStatus: 'draft', withdrawing: true });
    expect(
      consentWrite({
        currentConsent: false,
        requestedConsent: false,
        requestedStatus: 'published',
      }),
    ).toBe('refused');
    expect(
      consentWrite({
        currentConsent: false,
        requestedConsent: true,
        requestedStatus: 'published',
      }),
    ).toEqual({ publicationStatus: 'published', withdrawing: false });
  });

  it('accepts GRC & Awareness and rejects the form and fixture spellings', () => {
    expect(trackMessage('GRC & Awareness')).toBeUndefined();
    expect(trackMessage('Blue team')).toBeUndefined();
    expect(trackMessage('Red team')).toBeUndefined();
    expect(trackMessage('GRC & awareness')).toBe('Choose Blue team, Red team, or GRC & Awareness.');
    expect(trackMessage('General')).toBe('Choose Blue team, Red team, or GRC & Awareness.');
  });

  it('uses the form sentences for the name, the email, and an optional link', () => {
    expect(displayNameMessage('')).toBe('Enter a display name.');
    expect(emailMessage('')).toBe('Enter your email address.');
    expect(emailMessage('not-an-email')).toBe(
      'Enter a valid email address, like name@example.com.',
    );
    expect(optionalHttpUrlMessage('')).toBeUndefined();
    expect(optionalHttpUrlMessage('linkedin.com/in/someone')).toBe(
      'Enter a full link starting with https://',
    );
    expect(optionalHttpUrlMessage('https://example.test/lab')).toBeUndefined();
  });

  it('leaves email, links, notes, and consent off the public profile', () => {
    const visible = toPublicTrainee(profile);
    const text = JSON.stringify(visible);
    expect(text).not.toContain('trainee01@example.test');
    expect(text).not.toContain('private-link');
    expect(text).not.toContain('private-portfolio');
    expect(text).not.toContain('internalNotes');
    expect(text).not.toContain('consentReceived');
    expect(text).not.toContain('consentRecordedBy');
    expect(text).not.toContain('account-id');
    expect(text).not.toContain('Development fixture');
    expect(visible.displayName).toBe('Sample Trainee 01');
    expect(visible.track).toBe('Blue team');
    expect(Object.keys(visible).sort()).toEqual(
      [
        'bio',
        'displayName',
        'focus',
        'hue',
        'id',
        'initials',
        'listing',
        'publicationStatus',
        'quote',
        'skills',
        'statusLabel',
        'track',
      ].sort(),
    );
  });

  it('rejects a privileged field and an unknown sort', async () => {
    await expect(
      validateDto(TraineeCreateDto, {
        displayName: 'Sample Trainee',
        email: 'trainee@example.test',
        track: 'Blue team',
        focus: 'network',
        role: 'administrator',
      }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(() => readTraineeListQuery({ sort: 'password' })).toThrow(ApiError);
    expect(() => readTraineeListQuery({ sort: 'email' })).toThrow(ApiError);
    const query = readTraineeListQuery({
      q: 'Sample',
      'filters.track': 'GRC & Awareness',
      'filters.focus': 'awareness',
    });
    expect(query.pageSize).toBe(8);
    expect(query.filters.track).toBe('GRC & Awareness');
    expect(query.filters.focus).toBe('awareness');
    expect(query.sort).toBeUndefined();
  });

  it('records trainee changes with the curriculum audit actions', () => {
    expect(AUDIT_ACTIONS).toContain('curriculum.trainee.created');
    expect(AUDIT_ACTIONS).toContain('curriculum.trainee.published');
    expect(AUDIT_ACTIONS).toContain('curriculum.trainee.unpublished');
    expect(AUDIT_ACTIONS).toContain('curriculum.trainee.deleted');
  });
});
