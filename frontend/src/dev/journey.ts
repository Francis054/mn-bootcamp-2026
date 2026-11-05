import { ApiError } from '@/domain/types';
import { can } from '@/domain/permissions';
import { newId, scheduleFor } from '@/domain/format';
import { isApiPublic } from '@/domain/publish';
import type { PublicTimetable } from '@/domain/timetable';
import { getState } from './store';
import { readActiveSession } from './session';
import { timetableRoute } from './timetable-store';

interface StoredMilestone {
  id: string;
  traineeId: string;
  title: string;
  summary: string;
  occurredOn: string;
  visibility: 'private' | 'public';
}

const milestones = new Map<string, StoredMilestone>();

export function resetJourneyDev(): void {
  milestones.clear();
}

export async function journeyRoute(method: string, path: string, raw: unknown): Promise<unknown> {
  const publicMatch = path.match(/^\/public\/trainees\/([^/]+)\/journey$/);
  if (method === 'GET' && publicMatch) return publicJourney(decodeURIComponent(publicMatch[1] ?? ''));
  if (!path.startsWith('/portal/journey')) return undefined;
  const traineeId = requireTrainee();
  if (method === 'GET' && path === '/portal/journey') return build(traineeId, 'portal');
  if (method === 'POST' && path === '/portal/journey/milestones') return create(traineeId, record(raw));
  const one = path.match(/^\/portal\/journey\/milestones\/([^/]+)$/);
  if (one && method === 'PATCH') return update(traineeId, decodeURIComponent(one[1] ?? ''), record(raw));
  if (one && method === 'DELETE') return remove(traineeId, decodeURIComponent(one[1] ?? ''));
  return undefined;
}

async function publicJourney(slugOrId: string): Promise<unknown> {
  const trainee = getState().trainees.find((item) => item.id === slugOrId || item.slug === slugOrId);
  if (!trainee || !isApiPublic(trainee)) {
    throw new ApiError('not_found', 'That page is not available.', 404);
  }
  return build(trainee.id, 'public');
}

async function build(traineeId: string, audience: 'public' | 'portal'): Promise<unknown> {
  const trainee = getState().trainees.find((item) => item.id === traineeId);
  const login = getState().users.find((item) => item.traineeId === traineeId);
  const timetable = await timetableRoute('GET', '/public/timetable', {}, {}) as PublicTimetable;
  const items: Array<Record<string, unknown>> = [];
  for (const block of timetable.blocks ?? []) {
    const first = block.weeks[0];
    items.push({
      id: `block:${block.id}`,
      kind: 'block',
      title: block.name,
      summary: `${block.professionalismTheme}. ${block.cybersecurityTheme}.`,
      occurredOn: first?.startsOn ?? timetable.programme?.startsOn ?? null,
      visibility: 'public',
      state: 'upcoming',
      href: first ? `/schedule?week=${first.number}` : null,
      blockId: block.id,
      deliverables: [],
      editable: false,
    });
    for (const week of block.weeks) {
      const state = scheduleFor(week.startsOn);
      items.push({
        id: `week:${week.id}`,
        kind: 'week',
        title: week.title,
        summary: week.cybersecurity,
        occurredOn: week.startsOn,
        visibility: 'public',
        state,
        href: `/schedule?week=${week.number}`,
        blockId: block.id,
        deliverables: week.deliverables.map((row) => row.title),
        editable: false,
      });
    }
  }
  if (login) {
    items.push({
      id: 'account:signed-up',
      kind: 'account',
      title: 'Signed up',
      summary: 'The trainee account was created.',
      occurredOn: '2026-10-01',
      visibility: 'public',
      state: 'recorded',
      href: null,
      blockId: null,
      deliverables: [],
      editable: false,
    });
    if (login.emailVerified !== false) {
      items.push({
        id: 'account:email-confirmed',
        kind: 'account',
        title: 'Email confirmed',
        summary: 'The trainee confirmed their email.',
        occurredOn: '2026-10-02',
        visibility: 'public',
        state: 'recorded',
        href: null,
        blockId: null,
        deliverables: [],
        editable: false,
      });
    }
  }
  for (const row of milestones.values()) {
    if (row.traineeId !== traineeId) continue;
    if (audience === 'public' && row.visibility !== 'public') continue;
    items.push({
      id: row.id,
      kind: 'milestone',
      title: row.title,
      summary: row.summary,
      occurredOn: row.occurredOn,
      visibility: row.visibility,
      state: 'recorded',
      href: null,
      blockId: null,
      deliverables: [],
      editable: audience === 'portal',
    });
  }
  return {
    displayName: trainee?.displayName ?? 'Trainee',
    slug: trainee?.slug || traineeId,
    today: timetable.today,
    startsOn: timetable.programme?.startsOn ?? null,
    endsOn: timetable.programme?.endsOn ?? null,
    items: audience === 'public' ? items.filter((item) => item.visibility === 'public') : items,
  };
}

function create(traineeId: string, body: Record<string, unknown>): MilestoneView {
  const value = read(body, 'create');
  const row: StoredMilestone = {
    id: newId('milestone'),
    traineeId,
    title: value.title ?? '',
    summary: value.summary ?? '',
    occurredOn: value.occurredOn ?? '',
    visibility: value.visibility ?? 'private',
  };
  milestones.set(row.id, row);
  return present(row);
}

function update(traineeId: string, id: string, body: Record<string, unknown>): MilestoneView {
  const row = own(traineeId, id);
  const value = read(body, 'patch');
  if (value.title !== undefined) row.title = value.title;
  if (value.summary !== undefined) row.summary = value.summary;
  if (value.occurredOn !== undefined) row.occurredOn = value.occurredOn;
  if (value.visibility !== undefined) row.visibility = value.visibility;
  return present(row);
}

function remove(traineeId: string, id: string): { id: string } {
  const row = own(traineeId, id);
  milestones.delete(row.id);
  return { id: row.id };
}

function own(traineeId: string, id: string): StoredMilestone {
  const row = milestones.get(id);
  if (!row || row.traineeId !== traineeId) {
    throw new ApiError('not_found', 'That milestone was not found.', 404);
  }
  return row;
}

interface MilestoneView {
  id: string;
  title: string;
  summary: string;
  occurredOn: string;
  visibility: 'private' | 'public';
}

function present(row: StoredMilestone): MilestoneView {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    occurredOn: row.occurredOn,
    visibility: row.visibility,
  };
}

function read(body: Record<string, unknown>, mode: 'create' | 'patch'): Partial<StoredMilestone> {
  const errors: Record<string, string> = {};
  const value: Partial<StoredMilestone> = {};
  if (mode === 'create' || 'title' in body) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) errors.title = 'Enter a title.';
    else value.title = title;
  }
  if (mode === 'create' || 'occurredOn' in body) {
    const occurredOn = typeof body.occurredOn === 'string' ? body.occurredOn.trim() : '';
    if (!occurredOn) errors.occurredOn = 'Pick a date.';
    else if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(occurredOn)) errors.occurredOn = 'Use a date as YYYY-MM-DD.';
    else value.occurredOn = occurredOn;
  }
  if (mode === 'create' || 'summary' in body) {
    value.summary = typeof body.summary === 'string' ? body.summary.trim() : '';
  }
  if (mode === 'create' || 'visibility' in body) {
    if (body.visibility !== 'private' && body.visibility !== 'public') errors.visibility = 'Choose private or public.';
    else value.visibility = body.visibility;
  }
  if (Object.keys(errors).length) {
    throw new ApiError('validation', 'Check the highlighted fields.', 422, errors);
  }
  return value;
}

function requireTrainee(): string {
  const session = readActiveSession();
  if (!session) throw new ApiError('unauthenticated', 'Sign in to continue.', 401);
  const user = getState().users.find((item) => item.id === session.user.id);
  if (!user || user.disabled) throw new ApiError('unauthenticated', 'Sign in to continue.', 401);
  if (!can(user.role, 'portal.access')) throw new ApiError('forbidden', 'You do not have access to that.', 403);
  if (!user.traineeId) throw new ApiError('not_found', 'Your login is not linked to a trainee record yet.', 404);
  return user.traineeId;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
