import { describe, expect, it } from 'vitest';
import {
  mergeAbout,
  mergeHomepage,
  mergeSettings,
} from '../../src/modules/content/content.rules.js';
import { buildSampleContent } from '../../src/modules/content/sample-content.js';
import type {
  AboutContent,
  HomepageContent,
  SiteSettings,
} from '../../src/modules/content/content.types.js';
import { ApiError } from '../../src/shared/errors/api-error.js';

const home = (): HomepageContent => ({
  eyebrow: 'Sample eyebrow',
  headline: 'Sample headline',
  lead: 'Sample lead',
  ctaLabel: 'Open',
  ctaHref: '/bootcamp',
  theme: 'dark',
  announcement: 'Sample banner',
  showAnnouncement: false,
  footerCtaHeading: 'Sample footer',
  footerCtaHref: 'https://example.test/join',
});

const about = (): AboutContent => ({
  mission: 'Sample mission',
  vision: 'Sample vision',
  values: ['Hope'],
  address: 'Sample address',
  email: 'desk@example.test',
  website: 'https://example.test',
  figuresPermission: false,
});

const settings = (): SiteSettings => ({
  siteName: 'Sample site',
  timeZone: 'Africa/Accra (GMT)',
  contactEmail: 'desk@example.test',
  accent: '#88CC00',
  reduceMotion: false,
  notifications: { projects: true, consent: true, digest: false },
  foundationStats: [
    { id: 'schools', label: 'Sample counter — school projects', value: 0, suffix: '' },
  ],
});

describe('content singletons', () => {
  it('seeds labelled counters at zero', () => {
    const rows = buildSampleContent();
    expect(rows.map((row) => row.id)).toEqual(['homepage', 'about', 'milestones', 'settings']);
    expect(rows.every((row) => row.publicationStatus === 'draft')).toBe(true);
    expect(rows.every((row) => row.publishedDocument === null)).toBe(true);
    const stored = JSON.stringify(rows);
    expect(stored).toContain('Sample counter');
    expect(stored).toContain('Sample copy for the development seed.');
    expect(stored).not.toContain('76000');
    expect(stored).not.toContain('173');
    const settingsRow = rows.find((row) => row.id === 'settings');
    const stats = readStats(settingsRow?.draft);
    expect(stats.every((stat) => stat.value === 0)).toBe(true);
  });

  it('keeps omitted about fields and ignores a publication flag on the edit', () => {
    const next = mergeAbout(about(), {
      mission: 'Updated sample mission',
      publicationStatus: 'published',
    });
    expect(next.mission).toBe('Updated sample mission');
    expect(next.address).toBe('Sample address');
    expect(next.email).toBe('desk@example.test');
    expect(next.website).toBe('https://example.test');
    expect(next.figuresPermission).toBe(false);
  });

  it('rejects a script link and does not treat the banner as its own collection', () => {
    expect(() => mergeHomepage(home(), { ctaHref: 'javascript:alert(1)' })).toThrow(ApiError);
    try {
      mergeHomepage(home(), { ctaHref: 'javascript:alert(1)' });
    } catch (error) {
      const message = error instanceof ApiError ? JSON.stringify(error.fieldErrors) : '';
      expect(message).toContain('Enter a link or a site path.');
      expect(message).not.toContain('alert(1)');
    }
    const banner = mergeHomepage(home(), {
      announcement: 'Sample banner text',
      showAnnouncement: true,
    });
    expect(banner.announcement).toBe('Sample banner text');
    expect(banner.showAnnouncement).toBe(true);
    expect(banner.headline).toBe('Sample headline');
  });

  it('keeps counters when a settings edit omits them', () => {
    const next = mergeSettings(settings(), { siteName: 'Renamed sample site' });
    expect(next.siteName).toBe('Renamed sample site');
    expect(next.foundationStats).toEqual(settings().foundationStats);
    expect(next.contactEmail).toBe('desk@example.test');
  });

  it('names a missing site name and a bad contact email without repeating the value', () => {
    expect(field(() => mergeSettings(settings(), { siteName: '  ' }), 'siteName')).toBe(
      'Enter a site name.',
    );
    expect(
      field(() => mergeSettings(settings(), { contactEmail: 'not-an-email' }), 'contactEmail'),
    ).toBe('Enter a valid email address, like name@example.com.');
    expect(field(() => mergeSettings(settings(), { contactEmail: '' }), 'contactEmail')).toBe(
      'Enter your email address.',
    );
  });
});

function field(run: () => unknown, name: string): string {
  try {
    run();
  } catch (error) {
    if (error instanceof ApiError) {
      const message = error.fieldErrors?.[name];
      if (message) return message;
    }
  }
  throw new Error(`Expected a field error for ${name}.`);
}

function readStats(value: object | undefined): { value: number }[] {
  if (!value || !('foundationStats' in value) || !Array.isArray(value.foundationStats)) {
    throw new Error('Expected sample counters.');
  }
  return value.foundationStats.map((item: unknown) => {
    if (typeof item !== 'object' || item === null || !('value' in item)) {
      throw new Error('Expected a counter.');
    }
    if (typeof item.value !== 'number') throw new Error('Expected a number.');
    return { value: item.value };
  });
}
