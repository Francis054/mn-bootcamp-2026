import { projectUrlProblem } from '../projects/project-url.js';
import { REJECT_NEEDS_REASON, REJECT_REASON_LIMIT, type ReviewStatus } from '../trainees/profile-review.js';

export const SKILL_LEVELS = [1, 2, 3, 4] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const SKILL_LEVEL_LABEL: Record<SkillLevel, string> = {
  1: 'Learning',
  2: 'Practising',
  3: 'Confident',
  4: 'Can teach',
};

export const MAX_SKILLS = 20;
export const MAX_EVENTS = 30;
export const SKILL_NAME_MAX = 60;
export const EVENT_TITLE_MAX = 200;
export const ORGANISER_MAX = 160;

const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SkillContent {
  name: string;
  level: SkillLevel;
  evidenceItemId: string | null;
}

export interface EventContent {
  title: string;
  eventDate: string | null;
  organiser: string;
  link: string | null;
}

export function skillSlug(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SKILL_NAME_MAX);
  return slug || 'skill';
}

export function isSkillLevel(value: number): value is SkillLevel {
  return (SKILL_LEVELS as readonly number[]).includes(value);
}

export function emptySkill(): SkillContent {
  return { name: '', level: 1, evidenceItemId: null };
}

export function emptyEvent(): EventContent {
  return { title: '', eventDate: null, organiser: '', link: null };
}

export function readSkillWrite(
  body: unknown,
  mode: 'create' | 'patch',
  current: SkillContent,
): { value: SkillContent; errors: Record<string, string> } {
  const record = isRecord(body) ? body : {};
  const errors: Record<string, string> = {};
  let name = current.name;
  if ('name' in record || mode === 'create') {
    name = typeof record.name === 'string' ? record.name.trim() : mode === 'create' ? '' : current.name;
    if (!name) errors.name = 'Enter the skill.';
    else if (name.length > SKILL_NAME_MAX) errors.name = `Use at most ${SKILL_NAME_MAX} characters.`;
  }
  let level = current.level;
  if ('level' in record || mode === 'create') {
    const raw = record.level;
    const parsed = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : mode === 'create' ? 1 : current.level;
    if (!isSkillLevel(parsed)) errors.level = 'Choose learning, practising, confident, or can teach.';
    else level = parsed;
  }
  let evidenceItemId = current.evidenceItemId;
  if ('evidenceItemId' in record || mode === 'create') {
    const raw = record.evidenceItemId;
    if (raw === null || raw === undefined || raw === '') evidenceItemId = null;
    else if (typeof raw === 'string' && UUID.test(raw)) evidenceItemId = raw;
    else errors.evidenceItemId = 'Choose one of your portfolio items.';
  }
  return { value: { name, level, evidenceItemId }, errors };
}

export function readEventWrite(
  body: unknown,
  mode: 'create' | 'patch',
  current: EventContent,
): { value: EventContent; errors: Record<string, string> } {
  const record = isRecord(body) ? body : {};
  const errors: Record<string, string> = {};
  let title = current.title;
  if ('title' in record || mode === 'create') {
    title = typeof record.title === 'string' ? record.title.trim() : mode === 'create' ? '' : current.title;
    if (!title) errors.title = 'Enter the event title.';
    else if (title.length > EVENT_TITLE_MAX) errors.title = `Use at most ${EVENT_TITLE_MAX} characters.`;
  }
  let eventDate = current.eventDate;
  if ('eventDate' in record || mode === 'create') {
    const raw = record.eventDate;
    if (raw === null || raw === undefined || raw === '') eventDate = null;
    else if (typeof raw !== 'string') errors.eventDate = 'Use a date as YYYY-MM-DD.';
    else {
      const date = raw.trim();
      const problem = dateProblem(date);
      if (problem) errors.eventDate = problem;
      else eventDate = date;
    }
  }
  let organiser = current.organiser;
  if ('organiser' in record || mode === 'create') {
    organiser = typeof record.organiser === 'string' ? record.organiser.trim() : '';
    if (organiser.length > ORGANISER_MAX) errors.organiser = `Use at most ${ORGANISER_MAX} characters.`;
  }
  let link = current.link;
  if ('link' in record || mode === 'create') {
    const raw = record.link;
    if (raw === null || raw === undefined || raw === '') link = null;
    else {
      const problem = projectUrlProblem(raw);
      if (problem) errors.link = problem;
      else link = typeof raw === 'string' ? raw.trim() : null;
    }
  }
  return { value: { title, eventDate, organiser, link }, errors };
}

export function submitOwned(
  status: ReviewStatus,
  publicProfileConsent: boolean,
  noun: 'skill' | 'event',
): { ok: true; status: 'pending' } | { ok: false; message: string } {
  if (!publicProfileConsent) {
    return { ok: false, message: 'Agree to a public profile before you submit it for review.' };
  }
  if (status === 'pending') return { ok: false, message: `This ${noun} is already waiting for review.` };
  if (status === 'approved') return { ok: false, message: `Change the ${noun} before you submit it again.` };
  return { ok: true, status: 'pending' };
}

export function approveOwned(
  status: ReviewStatus,
  noun: 'skill' | 'event',
): { ok: true } | { ok: false; message: string } {
  if (status !== 'pending') {
    return { ok: false, message: `Only a ${noun} that is waiting for review can be approved.` };
  }
  return { ok: true };
}

export function rejectOwned(
  status: ReviewStatus,
  reason: string,
  noun: 'skill' | 'event',
): { ok: true; reason: string } | { ok: false; message: string } {
  if (status !== 'pending') {
    return { ok: false, message: `Only a ${noun} that is waiting for review can be rejected.` };
  }
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, message: REJECT_NEEDS_REASON };
  if (trimmed.length > 500) return { ok: false, message: REJECT_REASON_LIMIT };
  return { ok: true, reason: trimmed };
}

function dateProblem(value: string): string | undefined {
  if (!DATE.test(value)) return 'Use a date as YYYY-MM-DD.';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return 'Use a real date.';
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return 'Use a real date.';
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
