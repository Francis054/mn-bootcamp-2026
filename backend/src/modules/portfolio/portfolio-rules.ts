import { projectUrlProblem } from '../projects/project-url.js';
import type { ReviewStatus } from '../trainees/profile-review.js';

export const PORTFOLIO_KINDS = ['project', 'lab', 'case_study'] as const;
export type PortfolioKind = (typeof PORTFOLIO_KINDS)[number];

export const MAX_PORTFOLIO_ITEMS = 30;
export const MAX_PORTFOLIO_IMAGES = 8;
export const MAX_PORTFOLIO_VIDEOS = 3;
export const PORTFOLIO_TITLE_MAX = 160;
export const PORTFOLIO_SUMMARY_MAX = 20_000;
export const PORTFOLIO_SKILL_MAX = 40;
export const PORTFOLIO_SKILL_COUNT = 12;
export const PORTFOLIO_ALT_MAX = 200;

export const SUBMIT_NEEDS_CONSENT = 'Agree to a public profile before you submit this for review.';
export const SUBMIT_NEEDS_CHANGES = 'Change the item before you submit it again.';
export const ITEM_ALREADY_PENDING = 'This item is already waiting for review.';
export const APPROVE_ONLY_PENDING = 'Only an item that is waiting for review can be approved.';
export const REJECT_ONLY_PENDING = 'Only an item that is waiting for review can be rejected.';

export interface ItemContent {
  kind: PortfolioKind;
  title: string;
  summary: string;
  skills: string[];
  startedOn: string | null;
  completedOn: string | null;
  repositoryUrl: string | null;
  demoUrl: string | null;
}

export function isPortfolioKind(value: string): value is PortfolioKind {
  return (PORTFOLIO_KINDS as readonly string[]).includes(value);
}

export function emptyItem(kind: PortfolioKind = 'project'): ItemContent {
  return {
    kind,
    title: '',
    summary: '',
    skills: [],
    startedOn: null,
    completedOn: null,
    repositoryUrl: null,
    demoUrl: null,
  };
}

export function readItemWrite(
  body: unknown,
  mode: 'create' | 'patch',
): { value: Partial<ItemContent>; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const value: Partial<ItemContent> = {};
  if (!isRecord(body)) {
    errors.form = 'Check the highlighted fields.';
    return { value, errors };
  }
  if (mode === 'create' || 'kind' in body) {
    const kind = typeof body.kind === 'string' ? body.kind : '';
    if (!isPortfolioKind(kind)) errors.kind = 'Choose a project, a lab, or a case study.';
    else value.kind = kind;
  }
  if (mode === 'create' || 'title' in body) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) errors.title = 'Enter a title.';
    else if (title.length > PORTFOLIO_TITLE_MAX) errors.title = 'Use at most 160 characters.';
    else value.title = title;
  }
  if (mode === 'create' || 'summary' in body) {
    if (body.summary === undefined || body.summary === null) value.summary = '';
    else if (typeof body.summary !== 'string') errors.summary = 'Enter a summary or write-up.';
    else if (body.summary.length > PORTFOLIO_SUMMARY_MAX) errors.summary = 'Use at most 20000 characters.';
    else value.summary = body.summary.trim();
  }
  if (mode === 'create' || 'skills' in body) {
    if (body.skills === undefined || body.skills === null || body.skills === '') value.skills = [];
    else {
      const skills = readSkills(body.skills);
      if (!skills) errors.skills = 'List skills or tools as text.';
      else if (skills.length > PORTFOLIO_SKILL_COUNT) errors.skills = 'List at most 12 skills or tools.';
      else if (skills.some((skill) => skill.length > PORTFOLIO_SKILL_MAX)) {
        errors.skills = 'Use at most 40 characters for each skill or tool.';
      } else value.skills = skills;
    }
  }
  if (mode === 'create' || 'startedOn' in body) {
    const started = readDate(body.startedOn);
    if (!started.ok) errors.startedOn = 'Use a date as YYYY-MM-DD, or leave it blank.';
    else value.startedOn = started.date;
  }
  if (mode === 'create' || 'completedOn' in body) {
    const completed = readDate(body.completedOn);
    if (!completed.ok) errors.completedOn = 'Use a date as YYYY-MM-DD, or leave it blank.';
    else value.completedOn = completed.date;
  }
  if (mode === 'create' || 'repositoryUrl' in body) {
    const link = readLink(body.repositoryUrl);
    if (!link.ok) errors.repositoryUrl = link.message;
    else value.repositoryUrl = link.url;
  }
  if (mode === 'create' || 'demoUrl' in body) {
    const link = readLink(body.demoUrl);
    if (!link.ok) errors.demoUrl = link.message;
    else value.demoUrl = link.url;
  }
  return { value, errors };
}

export function itemDateProblem(content: ItemContent): string | undefined {
  if (content.startedOn && content.completedOn && content.startedOn > content.completedOn) {
    return 'The end date cannot be earlier than the start date.';
  }
  return undefined;
}

export function applyItemPatch(current: ItemContent, patch: Partial<ItemContent>): ItemContent {
  const next = { ...current };
  if (patch.kind !== undefined) next.kind = patch.kind;
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.summary !== undefined) next.summary = patch.summary;
  if (patch.skills !== undefined) next.skills = patch.skills;
  if (patch.startedOn !== undefined) next.startedOn = patch.startedOn;
  if (patch.completedOn !== undefined) next.completedOn = patch.completedOn;
  if (patch.repositoryUrl !== undefined) next.repositoryUrl = patch.repositoryUrl;
  if (patch.demoUrl !== undefined) next.demoUrl = patch.demoUrl;
  return next;
}

export function submitItem(
  status: ReviewStatus,
  publicProfileConsent: boolean,
): { ok: true; status: 'pending' } | { ok: false; message: string } {
  if (!publicProfileConsent) return { ok: false, message: SUBMIT_NEEDS_CONSENT };
  if (status === 'pending') return { ok: false, message: ITEM_ALREADY_PENDING };
  if (status === 'approved') return { ok: false, message: SUBMIT_NEEDS_CHANGES };
  return { ok: true, status: 'pending' };
}

export function approveItem(
  status: ReviewStatus,
): { ok: true; status: 'approved' } | { ok: false; message: string } {
  if (status !== 'pending') return { ok: false, message: APPROVE_ONLY_PENDING };
  return { ok: true, status: 'approved' };
}

export function rejectItem(
  status: ReviewStatus,
  reason: string,
): { ok: true; status: 'rejected'; reason: string } | { ok: false; message: string } {
  if (status !== 'pending') return { ok: false, message: REJECT_ONLY_PENDING };
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, message: 'Enter a reason the trainee can read.' };
  if (trimmed.length > 500) return { ok: false, message: 'Use at most 500 characters.' };
  return { ok: true, status: 'rejected', reason: trimmed };
}

export function readReorderIds(body: unknown): string[] | undefined {
  if (!isRecord(body) || !Array.isArray(body.ids)) return undefined;
  const ids: unknown[] = body.ids;
  const text: string[] = [];
  for (const id of ids) {
    if (typeof id !== 'string' || id.trim().length === 0) return undefined;
    text.push(id.trim());
  }
  return text;
}

function readSkills(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items: unknown[] = value;
    const skills: string[] = [];
    for (const item of items) {
      if (typeof item !== 'string') return undefined;
      const trimmed = item.trim();
      if (trimmed) skills.push(trimmed);
    }
    return skills;
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return undefined;
}

function readDate(value: unknown): { ok: true; date: string | null } | { ok: false } {
  if (value === undefined || value === null || value === '') return { ok: true, date: null };
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false };
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return { ok: false };
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { ok: false };
  }
  return { ok: true, date: value };
}

function readLink(value: unknown): { ok: true; url: string | null } | { ok: false; message: string } {
  if (value === undefined || value === null || value === '') return { ok: true, url: null };
  const problem = projectUrlProblem(value);
  if (problem) return { ok: false, message: problem };
  if (typeof value !== 'string') return { ok: false, message: 'Enter a full link starting with https://.' };
  const trimmed = value.trim();
  return { ok: true, url: trimmed.length === 0 ? null : trimmed };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
