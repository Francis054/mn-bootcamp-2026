import { ApiError } from '../../shared/errors/api-error.js';
import type {
  AboutContent,
  FoundationStat,
  HomepageContent,
  Milestone,
  MilestoneDocument,
  SiteSettings,
} from './content.types.js';

const SHORT = 500;
const LONG = 5000;
const CHECK = 'Check the highlighted fields.';

const HOME_FIELDS = [
  'eyebrow',
  'headline',
  'lead',
  'ctaLabel',
  'ctaHref',
  'theme',
  'announcement',
  'showAnnouncement',
  'footerCtaHeading',
  'footerCtaHref',
  'publicationStatus',
] as const;

const ABOUT_FIELDS = [
  'mission',
  'vision',
  'values',
  'address',
  'email',
  'website',
  'figuresPermission',
  'publicationStatus',
] as const;

const SETTINGS_FIELDS = [
  'siteName',
  'timeZone',
  'contactEmail',
  'accent',
  'reduceMotion',
  'notifications',
  'foundationStats',
  'publicationStatus',
] as const;

export function mergeHomepage(current: HomepageContent, body: unknown): HomepageContent {
  const patch = readObject(body, HOME_FIELDS);
  const problems: Record<string, string> = {};
  const next: HomepageContent = { ...current };
  next.eyebrow = stringField(patch, 'eyebrow', current.eyebrow, SHORT, problems);
  next.headline = stringField(patch, 'headline', current.headline, LONG, problems);
  next.lead = stringField(patch, 'lead', current.lead, LONG, problems);
  next.ctaLabel = stringField(patch, 'ctaLabel', current.ctaLabel, SHORT, problems);
  next.ctaHref = linkField(patch, 'ctaHref', current.ctaHref, problems);
  next.theme = themeField(patch, current.theme, problems);
  next.announcement = stringField(patch, 'announcement', current.announcement, SHORT, problems);
  next.showAnnouncement = booleanField(
    patch,
    'showAnnouncement',
    current.showAnnouncement,
    problems,
  );
  next.footerCtaHeading = stringField(
    patch,
    'footerCtaHeading',
    current.footerCtaHeading,
    SHORT,
    problems,
  );
  next.footerCtaHref = linkField(patch, 'footerCtaHref', current.footerCtaHref, problems);
  finish(problems);
  return next;
}

export function mergeAbout(current: AboutContent, body: unknown): AboutContent {
  const patch = readObject(body, ABOUT_FIELDS);
  const problems: Record<string, string> = {};
  const next: AboutContent = { ...current };
  next.mission = stringField(patch, 'mission', current.mission, LONG, problems);
  next.vision = stringField(patch, 'vision', current.vision, LONG, problems);
  next.values = valuesField(patch, current.values, problems);
  next.address = stringField(patch, 'address', current.address, SHORT, problems);
  next.email = emailField(patch, 'email', current.email, problems);
  next.website = linkField(patch, 'website', current.website, problems);
  next.figuresPermission = booleanField(
    patch,
    'figuresPermission',
    current.figuresPermission,
    problems,
  );
  finish(problems);
  return next;
}

export function mergeMilestones(current: Milestone[], body: unknown): Milestone[] {
  const patch = readObject(body, ['milestones']);
  if (!Object.prototype.hasOwnProperty.call(patch, 'milestones')) return current;
  const problems: Record<string, string> = {};
  const next = milestonesField(patch.milestones, problems);
  finish(problems);
  return next;
}

export function mergeSettings(current: SiteSettings, body: unknown): SiteSettings {
  const patch = readObject(body, SETTINGS_FIELDS);
  const problems: Record<string, string> = {};
  const next: SiteSettings = {
    ...current,
    notifications: { ...current.notifications },
    foundationStats: current.foundationStats.map((stat) => ({ ...stat })),
  };
  next.siteName = requiredName(patch, current.siteName, problems);
  next.timeZone = stringField(patch, 'timeZone', current.timeZone, 80, problems);
  next.contactEmail = contactEmailField(patch, current.contactEmail, problems);
  next.accent = accentField(patch, current.accent, problems);
  next.reduceMotion = booleanField(patch, 'reduceMotion', current.reduceMotion, problems);
  next.notifications = notificationsField(patch, current.notifications, problems);
  next.foundationStats = statsField(patch, current.foundationStats, problems);
  finish(problems);
  return next;
}

export function readHomepage(value: unknown): HomepageContent | undefined {
  if (!isRecord(value)) return undefined;
  const theme = value.theme === 'light' ? 'light' : value.theme === 'dark' ? 'dark' : undefined;
  if (
    typeof value.eyebrow !== 'string' ||
    typeof value.headline !== 'string' ||
    typeof value.lead !== 'string' ||
    typeof value.ctaLabel !== 'string' ||
    typeof value.ctaHref !== 'string' ||
    theme === undefined ||
    typeof value.announcement !== 'string' ||
    typeof value.showAnnouncement !== 'boolean' ||
    typeof value.footerCtaHeading !== 'string' ||
    typeof value.footerCtaHref !== 'string'
  ) {
    return undefined;
  }
  return {
    eyebrow: value.eyebrow,
    headline: value.headline,
    lead: value.lead,
    ctaLabel: value.ctaLabel,
    ctaHref: value.ctaHref,
    theme,
    announcement: value.announcement,
    showAnnouncement: value.showAnnouncement,
    footerCtaHeading: value.footerCtaHeading,
    footerCtaHref: value.footerCtaHref,
  };
}

export function readAbout(value: unknown): AboutContent | undefined {
  if (!isRecord(value) || !Array.isArray(value.values)) return undefined;
  if (
    typeof value.mission !== 'string' ||
    typeof value.vision !== 'string' ||
    typeof value.address !== 'string' ||
    typeof value.email !== 'string' ||
    typeof value.website !== 'string' ||
    typeof value.figuresPermission !== 'boolean' ||
    value.values.some((item) => typeof item !== 'string')
  ) {
    return undefined;
  }
  const values = value.values.filter((item): item is string => typeof item === 'string');
  return {
    mission: value.mission,
    vision: value.vision,
    values,
    address: value.address,
    email: value.email,
    website: value.website,
    figuresPermission: value.figuresPermission,
  };
}

export function readMilestones(value: unknown): MilestoneDocument | undefined {
  if (!isRecord(value) || !Array.isArray(value.milestones)) return undefined;
  const milestones: Milestone[] = [];
  for (const item of value.milestones) {
    if (!isRecord(item)) return undefined;
    if (
      typeof item.id !== 'string' ||
      typeof item.year !== 'string' ||
      typeof item.title !== 'string' ||
      typeof item.description !== 'string' ||
      typeof item.source !== 'string'
    ) {
      return undefined;
    }
    milestones.push({
      id: item.id,
      year: item.year,
      title: item.title,
      description: item.description,
      source: item.source,
    });
  }
  return { milestones };
}

export function readSettings(value: unknown): SiteSettings | undefined {
  if (!isRecord(value) || !isRecord(value.notifications) || !Array.isArray(value.foundationStats)) {
    return undefined;
  }
  const notes = value.notifications;
  if (
    typeof value.siteName !== 'string' ||
    typeof value.timeZone !== 'string' ||
    typeof value.contactEmail !== 'string' ||
    typeof value.accent !== 'string' ||
    typeof value.reduceMotion !== 'boolean' ||
    typeof notes.projects !== 'boolean' ||
    typeof notes.consent !== 'boolean' ||
    typeof notes.digest !== 'boolean'
  ) {
    return undefined;
  }
  const foundationStats: FoundationStat[] = [];
  for (const item of value.foundationStats) {
    if (!isRecord(item)) return undefined;
    if (
      typeof item.id !== 'string' ||
      typeof item.label !== 'string' ||
      typeof item.value !== 'number' ||
      typeof item.suffix !== 'string'
    ) {
      return undefined;
    }
    foundationStats.push({
      id: item.id,
      label: item.label,
      value: item.value,
      suffix: item.suffix,
    });
  }
  return {
    siteName: value.siteName,
    timeZone: value.timeZone,
    contactEmail: value.contactEmail,
    accent: value.accent,
    reduceMotion: value.reduceMotion,
    notifications: { projects: notes.projects, consent: notes.consent, digest: notes.digest },
    foundationStats,
  };
}

function readObject(body: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!isRecord(body)) throw new ApiError('validation', CHECK);
  const problems: Record<string, string> = {};
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) problems[key] = 'This field is not recognised.';
  }
  finish(problems);
  return body;
}

function stringField(
  patch: Record<string, unknown>,
  key: string,
  current: string,
  max: number,
  problems: Record<string, string>,
): string {
  if (!Object.prototype.hasOwnProperty.call(patch, key)) return current;
  const value = patch[key];
  if (typeof value !== 'string') {
    problems[key] = 'Use plain text.';
    return current;
  }
  if (value.length > max) problems[key] = `Use at most ${max} characters.`;
  return value;
}

function linkField(
  patch: Record<string, unknown>,
  key: string,
  current: string,
  problems: Record<string, string>,
): string {
  const value = stringField(patch, key, current, SHORT, problems);
  if (problems[key]) return current;
  if (value !== '' && !acceptableLink(value)) {
    problems[key] = 'Enter a link or a site path.';
  }
  return value;
}

function themeField(
  patch: Record<string, unknown>,
  current: HomepageContent['theme'],
  problems: Record<string, string>,
): HomepageContent['theme'] {
  if (!Object.prototype.hasOwnProperty.call(patch, 'theme')) return current;
  const value = patch.theme;
  if (value === 'dark' || value === 'light') return value;
  problems.theme = 'Choose a theme.';
  return current;
}

function booleanField(
  patch: Record<string, unknown>,
  key: string,
  current: boolean,
  problems: Record<string, string>,
): boolean {
  if (!Object.prototype.hasOwnProperty.call(patch, key)) return current;
  const value = patch[key];
  if (typeof value !== 'boolean') {
    problems[key] = 'Choose yes or no.';
    return current;
  }
  return value;
}

function valuesField(
  patch: Record<string, unknown>,
  current: string[],
  problems: Record<string, string>,
): string[] {
  if (!Object.prototype.hasOwnProperty.call(patch, 'values')) return current;
  const value = patch.values;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    problems.values = 'Enter one value per line.';
    return current;
  }
  const lines = value.filter((item): item is string => typeof item === 'string');
  if (lines.length > 24 || lines.some((line) => line.trim().length === 0 || line.length > 80)) {
    problems.values = 'Enter one value per line.';
    return current;
  }
  return lines.map((line) => line.trim());
}

function emailField(
  patch: Record<string, unknown>,
  key: string,
  current: string,
  problems: Record<string, string>,
): string {
  if (!Object.prototype.hasOwnProperty.call(patch, key)) return current;
  const value = patch[key];
  if (typeof value !== 'string') {
    problems[key] = 'Enter a valid email address, like name@example.com.';
    return current;
  }
  const trimmed = value.trim();
  if (trimmed === '') return '';
  if (!isEmail(trimmed)) {
    problems[key] = 'Enter a valid email address, like name@example.com.';
    return current;
  }
  return trimmed;
}

function requiredName(
  patch: Record<string, unknown>,
  current: string,
  problems: Record<string, string>,
): string {
  if (!Object.prototype.hasOwnProperty.call(patch, 'siteName')) return current;
  const value = patch.siteName;
  if (typeof value !== 'string' || value.trim() === '') {
    problems.siteName = 'Enter a site name.';
    return current;
  }
  if (value.trim().length > SHORT) {
    problems.siteName = `Use at most ${SHORT} characters.`;
    return current;
  }
  return value.trim();
}

function contactEmailField(
  patch: Record<string, unknown>,
  current: string,
  problems: Record<string, string>,
): string {
  if (!Object.prototype.hasOwnProperty.call(patch, 'contactEmail')) return current;
  const value = patch.contactEmail;
  if (typeof value !== 'string' || value.trim() === '') {
    problems.contactEmail = 'Enter your email address.';
    return current;
  }
  const trimmed = value.trim();
  if (!isEmail(trimmed)) {
    problems.contactEmail = 'Enter a valid email address, like name@example.com.';
    return current;
  }
  return trimmed;
}

function accentField(
  patch: Record<string, unknown>,
  current: string,
  problems: Record<string, string>,
): string {
  if (!Object.prototype.hasOwnProperty.call(patch, 'accent')) return current;
  const value = patch.accent;
  if (typeof value !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(value.trim())) {
    problems.accent = 'Use a colour like #88CC00.';
    return current;
  }
  return value.trim();
}

function notificationsField(
  patch: Record<string, unknown>,
  current: SiteSettings['notifications'],
  problems: Record<string, string>,
): SiteSettings['notifications'] {
  if (!Object.prototype.hasOwnProperty.call(patch, 'notifications')) return current;
  const value = patch.notifications;
  if (!isRecord(value)) {
    problems.notifications = 'Choose the notice settings.';
    return current;
  }
  const next = { ...current };
  for (const key of Object.keys(value)) {
    if (!isNoticeKey(key)) {
      problems.notifications = 'Choose the notice settings.';
      return current;
    }
  }
  for (const key of ['projects', 'consent', 'digest'] as const) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const flag = value[key];
    if (typeof flag !== 'boolean') {
      problems.notifications = 'Choose the notice settings.';
      return current;
    }
    next[key] = flag;
  }
  return next;
}

function isNoticeKey(key: string): key is 'projects' | 'consent' | 'digest' {
  return key === 'projects' || key === 'consent' || key === 'digest';
}

function statsField(
  patch: Record<string, unknown>,
  current: FoundationStat[],
  problems: Record<string, string>,
): FoundationStat[] {
  if (!Object.prototype.hasOwnProperty.call(patch, 'foundationStats')) return current;
  const value = patch.foundationStats;
  if (!Array.isArray(value)) {
    problems.foundationStats = 'Enter the counters as a list.';
    return current;
  }
  if (value.length > 12) {
    problems.foundationStats = 'Use at most 12 counters.';
    return current;
  }
  const stats: FoundationStat[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const stat = oneStat(item);
    if (!stat) {
      problems.foundationStats = 'Check each counter. Use a label and a whole number from zero.';
      return current;
    }
    if (seen.has(stat.id)) {
      problems.foundationStats = 'Use each counter once.';
      return current;
    }
    seen.add(stat.id);
    stats.push(stat);
  }
  return stats;
}

function oneStat(value: unknown): FoundationStat | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(value.id)) return undefined;
  if (typeof value.label !== 'string' || value.label.trim() === '' || value.label.length > 120) {
    return undefined;
  }
  if (typeof value.suffix !== 'string' || value.suffix.length > 8) return undefined;
  if (typeof value.value !== 'number' || !Number.isInteger(value.value) || value.value < 0) {
    return undefined;
  }
  if (value.value > 1_000_000_000) return undefined;
  return { id: value.id, label: value.label.trim(), value: value.value, suffix: value.suffix };
}

function milestonesField(value: unknown, problems: Record<string, string>): Milestone[] {
  if (!Array.isArray(value)) {
    problems.milestones = 'Send the timeline as a list.';
    return [];
  }
  if (value.length > 40) {
    problems.milestones = 'Use at most 40 milestones.';
    return [];
  }
  const rows: Milestone[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const row = oneMilestone(item);
    if (!row) {
      problems.milestones = 'Check each milestone. Year and title are required.';
      return [];
    }
    if (seen.has(row.id)) {
      problems.milestones = 'Use each milestone once.';
      return [];
    }
    seen.add(row.id);
    rows.push(row);
  }
  return rows;
}

function oneMilestone(value: unknown): Milestone | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.id !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(value.id)) return undefined;
  if (typeof value.year !== 'string' || value.year.trim() === '' || value.year.trim().length > 20) {
    return undefined;
  }
  if (typeof value.title !== 'string' || value.title.trim() === '' || value.title.length > SHORT) {
    return undefined;
  }
  if (typeof value.description !== 'string' || value.description.length > LONG) return undefined;
  if (typeof value.source !== 'string' || value.source.length > SHORT) return undefined;
  return {
    id: value.id,
    year: value.year.trim(),
    title: value.title.trim(),
    description: value.description,
    source: value.source,
  };
}

function acceptableLink(value: string): boolean {
  const lower = value.trim().toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return false;
  return value.startsWith('/') || value.startsWith('https://') || value.startsWith('http://');
}

function isEmail(value: string): boolean {
  return value.length <= 200 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function finish(problems: Record<string, string>): void {
  if (Object.keys(problems).length > 0) throw new ApiError('validation', CHECK, problems);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
