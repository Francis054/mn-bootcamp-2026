import { describe, expect, it } from 'vitest';
import { UnconfiguredMail } from '../../src/modules/mail/unconfigured-mail.js';
import { MemoryMail } from '../../src/modules/mail/memory-mail.js';
import { matchesDirectory } from '../../src/modules/reach/directory.js';
import { buildProfilePdf, profilePdfLines } from '../../src/modules/reach/profile-pdf.js';
import { deliveryState } from '../../src/modules/reach/reach.rules.js';
import { ReachService } from '../../src/modules/reach/reach.service.js';
import type { PublicTrainee } from '../../src/modules/trainees/records.js';
import type { ReachRepository } from '../../src/modules/reach/reach.repository.js';
import type { TraineeService } from '../../src/modules/trainees/trainee.service.js';

const profile = {
  displayName: 'Ada Mensah',
  headline: 'Aspiring analyst',
  track: 'Blue team',
  focus: 'network',
  location: 'Accra',
  bio: 'Learning the lab.',
  quote: 'Keep notes.',
  skills: ['Wireshark'],
  statusLabel: 'In training',
  listing: 'public',
  publicationStatus: 'published',
  contactAvailable: true,
} as PublicTrainee;

describe('public directory filters', () => {
  it('matches public fields and ignores a search that is only an email', () => {
    expect(
      matchesDirectory(profile, {
        q: 'wireshark',
        track: 'Blue team',
        focus: 'network',
        skill: 'wireshark',
      }),
    ).toBe(true);
    expect(
      matchesDirectory(profile, { q: 'ada@example.test', track: '', focus: '', skill: '' }),
    ).toBe(false);
    expect(matchesDirectory(profile, { q: '', track: 'Red team', focus: '', skill: '' })).toBe(
      false,
    );
  });
});

describe('profile PDF', () => {
  it('has no email address and no uploaded CV', async () => {
    const lines = profilePdfLines({
      displayName: profile.displayName,
      headline: profile.headline,
      track: profile.track,
      focus: profile.focus,
      location: profile.location,
      bio: profile.bio,
      quote: profile.quote,
      skills: profile.skills,
      statusLabel: profile.statusLabel,
      profileUrl: 'https://example.test/trainees/ada',
      generatedOn: '2026-10-30',
    });
    const joined = lines.join('\n');
    expect(joined).toContain('Ada Mensah');
    expect(joined).not.toContain('@');
    expect(joined.toLowerCase()).not.toContain('curriculum vitae');
    const bytes = Buffer.from(
      await buildProfilePdf({
        displayName: profile.displayName,
        headline: profile.headline,
        track: profile.track,
        focus: profile.focus,
        location: profile.location,
        bio: profile.bio,
        quote: profile.quote,
        skills: profile.skills,
        statusLabel: profile.statusLabel,
        profileUrl: 'https://example.test/trainees/ada',
        generatedOn: '2026-10-30',
      }),
    );
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.includes(Buffer.from('hidden.mailbox@example.test'))).toBe(false);
  });
});

describe('mail that is not configured', () => {
  it('saves a contact and does not pretend the email was sent', async () => {
    const saved: Array<{ status: string }> = [];
    const store = {
      senderBlocked: () => Promise.resolve(false),
      countContacts: () => Promise.resolve(0),
      insertContact: (input: { status: string }) => {
        saved.push(input);
        return Promise.resolve('11111111-1111-4111-8111-111111111111');
      },
    } as unknown as ReachRepository;
    const trainees = {
      requirePublic: () =>
        Promise.resolve({
          id: 't1',
          email: 'hidden.mailbox@example.test',
          displayName: 'Ada Mensah',
          contactConsent: true,
        }),
    } as unknown as TraineeService;
    const service = new ReachService(
      store,
      trainees,
      {} as never,
      {} as never,
      new UnconfiguredMail(),
      { record: () => Promise.resolve(undefined) } as never,
      'test-session-secret-at-least-32-chars',
      'http://127.0.0.1:5173',
    );
    const result = await service.contact({
      slugOrId: 't1',
      body: {
        name: 'Employer',
        email: 'employer@example.test',
        organisation: 'Lab',
        message: 'We would like to talk about a role.',
      },
      ip: '127.0.0.1',
      requestId: 'req-1',
    });
    expect(result.delivered).toBe(false);
    expect(result.message).toMatch(/not sent/i);
    expect(JSON.stringify(result)).not.toContain('hidden.mailbox@example.test');
    expect(saved[0]?.status).toBe('new');
    expect(deliveryState(false, false)).toBe('new');
  });

  it('emails the trainee from the site and keeps their address out of the response', async () => {
    const mail = new MemoryMail();
    const store = {
      senderBlocked: () => Promise.resolve(false),
      countContacts: () => Promise.resolve(0),
      insertContact: () => Promise.resolve('11111111-1111-4111-8111-111111111111'),
    } as unknown as ReachRepository;
    const trainees = {
      requirePublic: () =>
        Promise.resolve({
          id: 't1',
          email: 'hidden.mailbox@example.test',
          displayName: 'Ada Mensah',
          contactConsent: true,
        }),
    } as unknown as TraineeService;
    const service = new ReachService(
      store,
      trainees,
      {} as never,
      {} as never,
      mail,
      { record: () => Promise.resolve(undefined) } as never,
      'test-session-secret-at-least-32-chars',
      'http://127.0.0.1:5173',
    );
    const result = await service.contact({
      slugOrId: 't1',
      body: {
        name: 'Employer',
        email: 'employer@example.test',
        message: 'We would like to talk about a role.',
      },
      ip: '127.0.0.1',
      requestId: 'req-2',
    });
    expect(result.delivered).toBe(true);
    expect(JSON.stringify(result)).not.toContain('hidden.mailbox@example.test');
    expect(mail.sent[0]?.to).toBe('hidden.mailbox@example.test');
    expect(mail.sent[0]?.replyTo).toBe('employer@example.test');
    expect(mail.sent[0]?.text).not.toContain('hidden.mailbox@example.test');
  });
});
