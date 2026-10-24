import type { PublicationStatus } from '../curriculum/publication.js';

/** Homepage copy, including the announcement banner. Matches `HomepageContent`. */
export interface HomepageContent {
  eyebrow: string;
  headline: string;
  lead: string;
  ctaLabel: string;
  ctaHref: string;
  theme: 'dark' | 'light';
  announcement: string;
  showAnnouncement: boolean;
  footerCtaHeading: string;
  footerCtaHref: string;
}

export interface AdminHomepage extends HomepageContent {
  publicationStatus: PublicationStatus;
}

export interface AboutContent {
  mission: string;
  vision: string;
  values: string[];
  address: string;
  email: string;
  website: string;
  figuresPermission: boolean;
}

export interface AdminAbout extends AboutContent {
  publicationStatus: PublicationStatus;
}

export interface Milestone {
  id: string;
  year: string;
  title: string;
  description: string;
  source: string;
}

export interface FoundationStat {
  id: string;
  label: string;
  value: number;
  suffix: string;
}

export interface SiteSettings {
  siteName: string;
  timeZone: string;
  contactEmail: string;
  accent: string;
  reduceMotion: boolean;
  notifications: { projects: boolean; consent: boolean; digest: boolean };
  foundationStats: FoundationStat[];
}

export interface AdminSettings extends SiteSettings {
  publicationStatus: PublicationStatus;
}

export interface MilestoneDocument {
  milestones: Milestone[];
}
