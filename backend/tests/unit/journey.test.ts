import { describe, expect, it } from 'vitest';
import { buildJourney, type CurriculumSource } from '../../src/modules/journey/journey-build.js';
import { readMilestoneWrite } from '../../src/modules/journey/journey-rules.js';

const TODAY = '2026-10-24';

const curriculum: CurriculumSource = {
  programme: { name: 'Cybersecurity Bootcamp', startsOn: '2026-10-05', endsOn: '2026-12-25' },
  blocks: [
    {
      id: 'block-1',
      sortOrder: 1,
      name: 'Foundations',
      professionalismTheme: 'Professional Foundation',
      cybersecurityTheme: 'Cybersecurity Foundations',
    },
  ],
  weeks: [
    {
      id: 'week-01',
      blockId: 'block-1',
      number: 1,
      title: 'Getting started',
      startsOn: '2026-10-05',
      professionalism: 'How we work',
      cybersecurity: 'Networks',
    },
  ],
  deliverables: [{ id: 'del-1', weekId: 'week-01', sortOrder: 1, title: 'Personal learning plan' }],
};

function journey(audience: 'public' | 'portal') {
  return buildJourney({
    displayName: 'Ama Mensah',
    slug: 'ama-mensah',
    today: TODAY,
    audience,
    curriculum,
    portfolio: [
      {
        id: 'lab-live',
        kind: 'lab',
        reviewStatus: 'approved',
        title: 'Packet lab',
        summary: 'A published lab.',
        startedOn: '2026-10-12',
        completedOn: '2026-10-16',
        hasPending: false,
        pendingKind: null,
        pendingTitle: null,
        pendingSummary: null,
        pendingStartedOn: null,
        pendingCompletedOn: null,
        reviewedAt: new Date('2026-10-17T00:00:00Z'),
        createdAt: new Date('2026-10-12T00:00:00Z'),
      },
      {
        id: 'lab-draft',
        kind: 'lab',
        reviewStatus: 'draft',
        title: '',
        summary: '',
        startedOn: null,
        completedOn: null,
        hasPending: true,
        pendingKind: 'lab',
        pendingTitle: 'Draft lab secret',
        pendingSummary: 'Keep this draft off the public page.',
        pendingStartedOn: null,
        pendingCompletedOn: null,
        reviewedAt: null,
        createdAt: new Date('2026-10-18T00:00:00Z'),
      },
    ],
    skills: [
      {
        id: 'skill-live',
        reviewStatus: 'approved',
        name: 'Packet analysis',
        level: 3,
        hasPending: false,
        pendingName: null,
        pendingLevel: null,
        reviewedAt: new Date('2026-10-18T00:00:00Z'),
        createdAt: new Date('2026-10-11T00:00:00Z'),
      },
      {
        id: 'skill-draft',
        reviewStatus: 'draft',
        name: 'Hidden skill',
        level: 1,
        hasPending: false,
        pendingName: null,
        pendingLevel: null,
        reviewedAt: null,
        createdAt: new Date('2026-10-19T00:00:00Z'),
      },
    ],
    events: [
      {
        id: 'event-live',
        reviewStatus: 'approved',
        title: 'Local CTF',
        eventDate: '2026-11-02',
        organiser: 'Accra Sec',
        hasPending: false,
        pendingTitle: null,
        pendingEventDate: null,
        pendingOrganiser: null,
        reviewedAt: new Date('2026-11-03T00:00:00Z'),
        createdAt: new Date('2026-11-01T00:00:00Z'),
      },
      {
        id: 'event-draft',
        reviewStatus: 'draft',
        title: 'Private meetup',
        eventDate: '2026-11-04',
        organiser: 'Friends',
        hasPending: false,
        pendingTitle: null,
        pendingEventDate: null,
        pendingOrganiser: null,
        reviewedAt: null,
        createdAt: new Date('2026-11-04T00:00:00Z'),
      },
    ],
    projects: [
      {
        id: 'proj-live',
        title: 'Published SOC lab',
        type: 'Lab',
        abstract: 'A published project abstract for the cohort.',
        publicationStatus: 'published',
        listing: 'public',
        createdAt: new Date('2026-10-21T00:00:00Z'),
      },
      {
        id: 'proj-draft',
        title: 'Unpublished journey capstone',
        type: 'Capstone',
        abstract: 'Draft abstract stays off the public journey.',
        publicationStatus: 'draft',
        listing: 'hidden',
        createdAt: new Date('2026-10-22T00:00:00Z'),
      },
    ],
    account: {
      createdAt: new Date('2026-10-01T00:00:00Z'),
      emailVerifiedAt: new Date('2026-10-02T00:00:00Z'),
      profileReviewStatus: 'approved',
      profileReviewedAt: new Date('2026-10-07T00:00:00Z'),
      consentReceived: true,
      publicationStatus: 'published',
      listing: 'public',
      consentReceivedAt: new Date('2026-10-08T00:00:00Z'),
    },
    milestones: [
      { id: 'mile-public', title: 'Open house talk', summary: 'A public note.', occurredOn: '2026-10-15', visibility: 'public' },
      { id: 'mile-private', title: 'Quiet checkpoint', summary: 'A private note.', occurredOn: '2026-10-15', visibility: 'private' },
    ],
  });
}

describe('journey assembly', () => {
  it('keeps drafts, private milestones, and unpublished projects off the public journey', () => {
    const body = journey('public');
    const titles = body.items.map((item) => item.title);
    expect(titles).toContain('Packet lab');
    expect(titles).toContain('Packet analysis');
    expect(titles).toContain('Local CTF');
    expect(titles).toContain('Published SOC lab');
    expect(titles).toContain('Open house talk');
    expect(titles).toContain('Getting started');
    expect(titles).toContain('Signed up');
    expect(titles).toContain('Email confirmed');
    expect(titles).toContain('Profile approved');
    expect(titles).toContain('Profile published');
    expect(titles).not.toContain('Draft lab secret');
    expect(titles).not.toContain('Hidden skill');
    expect(titles).not.toContain('Private meetup');
    expect(titles).not.toContain('Unpublished journey capstone');
    expect(titles).not.toContain('Quiet checkpoint');
    expect(body.items.every((item) => item.visibility === 'public')).toBe(true);
    expect(body.items.every((item) => !item.editable)).toBe(true);
    const week = body.items.find((item) => item.kind === 'week');
    expect(week?.deliverables).toEqual(['Personal learning plan']);
    expect(week?.href).toBe('/schedule?week=1');
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('@');
    expect(serialized).not.toContain('Quiet checkpoint');
    expect(serialized).not.toContain('Draft lab secret');
    expect(serialized).not.toContain('/admin');
    expect(serialized).not.toContain('certificate');
    expect(serialized).not.toContain('internalNotes');
  });

  it('returns private items on the portal journey', () => {
    const body = journey('portal');
    const titles = body.items.map((item) => item.title);
    expect(titles).toContain('Quiet checkpoint');
    expect(titles).toContain('Draft lab secret');
    expect(titles).toContain('Hidden skill');
    expect(titles).toContain('Private meetup');
    expect(titles).toContain('Unpublished journey capstone');
    const quiet = body.items.find((item) => item.title === 'Quiet checkpoint');
    expect(quiet?.visibility).toBe('private');
    expect(quiet?.editable).toBe(true);
    const draftProject = body.items.find((item) => item.title === 'Unpublished journey capstone');
    expect(draftProject?.href).toBeNull();
    expect(draftProject?.summary).not.toContain('Draft abstract');
  });

  it('points milestone validation at the exact field', () => {
    const empty = readMilestoneWrite({}, 'create');
    expect(empty.errors.title).toBe('Enter a title.');
    expect(empty.errors.occurredOn).toBe('Pick a date.');
    expect(empty.errors.visibility).toBe('Choose private or public.');
    const date = readMilestoneWrite({ title: 'Talk', occurredOn: '2026-02-31', visibility: 'public' }, 'create');
    expect(date.errors.occurredOn).toBe('Use a real date.');
    const choice = readMilestoneWrite({ title: 'Talk', occurredOn: '2026-10-15', visibility: 'hidden' }, 'create');
    expect(choice.errors.visibility).toBe('Choose private or public.');
  });
});
