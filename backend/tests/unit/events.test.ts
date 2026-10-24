import { describe, expect, it } from 'vitest';
import { isPublicEvent, scheduleProblems } from '../../src/modules/events/event-time.js';
import { buildSampleEvents } from '../../src/modules/events/sample-events.js';
import { sourceUrlProblem } from '../../src/modules/events/source-url.js';
import type { Listing, PublicationStatus } from '../../src/modules/curriculum/publication.js';

const PUBLIC = {
  publicationStatus: 'published' as PublicationStatus,
  listing: 'public' as Listing,
  date: '2026-11-16',
  dateTbc: false,
  startTime: '09:00',
};

describe('event visibility and times', () => {
  it('keeps a scheduled event off the public site until its Accra start', () => {
    const scheduled = { ...PUBLIC, publicationStatus: 'scheduled' as const };
    const start = new Date(Date.UTC(2026, 10, 16, 9, 0, 0));
    expect(isPublicEvent(scheduled, new Date(start.getTime() - 60_000))).toBe(false);
    expect(isPublicEvent(scheduled, start)).toBe(true);
    const midnight = { ...scheduled, startTime: '' };
    expect(isPublicEvent(midnight, new Date(Date.UTC(2026, 10, 15, 23, 59, 0)))).toBe(false);
    expect(isPublicEvent(midnight, new Date(Date.UTC(2026, 10, 16, 0, 0, 0)))).toBe(true);
  });

  it('does not invent a start for a date that is still to be confirmed', () => {
    const unconfirmed = {
      ...PUBLIC,
      publicationStatus: 'scheduled' as const,
      dateTbc: true,
      startTime: '',
    };
    expect(isPublicEvent(unconfirmed, new Date(Date.UTC(2027, 0, 1)))).toBe(false);
    expect(isPublicEvent({ ...PUBLIC, listing: 'hidden' }, new Date(Date.UTC(2027, 0, 1)))).toBe(
      false,
    );
    expect(
      isPublicEvent({ ...PUBLIC, publicationStatus: 'draft' }, new Date(Date.UTC(2027, 0, 1))),
    ).toBe(false);
    expect(isPublicEvent(PUBLIC, new Date(Date.UTC(2026, 0, 1)))).toBe(true);
  });

  it('rejects a clock that is not a same-day Accra interval', () => {
    expect(scheduleProblems({ date: '', dateTbc: false, startTime: '', endTime: '' }).date).toBe(
      'Pick a date.',
    );
    expect(
      scheduleProblems({ date: '2026-10-08', dateTbc: true, startTime: '17:00', endTime: '' })
        .startTime,
    ).toBe('Leave the times blank while the date is to be confirmed.');
    expect(
      scheduleProblems({ date: '2026-10-08', dateTbc: false, startTime: '', endTime: '20:00' })
        .startTime,
    ).toBe('Enter a start time.');
    expect(
      scheduleProblems({
        date: '2026-10-08',
        dateTbc: false,
        startTime: '20:00',
        endTime: '17:00',
      }).endTime,
    ).toBe('End the event after it starts.');
    expect(
      Object.keys(
        scheduleProblems({
          date: '2026-10-08',
          dateTbc: false,
          startTime: '17:00',
          endTime: '20:00',
        }),
      ),
    ).toEqual([]);
  });

  it('rejects a source link that is not a public https address', () => {
    expect(sourceUrlProblem('http://example.test/source')).toBe(
      'Enter a full link starting with https://',
    );
    expect(sourceUrlProblem('javascript:alert(1)')).toBe(
      'Enter a full link starting with https://',
    );
    expect(sourceUrlProblem('https://user:s3cret-token@example.test/source')).toBe(
      'Enter a full link starting with https://',
    );
    expect(sourceUrlProblem('https://127.0.0.1/source')).toBe('Use a public https address.');
    expect(sourceUrlProblem('')).toBeUndefined();
    expect(sourceUrlProblem('https://example.test/source')).toBeUndefined();
  });

  it('keeps the hackathon unconfirmed and labels every sample event', () => {
    const rows = buildSampleEvents();
    expect(rows).toHaveLength(6);
    expect(rows.every((row) => row.internalNotes.startsWith('Sample event.'))).toBe(true);
    const hackathon = rows.find((row) => row.id === 'hackathon');
    expect(hackathon?.dateTbc).toBe(true);
    expect(hackathon?.startTime).toBe('');
    expect(hackathon?.endTime).toBe('');
    expect(hackathon?.place).toBe('Venue to be confirmed');
    expect(hackathon?.verified).toBe(false);
    expect(hackathon?.sourceUrl).toBe('');
    const midpoint = rows.find((row) => row.id === 'midpoint');
    expect(midpoint?.sample).toBe(true);
    expect(midpoint?.publicationStatus).toBe('scheduled');
    expect(
      rows.filter((row) => row.publicationStatus === 'published').map((row) => row.id),
    ).toEqual(['start', 'hackathon', 'reception', 'durbar', 'graduation']);
  });
});
