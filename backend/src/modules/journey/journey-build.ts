import { scheduleFor, type ScheduleStatus } from '../curriculum/schedule.js';
import { isPublicRecord } from '../curriculum/publication.js';
import { SKILL_LEVEL_LABEL } from '../progress/progress-rules.js';
import { isPublicTrainee } from '../trainees/visibility.js';
import type { MilestoneVisibility } from './journey-rules.js';

export const JOURNEY_KINDS = ['block', 'week', 'lab', 'project', 'event', 'skill', 'account', 'milestone'] as const;
export type JourneyKind = (typeof JOURNEY_KINDS)[number];

export type JourneyState = ScheduleStatus | 'recorded';

export interface JourneyItem {
  id: string;
  kind: JourneyKind;
  title: string;
  summary: string;
  occurredOn: string | null;
  visibility: MilestoneVisibility;
  state: JourneyState;
  href: string | null;
  blockId: string | null;
  deliverables: string[];
  editable: boolean;
}

export interface JourneyBody {
  displayName: string;
  slug: string;
  today: string;
  startsOn: string | null;
  endsOn: string | null;
  items: JourneyItem[];
}

export interface CurriculumSource {
  programme: { name: string; startsOn: string; endsOn: string } | null;
  blocks: Array<{
    id: string;
    sortOrder: number;
    name: string;
    professionalismTheme: string;
    cybersecurityTheme: string;
  }>;
  weeks: Array<{
    id: string;
    blockId: string;
    number: number;
    title: string;
    startsOn: string;
    professionalism: string;
    cybersecurity: string;
  }>;
  deliverables: Array<{ id: string; weekId: string; sortOrder: number; title: string }>;
}

export interface PortfolioSource {
  id: string;
  kind: string;
  reviewStatus: string;
  title: string;
  summary: string;
  startedOn: string | null;
  completedOn: string | null;
  hasPending: boolean;
  pendingKind: string | null;
  pendingTitle: string | null;
  pendingSummary: string | null;
  pendingStartedOn: string | null;
  pendingCompletedOn: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface SkillSource {
  id: string;
  reviewStatus: string;
  name: string;
  level: number;
  hasPending: boolean;
  pendingName: string | null;
  pendingLevel: number | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface EventSource {
  id: string;
  reviewStatus: string;
  title: string;
  eventDate: string | null;
  organiser: string;
  hasPending: boolean;
  pendingTitle: string | null;
  pendingEventDate: string | null;
  pendingOrganiser: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface CatalogueProjectSource {
  id: string;
  title: string;
  type: string;
  abstract: string;
  publicationStatus: string;
  listing: string;
  createdAt: Date;
}

export interface AccountSource {
  createdAt: Date | null;
  emailVerifiedAt: Date | null;
  profileReviewStatus: string;
  profileReviewedAt: Date | null;
  consentReceived: boolean;
  publicationStatus: string;
  listing: string;
  consentReceivedAt: Date | null;
}

export interface MilestoneSource {
  id: string;
  title: string;
  summary: string;
  occurredOn: string;
  visibility: MilestoneVisibility;
}

const KIND_RANK: Record<JourneyKind, number> = {
  block: 0,
  week: 1,
  account: 2,
  lab: 3,
  project: 4,
  skill: 5,
  event: 6,
  milestone: 7,
};

export function buildJourney(input: {
  displayName: string;
  slug: string;
  today: string;
  audience: 'public' | 'portal';
  curriculum: CurriculumSource;
  portfolio: PortfolioSource[];
  skills: SkillSource[];
  events: EventSource[];
  projects: CatalogueProjectSource[];
  account: AccountSource;
  milestones: MilestoneSource[];
}): JourneyBody {
  const items = sortJourney([
    ...curriculumItems(input.curriculum, input.today),
    ...portfolioItems(input.portfolio, input.audience),
    ...skillItems(input.skills, input.audience),
    ...eventItems(input.events, input.audience),
    ...projectItems(input.projects, input.audience),
    ...accountItems(input.account, input.audience),
    ...milestoneItems(input.milestones, input.audience),
  ]);
  return {
    displayName: input.displayName,
    slug: input.slug,
    today: input.today,
    startsOn: input.curriculum.programme?.startsOn ?? null,
    endsOn: input.curriculum.programme?.endsOn ?? null,
    items: input.audience === 'public' ? items.filter((item) => item.visibility === 'public') : items,
  };
}

export function curriculumItems(source: CurriculumSource, today: string): JourneyItem[] {
  if (!source.programme) return [];
  const items: JourneyItem[] = [];
  for (const block of source.blocks) {
    const weeks = source.weeks.filter((week) => week.blockId === block.id);
    const first = weeks[0];
    items.push({
      id: `block:${block.id}`,
      kind: 'block',
      title: block.name,
      summary: clip(`${block.professionalismTheme}. ${block.cybersecurityTheme}.`),
      occurredOn: first?.startsOn ?? source.programme.startsOn,
      visibility: 'public',
      state: blockState(weeks, today),
      href: first ? `/schedule?week=${first.number}` : null,
      blockId: block.id,
      deliverables: [],
      editable: false,
    });
  }
  for (const week of source.weeks) {
    const deliverables = source.deliverables
      .filter((row) => row.weekId === week.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((row) => row.title.trim())
      .filter((title) => title.length > 0);
    const summary = clip(week.cybersecurity || week.professionalism);
    items.push({
      id: `week:${week.id}`,
      kind: 'week',
      title: week.title,
      summary,
      occurredOn: week.startsOn,
      visibility: 'public',
      state: scheduleFor(week.startsOn, today),
      href: `/schedule?week=${week.number}`,
      blockId: week.blockId,
      deliverables,
      editable: false,
    });
  }
  return items;
}

export function portfolioItems(rows: PortfolioSource[], audience: 'public' | 'portal'): JourneyItem[] {
  const items: JourneyItem[] = [];
  for (const row of rows) {
    const liveTitle = row.title.trim();
    if (row.reviewStatus === 'approved' && liveTitle) {
      items.push(portfolioItem(row, 'public', {
        kind: row.kind,
        title: liveTitle,
        summary: row.summary,
        startedOn: row.startedOn,
        completedOn: row.completedOn,
      }, false));
    }
    if (audience !== 'portal') continue;
    const pending = row.hasPending;
    const draftTitle = (pending ? row.pendingTitle ?? '' : row.title).trim();
    if (row.reviewStatus === 'approved' && !pending) continue;
    if (!draftTitle) continue;
    items.push(portfolioItem(row, 'private', {
      kind: pending && row.pendingKind ? row.pendingKind : row.kind,
      title: draftTitle,
      summary: pending ? row.pendingSummary ?? '' : row.summary,
      startedOn: pending ? row.pendingStartedOn : row.startedOn,
      completedOn: pending ? row.pendingCompletedOn : row.completedOn,
    }, true));
  }
  return items;
}

export function skillItems(rows: SkillSource[], audience: 'public' | 'portal'): JourneyItem[] {
  const items: JourneyItem[] = [];
  for (const row of rows) {
    const live = row.name.trim();
    if (row.reviewStatus === 'approved' && live) {
      items.push({
        id: `skill:${row.id}`,
        kind: 'skill',
        title: live,
        summary: levelText(row.level),
        occurredOn: day(row.reviewedAt ?? row.createdAt),
        visibility: 'public',
        state: 'recorded',
        href: null,
        blockId: null,
        deliverables: [],
        editable: false,
      });
    }
    if (audience !== 'portal') continue;
    if (row.reviewStatus === 'approved' && !row.hasPending) continue;
    const title = (row.hasPending ? row.pendingName ?? '' : row.name).trim();
    if (!title) continue;
    items.push({
      id: `skill-draft:${row.id}`,
      kind: 'skill',
      title,
      summary: levelText(row.hasPending ? row.pendingLevel ?? row.level : row.level),
      occurredOn: day(row.createdAt),
      visibility: 'private',
      state: 'recorded',
      href: null,
      blockId: null,
      deliverables: [],
      editable: false,
    });
  }
  return items;
}

export function eventItems(rows: EventSource[], audience: 'public' | 'portal'): JourneyItem[] {
  const items: JourneyItem[] = [];
  for (const row of rows) {
    const live = row.title.trim();
    if (row.reviewStatus === 'approved' && live) {
      items.push(eventItem(row.id, live, row.organiser, row.eventDate, row.reviewedAt ?? row.createdAt, 'public', false));
    }
    if (audience !== 'portal') continue;
    if (row.reviewStatus === 'approved' && !row.hasPending) continue;
    const title = (row.hasPending ? row.pendingTitle ?? '' : row.title).trim();
    if (!title) continue;
    const organiser = row.hasPending ? row.pendingOrganiser ?? '' : row.organiser;
    const eventDate = row.hasPending ? row.pendingEventDate : row.eventDate;
    items.push(eventItem(`${row.id}:draft`, title, organiser, eventDate, row.createdAt, 'private', true));
  }
  return items;
}

export function projectItems(rows: CatalogueProjectSource[], audience: 'public' | 'portal'): JourneyItem[] {
  const items: JourneyItem[] = [];
  for (const row of rows) {
    const title = row.title.trim();
    if (!title) continue;
    const published = isPublishedProject(row);
    if (published) {
      items.push({
        id: `project:${row.id}`,
        kind: 'project',
        title,
        summary: clip(row.type ? `${row.type}. ${row.abstract}` : row.abstract),
        occurredOn: day(row.createdAt),
        visibility: 'public',
        state: 'recorded',
        href: `/projects/${row.id}`,
        blockId: null,
        deliverables: [],
        editable: false,
      });
    } else if (audience === 'portal') {
      items.push({
        id: `project-draft:${row.id}`,
        kind: 'project',
        title,
        summary: clip(row.type),
        occurredOn: day(row.createdAt),
        visibility: 'private',
        state: 'recorded',
        href: null,
        blockId: null,
        deliverables: [],
        editable: false,
      });
    }
  }
  return items;
}

export function accountItems(account: AccountSource, audience: 'public' | 'portal'): JourneyItem[] {
  const items: JourneyItem[] = [];
  if (account.createdAt) {
    items.push(accountItem('signed-up', 'Signed up', 'The trainee account was created.', account.createdAt, 'public'));
  }
  if (account.emailVerifiedAt) {
    items.push(accountItem('email-confirmed', 'Email confirmed', 'The trainee confirmed their email.', account.emailVerifiedAt, 'public'));
  }
  if (account.profileReviewStatus === 'approved' && account.profileReviewedAt) {
    items.push(accountItem('profile-approved', 'Profile approved', 'An administrator approved the public profile.', account.profileReviewedAt, 'public'));
  } else if (audience === 'portal' && account.profileReviewStatus === 'pending') {
    items.push(accountItem('profile-pending', 'Profile submitted for review', 'The public profile is waiting for review.', account.profileReviewedAt ?? account.createdAt, 'private'));
  } else if (audience === 'portal' && account.profileReviewStatus === 'rejected') {
    items.push(accountItem('profile-rejected', 'Profile was not approved', 'The public profile needs another edit before it can be approved.', account.profileReviewedAt ?? account.createdAt, 'private'));
  }
  if (isPublicTrainee({
    publicationStatus: asPublication(account.publicationStatus),
    listing: asListing(account.listing),
    consentReceived: account.consentReceived,
  })) {
    items.push(accountItem(
      'profile-published',
      'Profile published',
      'The profile is on the public site.',
      account.consentReceivedAt ?? account.profileReviewedAt ?? account.createdAt,
      'public',
    ));
  }
  return items.filter((item) => item.occurredOn);
}

export function milestoneItems(rows: MilestoneSource[], audience: 'public' | 'portal'): JourneyItem[] {
  return rows
    .filter((row) => audience === 'portal' || row.visibility === 'public')
    .map((row) => ({
      id: row.id,
      kind: 'milestone' as const,
      title: row.title,
      summary: clip(row.summary),
      occurredOn: row.occurredOn,
      visibility: row.visibility,
      state: 'recorded' as const,
      href: null,
      blockId: null,
      deliverables: [],
      editable: audience === 'portal',
    }));
}

export function sortJourney(items: JourneyItem[]): JourneyItem[] {
  return [...items].sort((a, b) => {
    const left = a.occurredOn ?? '9999-99-99';
    const right = b.occurredOn ?? '9999-99-99';
    if (left !== right) return left < right ? -1 : 1;
    const rank = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (rank !== 0) return rank;
    return a.title.localeCompare(b.title);
  });
}

function portfolioItem(
  row: PortfolioSource,
  visibility: MilestoneVisibility,
  content: { kind: string; title: string; summary: string; startedOn: string | null; completedOn: string | null },
  draft: boolean,
): JourneyItem {
  const lab = content.kind === 'lab';
  const label = content.kind === 'case_study' ? 'Case study' : lab ? 'Lab' : 'Project';
  return {
    id: draft ? `portfolio-draft:${row.id}` : `portfolio:${row.id}`,
    kind: lab ? 'lab' : 'project',
    title: content.title,
    summary: clip(content.summary ? `${label}. ${content.summary}` : label),
    occurredOn: content.completedOn || content.startedOn || day(row.reviewedAt ?? row.createdAt),
    visibility,
    state: 'recorded',
    href: null,
    blockId: null,
    deliverables: [],
    editable: false,
  };
}

function eventItem(
  id: string,
  title: string,
  organiser: string,
  eventDate: string | null,
  fallback: Date | null,
  visibility: MilestoneVisibility,
  draft: boolean,
): JourneyItem {
  return {
    id: draft ? `event-draft:${id}` : `event:${id}`,
    kind: 'event',
    title,
    summary: clip(organiser),
    occurredOn: eventDate || day(fallback),
    visibility,
    state: 'recorded',
    href: null,
    blockId: null,
    deliverables: [],
    editable: false,
  };
}

function accountItem(
  id: string,
  title: string,
  summary: string,
  when: Date | null,
  visibility: MilestoneVisibility,
): JourneyItem {
  return {
    id: `account:${id}`,
    kind: 'account',
    title,
    summary,
    occurredOn: day(when),
    visibility,
    state: 'recorded',
    href: null,
    blockId: null,
    deliverables: [],
    editable: false,
  };
}

function blockState(weeks: Array<{ startsOn: string }>, today: string): JourneyState {
  if (weeks.length === 0) return 'upcoming';
  const states = weeks.map((week) => scheduleFor(week.startsOn, today));
  if (states.every((state) => state === 'done')) return 'done';
  if (states.some((state) => state === 'now' || state === 'done')) return 'now';
  return 'upcoming';
}

function isPublishedProject(row: CatalogueProjectSource): boolean {
  return isPublicRecord({
    publicationStatus: asPublication(row.publicationStatus),
    listing: asListing(row.listing),
  });
}

function asPublication(value: string): 'draft' | 'in_review' | 'scheduled' | 'published' {
  if (value === 'in_review' || value === 'scheduled' || value === 'published') return value;
  return 'draft';
}

function asListing(value: string): 'hidden' | 'sample' | 'public' {
  if (value === 'sample' || value === 'public') return value;
  return 'hidden';
}

function levelText(level: number): string {
  if (level === 1 || level === 2 || level === 3 || level === 4) return SKILL_LEVEL_LABEL[level];
  return '';
}

function day(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function clip(value: string, max = 280): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}
