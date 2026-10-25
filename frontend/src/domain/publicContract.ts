import { displayPhotoUrl } from './photo';
import type {
  AboutContent,
  EventBody,
  FoundationStat,
  HomepageContent,
  Listing,
  Milestone,
  PublicEvent,
  PublicLesson,
  PublicProject,
  PublicTrainee,
  PublicWorkPhoto,
  PublicationStatus,
  ScheduleStatus,
} from './types';
import { isDirectWorkPhotoSrc } from './workPhoto';

export interface SafePublicMedia {
  id: string;
  file: string;
  src: string;
  width: number;
  height: number;
  caption: string;
  alt: string;
  album: string;
  consent?: 'verified' | 'pending' | 'withdrawn';
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function lines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function listing(value: unknown): Listing {
  if (value === 'public' || value === 'sample' || value === 'hidden') return value;
  return 'public';
}

function status(value: unknown): PublicationStatus {
  if (value === 'draft' || value === 'in_review' || value === 'scheduled' || value === 'published') return value;
  return 'published';
}

function schedule(value: unknown): ScheduleStatus {
  if (value === 'done' || value === 'now' || value === 'upcoming') return value;
  return 'upcoming';
}

function phase(value: unknown): 1 | 2 | 3 {
  if (value === 1 || value === 2 || value === 3) return value;
  return 1;
}

export function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function normalizeHomepage(value: unknown): HomepageContent | null {
  const row = record(value);
  if (!row || typeof row.headline !== 'string') return null;
  return {
    eyebrow: text(row.eyebrow, 'Cyber Security Bootcamp 2026'),
    headline: row.headline,
    lead: text(row.lead),
    ctaLabel: text(row.ctaLabel, 'Explore the bootcamp'),
    ctaHref: text(row.ctaHref, '/bootcamp'),
    theme: row.theme === 'light' ? 'light' : 'dark',
    announcement: text(row.announcement),
    showAnnouncement: row.showAnnouncement === true,
    footerCtaHeading: text(row.footerCtaHeading, 'Get involved'),
    footerCtaHref: text(row.footerCtaHref, 'https://maximnyansa.com/'),
    publicationStatus: typeof row.publicationStatus === 'string' ? status(row.publicationStatus) : undefined,
  };
}

export function normalizeAbout(value: unknown): AboutContent | null {
  const row = record(value);
  if (!row || typeof row.mission !== 'string') return null;
  return {
    mission: row.mission,
    vision: text(row.vision),
    values: lines(row.values),
    address: text(row.address),
    email: text(row.email),
    website: text(row.website),
    figuresPermission: row.figuresPermission === true,
    publicationStatus: typeof row.publicationStatus === 'string' ? status(row.publicationStatus) : undefined,
  };
}

export function normalizeMilestones(value: unknown): Milestone[] {
  return asList(value).flatMap((item) => {
    const row = record(item);
    if (!row || typeof row.id !== 'string') return [];
    return [{
      id: row.id,
      year: text(row.year),
      title: text(row.title),
      description: text(row.description),
      source: text(row.source),
    }];
  });
}

export function normalizeLessons(value: unknown): PublicLesson[] {
  return asList(value).flatMap((item) => {
    const row = record(item);
    if (!row || typeof row.id !== 'string' || typeof row.title !== 'string') return [];
    return [{
      id: row.id,
      week: typeof row.week === 'number' ? row.week : 1,
      moduleId: text(row.moduleId, 'network') as PublicLesson['moduleId'],
      title: row.title,
      slug: text(row.slug, row.id),
      date: text(row.date, '2026-10-05'),
      format: text(row.format, 'Lecture + lab'),
      phase: phase(row.phase),
      scheduleStatus: schedule(row.scheduleStatus),
      publicationStatus: status(row.publicationStatus),
      listing: listing(row.listing),
      room: text(row.room),
      summary: text(row.summary),
      objectives: lines(row.objectives),
      lab: text(row.lab),
      codeSample: text(row.codeSample),
      cover: text(row.cover, 'electronics-lab'),
      updatedAt: text(row.updatedAt),
    }];
  });
}

export function normalizeTrainees(value: unknown): PublicTrainee[] {
  return asList(value).flatMap((item) => {
    const row = record(item);
    if (!row || typeof row.id !== 'string' || typeof row.displayName !== 'string') return [];
    const name = row.displayName;
    return [{
      id: row.id,
      displayName: name,
      initials: text(row.initials, name.slice(0, 2).toUpperCase()),
      hue: typeof row.hue === 'number' ? row.hue : 140,
      track: text(row.track),
      focus: text(row.focus, 'network') as PublicTrainee['focus'],
      skills: lines(row.skills),
      bio: text(row.bio),
      quote: text(row.quote),
      photoUrl: displayPhotoUrl(row.photoUrl),
      listing: listing(row.listing),
      publicationStatus: status(row.publicationStatus),
      statusLabel: text(row.statusLabel, 'In training'),
    }];
  });
}

/** A public https link with no embedded password. Anything else stays off the page. */
export function publicHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    return trimmed;
  } catch {
    return undefined;
  }
}

export function normalizeProjects(value: unknown): PublicProject[] {
  return asList(value).flatMap((item) => {
    const row = record(item);
    if (!row || typeof row.id !== 'string' || typeof row.title !== 'string') return [];
    const repositoryUrl = publicHttpsUrl(row.repositoryUrl);
    const demoUrl = publicHttpsUrl(row.demoUrl);
    return [{
      id: row.id,
      title: row.title,
      slug: text(row.slug, row.id),
      type: text(row.type, 'Lab'),
      moduleId: text(row.moduleId, 'network') as PublicProject['moduleId'],
      cover: text(row.cover, 'terminal'),
      image: text(row.image, 'electronics-lab'),
      abstract: text(row.abstract),
      tools: text(row.tools),
      steps: lines(row.steps),
      team: lines(row.team),
      publicationStatus: status(row.publicationStatus),
      listing: listing(row.listing),
      ...(repositoryUrl ? { repositoryUrl } : {}),
      ...(demoUrl ? { demoUrl } : {}),
    }];
  });
}

function eventBody(value: unknown): EventBody {
  const row = record(value);
  if (row?.kind === 'callout') {
    const tone = row.tone === 'warn' || row.tone === 'lime' ? row.tone : 'plain';
    return { kind: 'callout', tone, title: text(row.title), text: text(row.text) };
  }
  if (row?.kind === 'steps') {
    return { kind: 'steps', title: text(row.title), steps: lines(row.steps), note: text(row.note) || undefined };
  }
  return { kind: 'placeholder', text: text(row?.text, text(row?.summary)) };
}

export function normalizeEvents(value: unknown): PublicEvent[] {
  return asList(value).flatMap((item) => {
    const row = record(item);
    if (!row || typeof row.id !== 'string' || typeof row.title !== 'string') return [];
    const kind = row.kind === 'Anniversary' || row.kind === 'Partner event' || row.kind === 'Milestone' ? row.kind : 'Milestone';
    return [{
      id: row.id,
      title: row.title,
      date: text(row.date, '2026-10-05'),
      dateTbc: row.dateTbc === true,
      whenLabel: text(row.whenLabel),
      place: text(row.place),
      kind,
      verified: row.verified === true,
      sample: row.sample === true,
      summary: text(row.summary),
      body: eventBody(row.body),
      source: text(row.source),
      sourceUrl: text(row.sourceUrl),
      image: text(row.image, 'guests-seated'),
      showOnAnniversary: row.showOnAnniversary === true,
      calendarDownload: row.calendarDownload === true,
      startTime: text(row.startTime),
      endTime: text(row.endTime),
      publicationStatus: status(row.publicationStatus),
      listing: listing(row.listing),
    }];
  });
}

export function normalizeMedia(value: unknown): SafePublicMedia[] {
  return asList(value).flatMap((item) => {
    const row = record(item);
    if (!row || typeof row.id !== 'string') return [];
    const consent = row.consent === 'verified' || row.consent === 'pending' || row.consent === 'withdrawn' ? row.consent : undefined;
    return [{
      id: row.id,
      file: text(row.file),
      src: text(row.src),
      width: typeof row.width === 'number' ? row.width : 1600,
      height: typeof row.height === 'number' ? row.height : 1066,
      caption: text(row.caption),
      alt: text(row.alt),
      album: text(row.album, 'community'),
      ...(consent ? { consent } : {}),
    }];
  });
}

export function normalizeWorkPhotos(value: unknown): PublicWorkPhoto[] {
  return asList(value).flatMap((item) => {
    const row = record(item);
    if (!row || typeof row.id !== 'string' || typeof row.alt !== 'string') return [];
    const src = text(row.src);
    if (!isDirectWorkPhotoSrc(src) && !src.startsWith('memory:')) return [];
    const projectId = typeof row.projectId === 'string' && row.projectId ? row.projectId : null;
    return [{
      id: row.id,
      traineeId: text(row.traineeId),
      projectId,
      src,
      width: typeof row.width === 'number' ? row.width : 1600,
      height: typeof row.height === 'number' ? row.height : 1066,
      alt: row.alt,
      caption: text(row.caption, row.alt),
    }];
  });
}

export function normalizeStats(value: unknown): FoundationStat[] {
  return asList(value).flatMap((item) => {
    const row = record(item);
    if (!row || typeof row.id !== 'string') return [];
    return [{
      id: row.id,
      label: text(row.label),
      value: typeof row.value === 'number' ? row.value : 0,
      suffix: text(row.suffix),
    }];
  });
}
