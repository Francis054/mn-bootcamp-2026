import { ApiError } from '@/domain/types';
import type { Trainee } from '@/domain/types';
import { can } from '@/domain/permissions';
import { newId } from '@/domain/format';
import { profilePhotoFileProblem, readFileBytes, sniffedPhotoMime } from '@/domain/photo';
import { safeHttps } from '@/domain/portfolio';
import {
  type EventContent,
  type EventRecord,
  type SkillContent,
  type SkillLevel,
  type SkillRecord,
} from '@/domain/progress';
import { getState, updateState } from './store';
import { clearSession, readActiveSession } from './session';
import { portfolioEvidence, portfolioOwned } from './portfolio';
import { trainerIsLinked } from './timetable-store';

function fail(code: 'validation' | 'unauthenticated' | 'forbidden' | 'not_found', message: string, status: number, fieldErrors?: Record<string, string>): never {
  throw new ApiError(code, message, status, fieldErrors);
}

const skills = new Map<string, DevSkill>();
const events = new Map<string, DevEvent>();

interface DevSkill {
  id: string;
  traineeId: string;
  slug: string;
  sortOrder: number;
  status: SkillRecord['status'];
  rejectionReason: string;
  submittedAt: string | null;
  hasPending: boolean;
  live: SkillContent;
  pending: SkillContent | null;
}

interface DevEvent {
  id: string;
  traineeId: string;
  sortOrder: number;
  status: EventRecord['status'];
  rejectionReason: string;
  submittedAt: string | null;
  hasPending: boolean;
  live: EventContent;
  pending: EventContent | null;
}

export function resetProgressDev(): void {
  skills.clear();
  events.clear();
}

export async function progressRoute(method: string, path: string, raw: unknown): Promise<unknown | undefined> {
  if (path === '/public/trainees' || !path.includes('/skills') && !path.includes('/events') && path !== '/progress/trainees') {
    if (!path.startsWith('/portal/skills') && !path.startsWith('/portal/events') && !path.startsWith('/admin/review-queue/skills') && !path.startsWith('/admin/review-queue/events') && !path.startsWith('/admin/trainees/') && path !== '/progress/trainees' && !path.includes('/skills') && !path.includes('/events')) {
      return undefined;
    }
  }
  const publicSkills = /^\/public\/trainees\/([^/]+)\/skills$/.exec(path);
  if (publicSkills && method === 'GET') return publicSkillList(decodeURIComponent(publicSkills[1] ?? ''));
  const publicEvents = /^\/public\/trainees\/([^/]+)\/events$/.exec(path);
  if (publicEvents && method === 'GET') return publicEventList(decodeURIComponent(publicEvents[1] ?? ''));
  if (path === '/progress/trainees' && method === 'GET') return trainerList();
  if (path === '/admin/review-queue/skills' && method === 'GET') return skillQueue();
  if (path === '/admin/review-queue/events' && method === 'GET') return eventQueue();
  const skillReview = /^\/admin\/review-queue\/skills\/([^/]+)(?:\/(approve|reject))?$/.exec(path);
  if (skillReview) return reviewSkill(method, decodeURIComponent(skillReview[1] ?? ''), skillReview[2], record(raw));
  const eventReview = /^\/admin\/review-queue\/events\/([^/]+)(?:\/(approve|reject))?$/.exec(path);
  if (eventReview) return reviewEvent(method, decodeURIComponent(eventReview[1] ?? ''), eventReview[2], record(raw));
  const adminSkill = /^\/admin\/trainees\/([^/]+)\/skills(?:\/([^/]+))?$/.exec(path);
  if (adminSkill) return adminSkillRoute(method, decodeURIComponent(adminSkill[1] ?? ''), adminSkill[2], record(raw));
  const adminEvent = /^\/admin\/trainees\/([^/]+)\/events(?:\/([^/]+)(?:\/(certificate))?)?$/.exec(path);
  if (adminEvent) return adminEventRoute(method, decodeURIComponent(adminEvent[1] ?? ''), adminEvent[2], adminEvent[3], raw);
  if (path === '/portal/skills' && method === 'GET') return listSkills();
  if (path === '/portal/skills' && method === 'POST') return createSkill(record(raw));
  const skill = /^\/portal\/skills\/([^/]+)(?:\/(submit))?$/.exec(path);
  if (skill) {
    const id = decodeURIComponent(skill[1] ?? '');
    if (skill[2] === 'submit' && method === 'POST') return submitSkill(id);
    if (!skill[2] && method === 'PATCH') return updateSkill(id, record(raw));
    if (!skill[2] && method === 'DELETE') return deleteSkill(id);
  }
  if (path === '/portal/events' && method === 'GET') return listEvents();
  if (path === '/portal/events' && method === 'POST') return createEvent(record(raw));
  const event = /^\/portal\/events\/([^/]+)(?:\/(submit|certificate))?$/.exec(path);
  if (event) {
    const id = decodeURIComponent(event[1] ?? '');
    if (event[2] === 'submit' && method === 'POST') return submitEvent(id);
    if (event[2] === 'certificate' && method === 'POST') return addCertificate(id, raw);
    if (event[2] === 'certificate' && method === 'DELETE') return removeCertificate(id);
    if (!event[2] && method === 'PATCH') return updateEvent(id, record(raw));
    if (!event[2] && method === 'DELETE') return deleteEvent(id);
  }
  if (path.startsWith('/portal/skills') || path.startsWith('/portal/events') || path.startsWith('/admin/review-queue/skills') || path.startsWith('/admin/review-queue/events') || path === '/progress/trainees') {
    return undefined;
  }
  return undefined;
}

function listSkills(): SkillRecord[] {
  const trainee = ownTrainee();
  return [...skills.values()].filter((row) => row.traineeId === trainee.id).sort(byOrder).map(presentSkill);
}

function createSkill(body: Record<string, unknown>): SkillRecord {
  const trainee = requireWrite();
  const content = readSkill(body, emptySkill(), true);
  const mine = [...skills.values()].filter((row) => row.traineeId === trainee.id);
  if (mine.length >= 20) fail('validation', 'You can keep at most 20 skills.', 422);
  assertEvidence(trainee.id, content.evidenceItemId);
  const row: DevSkill = {
    id: newId('skill'),
    traineeId: trainee.id,
    slug: slug(content.name, mine.map((item) => item.slug)),
    sortOrder: mine.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1,
    status: 'draft',
    rejectionReason: '',
    submittedAt: null,
    hasPending: true,
    live: emptySkill(),
    pending: content,
  };
  skills.set(row.id, row);
  return presentSkill(row);
}

function updateSkill(id: string, body: Record<string, unknown>): SkillRecord {
  const row = ownSkill(id);
  ensureSkill(row);
  const content = readSkill(body, row.pending ?? row.live, false);
  assertEvidence(row.traineeId, content.evidenceItemId);
  row.pending = content;
  if (row.status !== 'pending') row.status = 'draft';
  return presentSkill(row);
}

function deleteSkill(id: string): { id: string } {
  const row = ownSkill(id);
  skills.delete(row.id);
  syncCards(row.traineeId, true);
  return { id: row.id };
}

function submitSkill(id: string): SkillRecord {
  const trainee = requireWrite();
  const row = ownSkill(id);
  if (!row.hasPending) row.pending = { ...row.live };
  row.hasPending = true;
  if (!row.pending?.name) fail('validation', 'Check the highlighted fields.', 422, { name: 'Enter the skill.' });
  if (!trainee.consentReceived) fail('validation', 'Agree to a public profile before you submit it for review.', 422);
  if (row.status === 'pending') fail('validation', 'This skill is already waiting for review.', 422);
  if (row.status === 'approved') fail('validation', 'Change the skill before you submit it again.', 422);
  row.status = 'pending';
  row.submittedAt = new Date().toISOString();
  row.rejectionReason = '';
  return presentSkill(row);
}

function listEvents(): EventRecord[] {
  const trainee = ownTrainee();
  return [...events.values()].filter((row) => row.traineeId === trainee.id).sort(byOrder).map(presentEvent);
}

function createEvent(body: Record<string, unknown>): EventRecord {
  const trainee = requireWrite();
  const content = readEvent(body, emptyEvent(), true);
  const mine = [...events.values()].filter((row) => row.traineeId === trainee.id);
  if (mine.length >= 30) fail('validation', 'You can keep at most 30 events.', 422);
  const row: DevEvent = {
    id: newId('event'),
    traineeId: trainee.id,
    sortOrder: mine.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1,
    status: 'draft',
    rejectionReason: '',
    submittedAt: null,
    hasPending: true,
    live: emptyEvent(),
    pending: content,
  };
  events.set(row.id, row);
  return presentEvent(row);
}

function updateEvent(id: string, body: Record<string, unknown>): EventRecord {
  const row = ownEvent(id);
  ensureEvent(row);
  row.pending = { ...(row.pending ?? row.live), ...readEvent(body, row.pending ?? row.live, false), certificateUrl: row.pending?.certificateUrl ?? null };
  if (row.status !== 'pending') row.status = 'draft';
  return presentEvent(row);
}

function deleteEvent(id: string): { id: string } {
  const row = ownEvent(id);
  events.delete(row.id);
  return { id: row.id };
}

function submitEvent(id: string): EventRecord {
  const trainee = requireWrite();
  const row = ownEvent(id);
  if (!row.hasPending) row.pending = { ...row.live };
  row.hasPending = true;
  if (!row.pending?.title) fail('validation', 'Check the highlighted fields.', 422, { title: 'Enter the event title.' });
  if (!trainee.consentReceived) fail('validation', 'Agree to a public profile before you submit it for review.', 422);
  if (row.status === 'pending') fail('validation', 'This event is already waiting for review.', 422);
  if (row.status === 'approved') fail('validation', 'Change the event before you submit it again.', 422);
  row.status = 'pending';
  row.submittedAt = new Date().toISOString();
  row.rejectionReason = '';
  return presentEvent(row);
}

async function addCertificate(id: string, raw: unknown): Promise<EventRecord> {
  const row = ownEvent(id);
  ensureEvent(row);
  const file = formFile(raw);
  if (!file) fail('validation', 'Check the highlighted fields.', 422, { certificate: 'Choose an image.' });
  const size = profilePhotoFileProblem(file);
  if (size) fail('validation', 'Check the highlighted fields.', 422, { certificate: size });
  const bytes = await readFileBytes(file);
  const mime = sniffedPhotoMime(bytes);
  if (!mime) fail('validation', 'Check the highlighted fields.', 422, { certificate: 'Use a JPEG, PNG, or WebP image.' });
  if (!row.pending) row.pending = { ...row.live };
  row.pending.certificateUrl = dataUrl(bytes, mime);
  if (row.status !== 'pending') row.status = 'draft';
  return presentEvent(row);
}

function removeCertificate(id: string): EventRecord {
  const row = ownEvent(id);
  ensureEvent(row);
  if (row.pending) row.pending.certificateUrl = null;
  if (row.status !== 'pending') row.status = 'draft';
  return presentEvent(row);
}

function skillQueue(): unknown[] {
  requireStaff(false);
  return [...skills.values()].filter((row) => row.status === 'pending' && row.hasPending).map(reviewSkillRow);
}

function eventQueue(): unknown[] {
  requireStaff(false);
  return [...events.values()].filter((row) => row.status === 'pending' && row.hasPending).map(reviewEventRow);
}

function reviewSkill(method: string, id: string, action: string | undefined, body: Record<string, unknown>): unknown {
  requireStaff(method !== 'GET');
  const row = skills.get(id);
  if (!row || row.status !== 'pending') fail('not_found', 'That skill is not waiting for review.', 404);
  if (method === 'PATCH' && !action) {
    const content = readSkill(body, row.pending ?? row.live, false);
    assertEvidence(row.traineeId, content.evidenceItemId);
    row.pending = content;
    return reviewSkillRow(row);
  }
  if (method === 'POST' && action === 'approve') return approveSkill(row);
  if (method === 'POST' && action === 'reject') return rejectSkill(row, body);
  if (method === 'DELETE' && !action) {
    skills.delete(row.id);
    syncCards(row.traineeId, true);
    return { id: row.id };
  }
  return undefined;
}

function reviewEvent(method: string, id: string, action: string | undefined, body: Record<string, unknown>): unknown {
  requireStaff(method !== 'GET');
  const row = events.get(id);
  if (!row || row.status !== 'pending') fail('not_found', 'That event is not waiting for review.', 404);
  if (method === 'PATCH' && !action) {
    const next = readEvent(body, row.pending ?? row.live, false);
    row.pending = { ...next, certificateUrl: row.pending?.certificateUrl ?? null };
    return reviewEventRow(row);
  }
  if (method === 'POST' && action === 'approve') return approveEvent(row);
  if (method === 'POST' && action === 'reject') return rejectEvent(row, body);
  if (method === 'DELETE' && !action) {
    events.delete(row.id);
    return { id: row.id };
  }
  return undefined;
}

function approveSkill(row: DevSkill): unknown {
  const next = row.pending ?? row.live;
  row.live = { ...next };
  row.slug = slug(next.name, [...skills.values()].filter((item) => item.traineeId === row.traineeId && item.id !== row.id).map((item) => item.slug));
  row.pending = null;
  row.hasPending = false;
  row.status = 'approved';
  row.rejectionReason = '';
  syncCards(row.traineeId, false);
  return reviewSkillRow(row);
}

function rejectSkill(row: DevSkill, body: Record<string, unknown>): unknown {
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) fail('validation', 'Enter a reason the trainee can read.', 422, { reason: 'Enter a reason the trainee can read.' });
  row.status = 'rejected';
  row.rejectionReason = reason;
  return reviewSkillRow(row);
}

function approveEvent(row: DevEvent): unknown {
  const next = row.pending ?? row.live;
  row.live = { ...next };
  row.pending = null;
  row.hasPending = false;
  row.status = 'approved';
  row.rejectionReason = '';
  return reviewEventRow(row);
}

function rejectEvent(row: DevEvent, body: Record<string, unknown>): unknown {
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) fail('validation', 'Enter a reason the trainee can read.', 422, { reason: 'Enter a reason the trainee can read.' });
  row.status = 'rejected';
  row.rejectionReason = reason;
  return reviewEventRow(row);
}

function adminSkillRoute(method: string, traineeId: string, id: string | undefined, body: Record<string, unknown>): unknown {
  requireStaff(method !== 'GET');
  fresh(traineeId);
  if (method === 'GET' && !id) return [...skills.values()].filter((row) => row.traineeId === traineeId).map(presentSkill);
  if (method === 'POST' && !id) {
    const content = readSkill(body, emptySkill(), true);
    assertEvidence(traineeId, content.evidenceItemId);
    const mine = [...skills.values()].filter((row) => row.traineeId === traineeId);
    const row: DevSkill = {
      id: newId('skill'),
      traineeId,
      slug: slug(content.name, mine.map((item) => item.slug)),
      sortOrder: mine.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1,
      status: 'approved',
      rejectionReason: '',
      submittedAt: null,
      hasPending: false,
      live: content,
      pending: null,
    };
    skills.set(row.id, row);
    syncCards(traineeId, false);
    return presentSkill(row);
  }
  const row = id ? skills.get(decodeURIComponent(id)) : undefined;
  if (!row || row.traineeId !== traineeId) fail('not_found', 'That skill is not available.', 404);
  if (method === 'PATCH') {
    const content = readSkill(body, row.live, false);
    assertEvidence(traineeId, content.evidenceItemId);
    row.live = content;
    row.pending = null;
    row.hasPending = false;
    row.status = 'approved';
    syncCards(traineeId, false);
    return presentSkill(row);
  }
  if (method === 'DELETE') {
    skills.delete(row.id);
    syncCards(traineeId, true);
    return { id: row.id };
  }
  return undefined;
}

function adminEventRoute(method: string, traineeId: string, id: string | undefined, extra: string | undefined, raw: unknown): unknown {
  requireStaff(method !== 'GET');
  fresh(traineeId);
  const body = record(raw);
  if (method === 'GET' && !id) return [...events.values()].filter((row) => row.traineeId === traineeId).map(presentEvent);
  if (method === 'POST' && !id) {
    const content = readEvent(body, emptyEvent(), true);
    const mine = [...events.values()].filter((row) => row.traineeId === traineeId);
    const row: DevEvent = {
      id: newId('event'),
      traineeId,
      sortOrder: mine.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1,
      status: 'approved',
      rejectionReason: '',
      submittedAt: null,
      hasPending: false,
      live: content,
      pending: null,
    };
    events.set(row.id, row);
    return presentEvent(row);
  }
  const row = id ? events.get(decodeURIComponent(id)) : undefined;
  if (!row || row.traineeId !== traineeId) fail('not_found', 'That event is not available.', 404);
  if (extra === 'certificate' && method === 'POST') return addCertificate(row.id, raw);
  if (method === 'PATCH') {
    row.live = { ...readEvent(body, row.live, false), certificateUrl: row.live.certificateUrl };
    row.pending = null;
    row.hasPending = false;
    row.status = 'approved';
    return presentEvent(row);
  }
  if (method === 'DELETE') {
    events.delete(row.id);
    return { id: row.id };
  }
  return undefined;
}

async function trainerList(): Promise<unknown> {
  const session = readActiveSession();
  if (!session) fail('unauthenticated', 'Sign in to continue.', 401);
  const user = getState().users.find((item) => item.id === session.user.id);
  if (!user || !can(user.role, 'progress.read')) fail('forbidden', 'You do not have access to that.', 403);
  if (!(await trainerIsLinked(user.id))) fail('forbidden', 'Your login is not linked to a trainer on the timetable.', 403);
  const ids = new Set<string>([...skills.values()].map((row) => row.traineeId).concat([...events.values()].map((row) => row.traineeId)));
  return [...ids].flatMap((id) => {
    const trainee = getState().trainees.find((item) => item.id === id);
    if (!trainee) return [];
    return [{
      id: trainee.id,
      displayName: trainee.displayName,
      skills: [...skills.values()].filter((row) => row.traineeId === id).map(presentSkill),
      events: [...events.values()].filter((row) => row.traineeId === id).map(presentEvent),
    }];
  });
}

function publicSkillList(traineeId: string): unknown[] {
  const trainee = publicTrainee(traineeId);
  return [...skills.values()]
    .filter((row) => row.traineeId === trainee.id && row.live.name.trim())
    .sort(byOrder)
    .map((row) => ({
      id: row.id,
      name: row.live.name,
      level: row.live.level,
      evidence: row.live.evidenceItemId ? portfolioEvidence(trainee.id, row.live.evidenceItemId) : null,
    }));
}

function publicEventList(traineeId: string): unknown[] {
  const trainee = publicTrainee(traineeId);
  const showCertificate = trainee.consentReceived && trainee.photoConsent === true;
  return [...events.values()]
    .filter((row) => row.traineeId === trainee.id && row.live.title.trim())
    .sort(byOrder)
    .map((row) => ({
      id: row.id,
      title: row.live.title,
      eventDate: row.live.eventDate,
      organiser: row.live.organiser,
      link: safeHttps(row.live.link),
      certificateUrl: showCertificate ? row.live.certificateUrl : null,
    }));
}

function publicTrainee(traineeId: string): Trainee {
  const trainee = getState().trainees.find((item) => item.id === traineeId);
  if (!trainee || trainee.listing === 'hidden' || trainee.publicationStatus !== 'published' || !trainee.consentReceived) {
    fail('not_found', 'That page is not available.', 404);
  }
  return trainee;
}

function presentSkill(row: DevSkill): SkillRecord {
  return {
    id: row.id,
    sortOrder: row.sortOrder,
    status: row.status,
    rejectionReason: row.rejectionReason,
    submittedAt: row.submittedAt,
    draft: row.hasPending && row.pending ? row.pending : row.live,
    live: row.live,
  };
}

function presentEvent(row: DevEvent): EventRecord {
  return {
    id: row.id,
    sortOrder: row.sortOrder,
    status: row.status,
    rejectionReason: row.rejectionReason,
    submittedAt: row.submittedAt,
    draft: row.hasPending && row.pending ? row.pending : row.live,
    live: row.live,
  };
}

function reviewSkillRow(row: DevSkill): unknown {
  const trainee = fresh(row.traineeId);
  return { ...presentSkill(row), traineeId: trainee.id, email: trainee.email, traineeName: trainee.displayName, consents: consents(trainee) };
}

function reviewEventRow(row: DevEvent): unknown {
  const trainee = fresh(row.traineeId);
  return { ...presentEvent(row), traineeId: trainee.id, email: trainee.email, traineeName: trainee.displayName, consents: consents(trainee) };
}

function consents(trainee: Trainee): { publicProfile: boolean; publicPhoto: boolean } {
  return { publicProfile: trainee.consentReceived, publicPhoto: trainee.photoConsent === true };
}

function syncCards(traineeId: string, allowEmpty: boolean): void {
  const rows = [...skills.values()].filter((row) => row.traineeId === traineeId);
  if (!rows.length && !allowEmpty) return;
  const names = rows.filter((row) => row.status === 'approved' && row.live.name.trim()).sort(byOrder).map((row) => row.live.name);
  updateState((current) => ({
    ...current,
    trainees: current.trainees.map((trainee) => trainee.id === traineeId ? { ...trainee, skills: names } : trainee),
  }));
}

function emptySkill(): SkillContent {
  return { name: '', level: 1, evidenceItemId: null };
}

function emptyEvent(): EventContent {
  return { title: '', eventDate: null, organiser: '', link: null, certificateUrl: null };
}

function readSkill(body: Record<string, unknown>, current: SkillContent, create: boolean): SkillContent {
  const errors: Record<string, string> = {};
  const name = create || 'name' in body ? String(body.name ?? '').trim() : current.name;
  if (!name) errors.name = 'Enter the skill.';
  else if (name.length > 60) errors.name = 'Use at most 60 characters.';
  const rawLevel = create || 'level' in body ? Number(body.level ?? 1) : current.level;
  const level = rawLevel === 2 || rawLevel === 3 || rawLevel === 4 ? rawLevel : rawLevel === 1 ? 1 : 0;
  if (!level) errors.level = 'Choose learning, practising, confident, or can teach.';
  let evidenceItemId = current.evidenceItemId;
  if (create || 'evidenceItemId' in body) {
    const raw = body.evidenceItemId;
    if (raw === null || raw === undefined || raw === '') evidenceItemId = null;
    else if (typeof raw === 'string') evidenceItemId = raw;
    else errors.evidenceItemId = 'Choose one of your portfolio items.';
  }
  if (Object.keys(errors).length) fail('validation', 'Check the highlighted fields.', 422, errors);
  return { name, level: level as SkillLevel, evidenceItemId };
}

function readEvent(body: Record<string, unknown>, current: EventContent, create: boolean): EventContent {
  const errors: Record<string, string> = {};
  const title = create || 'title' in body ? String(body.title ?? '').trim() : current.title;
  if (!title) errors.title = 'Enter the event title.';
  else if (title.length > 200) errors.title = 'Use at most 200 characters.';
  let eventDate = current.eventDate;
  if (create || 'eventDate' in body) {
    const raw = body.eventDate;
    if (raw === null || raw === undefined || raw === '') eventDate = null;
    else if (typeof raw === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(raw)) eventDate = raw;
    else errors.eventDate = 'Use a date as YYYY-MM-DD.';
  }
  const organiser = create || 'organiser' in body ? String(body.organiser ?? '').trim() : current.organiser;
  if (organiser.length > 160) errors.organiser = 'Use at most 160 characters.';
  let link = current.link;
  if (create || 'link' in body) {
    const raw = body.link;
    if (raw === null || raw === undefined || raw === '') link = null;
    else {
      link = safeHttps(typeof raw === 'string' ? raw : null);
      if (!link) errors.link = 'Enter a full link starting with https://.';
    }
  }
  if (Object.keys(errors).length) fail('validation', 'Check the highlighted fields.', 422, errors);
  return { title, eventDate, organiser, link, certificateUrl: current.certificateUrl };
}

function assertEvidence(traineeId: string, itemId: string | null): void {
  if (!itemId) return;
  if (!portfolioOwned(traineeId, itemId)) {
    fail('validation', 'Check the highlighted fields.', 422, { evidenceItemId: 'Choose one of your portfolio items.' });
  }
}

function slug(name: string, taken: string[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'skill';
  if (!taken.includes(base)) return base;
  for (let index = 2; index < 100; index += 1) {
    const next = `${base.slice(0, 57)}-${index}`;
    if (!taken.includes(next)) return next;
  }
  return `${base}-x`;
}

function ensureSkill(row: DevSkill): void {
  if (row.hasPending) return;
  row.pending = { ...row.live };
  row.hasPending = true;
}

function ensureEvent(row: DevEvent): void {
  if (row.hasPending) return;
  row.pending = { ...row.live };
  row.hasPending = true;
}

function ownSkill(id: string): DevSkill {
  const trainee = requireWrite();
  const row = skills.get(id);
  if (!row || row.traineeId !== trainee.id) fail('not_found', 'That skill is not available.', 404);
  return row;
}

function ownEvent(id: string): DevEvent {
  const trainee = requireWrite();
  const row = events.get(id);
  if (!row || row.traineeId !== trainee.id) fail('not_found', 'That event is not available.', 404);
  return row;
}

function ownTrainee(): Trainee {
  const session = readActiveSession();
  if (!session) fail('unauthenticated', 'Sign in to continue.', 401);
  const user = getState().users.find((item) => item.id === session.user.id);
  if (!user) {
    clearSession();
    fail('unauthenticated', 'This development session is no longer valid.', 401);
  }
  if (!can(user.role, 'portal.access')) fail('forbidden', 'You do not have access to that.', 403);
  const trainee = getState().trainees.find((item) => item.id === user.traineeId);
  if (!trainee) fail('not_found', 'Your login is not linked to a trainee record yet.', 404);
  return trainee;
}

function requireWrite(): Trainee {
  const trainee = ownTrainee();
  const session = readActiveSession();
  const user = getState().users.find((item) => item.id === session?.user.id);
  if (!user || !can(user.role, 'portal.write')) fail('forbidden', 'You do not have access to that.', 403);
  return trainee;
}

function requireStaff(write: boolean): void {
  const session = readActiveSession();
  if (!session) fail('unauthenticated', 'Sign in to continue.', 401);
  const user = getState().users.find((item) => item.id === session.user.id);
  if (!user || !can(user.role, write ? 'content.write' : 'content.read')) fail('forbidden', 'You do not have access to that.', 403);
}

function fresh(id: string): Trainee {
  const trainee = getState().trainees.find((item) => item.id === id);
  if (!trainee) fail('not_found', 'Trainee not found.', 404);
  return trainee;
}

function byOrder(a: { sortOrder: number }, b: { sortOrder: number }): number {
  return a.sortOrder - b.sortOrder;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    const body: Record<string, unknown> = {};
    value.forEach((item, key) => {
      if (typeof item === 'string') body[key] = item;
    });
    return body;
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function formFile(value: unknown): File | null {
  if (typeof FormData === 'undefined' || !(value instanceof FormData)) return null;
  const item = value.get('file');
  if (typeof File !== 'undefined' && item instanceof File && item.size > 0) return item;
  return null;
}

function dataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}
