import { toPublicEvent, toPublicLesson, toPublicProject, toPublicTrainee } from '@/domain/publicView';
import { ApiError, type ApiErrorCode, type BootcampEvent, type Lesson, type ListQuery, type MediaItem, type Page, type Permission, type Project, type Role, type SearchHit, type Trainee, type WorkPhoto } from '@/domain/types';
import { can } from '@/domain/permissions';
import { isPubliclyListable } from '@/domain/publish';
import { includesQuery, newId, paginate, scheduleFor, slugify } from '@/domain/format';
import { displayPhotoUrl, profilePhotoFileProblem, readFileBytes, sniffedPhotoMime, type ProfilePhotoMime } from '@/domain/photo';
import { collect, emailAddress, httpUrl, minLength, required } from '@/domain/validate';
import { currentEnv } from '@/config/runtime';
import type { ApiRequest } from '@/api/liveTransport';
import { MODULES, mediaSrc } from './fixtures';
import { readWorkPhotoDataUrl, workPhotoFieldErrors, workPhotoFileError } from '@/domain/workPhoto';
import { clearSession, markSessionExpired, readActiveSession, setSession } from './session';
import { getState, updateState } from './store';
import { isAdminTimetablePath, isPublicTimetablePath, NOT_HANDLED, resetTimetableStore, timetableRoute } from './timetable-store';

const failures = new Map<string, { count: number; lockedUntil: number }>();
const resetTickets = new Map<string, { userId: string; expiresAt: number }>();
let armed: ApiError | null = null;

export function armNextError(error: ApiError | null): void {
  armed = error;
}

export function resetDevTransport(): void {
  failures.clear();
  resetTickets.clear();
  armed = null;
  resetTimetableStore();
}

function takeArmed(): void {
  if (!armed) return;
  const error = armed;
  armed = null;
  throw error;
}

function fail(code: ApiErrorCode, message: string, status: number, fieldErrors?: Record<string, string>): never {
  throw new ApiError(code, message, status, fieldErrors);
}

function assertFields(fieldErrors: Record<string, string>): void {
  if (Object.keys(fieldErrors).length) fail('validation', 'Check the highlighted fields.', 422, fieldErrors);
}

function requireAny(permissions: readonly Permission[]) {
  const session = readActiveSession();
  if (!session) {
    fail('unauthenticated', 'Sign in to continue. Production authentication is not connected.', 401);
  }
  const record = getState().users.find((user) => user.id === session.user.id);
  if (!record) {
    clearSession();
    fail('unauthenticated', 'This development session is no longer valid.', 401);
  }
  if (!permissions.some((permission) => can(record.role, permission))) {
    fail('forbidden', 'Your role cannot perform this action. The development adapter refused it.', 403);
  }
  return record;
}

function requireUser(permission: Permission) {
  const session = readActiveSession();
  if (!session) {
    fail('unauthenticated', 'Sign in to continue. Production authentication is not connected.', 401);
  }
  const record = getState().users.find((user) => user.id === session.user.id);
  if (!record) {
    clearSession();
    fail('unauthenticated', 'This development session is no longer valid.', 401);
  }
  if (!can(record.role, permission)) {
    fail('forbidden', 'Your role cannot perform this action. The development adapter refused it.', 403);
  }
  return record;
}

function pageOf<T>(items: T[], query: ListQuery = {}): Page<T> {
  return paginate(items, Number(query.page ?? 1), Number(query.pageSize ?? (items.length || 1)));
}

function sortBy<T>(items: T[], sort: string | undefined, dir: 'asc' | 'desc' | undefined, read: (item: T, key: string) => string | number): T[] {
  if (!sort) return items;
  const factor = dir === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const left = read(a, sort);
    const right = read(b, sort);
    return (left > right ? 1 : left < right ? -1 : 0) * factor;
  });
}

function lessonBody(input: Partial<Lesson>, current?: Lesson): Lesson {
  const title = String(input.title ?? current?.title ?? '');
  const summary = String(input.summary ?? current?.summary ?? '');
  const moduleId = (input.moduleId ?? current?.moduleId ?? '') as Lesson['moduleId'];
  const week = Number(input.week ?? current?.week ?? 0);
  const date = String(input.date ?? current?.date ?? '');
  assertFields(collect({
    title: required(title, 'Give the class a title.') ?? minLength(title, 6, 'Use at least 6 characters.'),
    moduleId: required(moduleId, 'Choose a module.'),
    week: week >= 1 && week <= 18 ? null : 'Enter a week from 1 to 18.',
    date: required(date, 'Pick a date.'),
    summary: required(summary, 'Write a short summary for the class card.') ?? minLength(summary, 20, 'Use at least 20 characters.'),
  }));
  const publicationStatus = input.publicationStatus ?? current?.publicationStatus ?? 'draft';
  const listing = publicationStatus === 'draft' || publicationStatus === 'in_review' ? (input.listing ?? current?.listing ?? 'hidden') : (input.listing ?? 'sample');
  return {
    id: current?.id ?? newId('class'),
    week,
    moduleId,
    title: title.trim(),
    slug: slugify(String(input.slug || title)),
    date,
    format: input.format || current?.format || 'Lecture + lab',
    phase: week <= 4 ? 1 : week <= 8 ? 2 : 3,
    scheduleStatus: input.scheduleStatus ?? scheduleFor(date),
    publicationStatus,
    listing: listing === 'hidden' && (publicationStatus === 'published' || publicationStatus === 'scheduled') ? 'sample' : listing,
    room: input.room ?? current?.room ?? '',
    summary: summary.trim(),
    objectives: input.objectives ?? current?.objectives ?? [],
    lab: input.lab ?? current?.lab ?? '',
    codeSample: input.codeSample ?? current?.codeSample ?? '',
    cover: input.cover ?? current?.cover ?? 'electronics-lab',
    internalNotes: input.internalNotes ?? current?.internalNotes ?? '',
    updatedAt: new Date().toISOString(),
  };
}

export async function devTransport<T>(req: ApiRequest): Promise<T> {
  takeArmed();
  const path = req.path.split('?')[0] || '/';
  const method = req.method;
  if (method === 'POST' && path === '/admin/trainees/photo') {
    return (await storeTraineePhoto(req.body)) as T;
  }
  const query = (req.query ?? {}) as ListQuery & Record<string, string>;
  const body = formFields(req.body);
  return (await route(method, path, query, body)) as T;
}

async function storeTraineePhoto(value: unknown): Promise<{ photoUrl: string; storageKey: string }> {
  requireUser('content.write');
  const file = photoFile(value);
  if (!file) fail('validation', 'Check the highlighted fields.', 422, { photoUrl: 'Choose an image.' });
  const sizeProblem = profilePhotoFileProblem(file);
  if (sizeProblem) fail('validation', 'Check the highlighted fields.', 422, { photoUrl: sizeProblem });
  const bytes = await readFileBytes(file);
  const mime = sniffedPhotoMime(bytes);
  if (!mime) fail('validation', 'Check the highlighted fields.', 422, { photoUrl: 'Use a JPEG, PNG, or WebP image.' });
  return { photoUrl: dataUrl(bytes, mime), storageKey: 'adapter' };
}

function photoFile(value: unknown): File | null {
  if (typeof FormData === 'undefined' || !(value instanceof FormData)) return null;
  const item = value.get('file') ?? value.get('photo');
  if (typeof File !== 'undefined' && item instanceof File && item.size > 0) return item;
  return null;
}

function dataUrl(bytes: Uint8Array, mime: ProfilePhotoMime): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function formFields(value: unknown): Record<string, unknown> {
  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    const fields: Record<string, unknown> = {};
    value.forEach((item, key) => {
      if (typeof item === 'string') fields[key] = item;
      else if (item instanceof File && item.size > 0 && key === 'file') fields.file = item;
    });
    return fields;
  }
  return (value ?? {}) as Record<string, unknown>;
}

async function route(method: string, path: string, query: ListQuery & Record<string, string>, body: Record<string, unknown>): Promise<unknown> {
  const id = path.split('/')[3] ?? '';

  if (method === 'POST' && path === '/auth/login') return login(body);
  if (method === 'POST' && path === '/auth/logout') {
    clearSession();
    return { signedOut: true };
  }
  if (method === 'GET' && path === '/auth/session') {
    const session = readActiveSession();
    return { authenticated: Boolean(session), mode: session?.mode ?? null, user: session?.user ?? null, provider: 'development-adapter' };
  }
  if (method === 'POST' && path === '/auth/password-reset/request') return requestReset(body);
  if (method === 'POST' && path === '/auth/password-reset/complete') return completeReset(body);
  if (method === 'POST' && path === '/auth/session/expire') {
    markSessionExpired();
    return { expired: true };
  }

  if (method === 'GET' && path === '/public/home') return getState().homepage;
  if (method === 'GET' && path === '/public/about') return getState().about;
  if (method === 'GET' && path === '/public/milestones') return getState().milestones;
  if (method === 'GET' && path === '/public/classes') return getState().lessons.filter(isPubliclyListable).map(toPublicLesson);
  if (method === 'GET' && path.startsWith('/public/classes/')) return publicOne(getState().lessons, path.split('/')[3] ?? '', toPublicLesson);
  if (method === 'GET' && path === '/public/trainees') return getState().trainees.filter(isPubliclyListable).map(toPublicTrainee);
  if (method === 'GET' && path.startsWith('/public/trainees/')) return publicOne(getState().trainees, path.split('/')[3] ?? '', toPublicTrainee);
  if (method === 'GET' && path === '/public/projects') return getState().projects.filter(isPubliclyListable).map(toPublicProject);
  if (method === 'GET' && path.startsWith('/public/projects/')) return publicOne(getState().projects, path.split('/')[3] ?? '', toPublicProject);
  if (method === 'GET' && path === '/public/events') return getState().events.filter(isPubliclyListable).map(toPublicEvent);
  if (method === 'GET' && path.startsWith('/public/events/')) return publicOne(getState().events, path.split('/')[3] ?? '', toPublicEvent);
  if (method === 'GET' && path === '/public/media') return getState().media.filter(isPubliclyListable);
  if (method === 'GET' && path === '/public/work-photos') return publicWorkPhotos(query);
  if (method === 'POST' && path === '/public/enquiries') return createEnquiry(body);
  if (isPublicTimetablePath(path)) {
    const timetable = await timetableRoute(method, path, query, body);
    if (timetable !== NOT_HANDLED) return timetable;
  }

  if (path.startsWith('/admin/')) requireUser('content.read');
  if (isAdminTimetablePath(path)) {
    if (method !== 'GET') requireUser('content.write');
    const timetable = await timetableRoute(method, path, query, body);
    if (timetable !== NOT_HANDLED) return timetable;
  }

  if (method === 'GET' && path === '/admin/search') return search(String(query.q ?? ''));
  if (method === 'GET' && path === '/admin/modules') {
    requireUser('content.read');
    return MODULES.map((module, index) => ({
      ...module,
      sortOrder: index + 1,
      publicationStatus: 'published' as const,
      listing: 'sample' as const,
      updatedAt: '2026-10-01T00:00:00.000Z',
    }));
  }
  if (method === 'GET' && path === '/admin/classes') return listLessons(query);
  if (method === 'GET' && /^\/admin\/classes\/[^/]+$/.test(path)) return adminOne(getState().lessons, id, 'Class not found.');
  if (method === 'POST' && path === '/admin/classes') return saveNew('content.write', () => updateState((s) => ({ ...s, lessons: [lessonBody(body as Partial<Lesson>), ...s.lessons] })).lessons[0]);
  if (method === 'PATCH' && path.startsWith('/admin/classes/') && !path.endsWith('/bulk')) return patchLesson(id, body);
  if (method === 'DELETE' && path.startsWith('/admin/classes/')) return remove('content.write', 'lessons', id);
  if (method === 'POST' && path === '/admin/classes/bulk') return bulk('lessons', body);

  if (method === 'GET' && path === '/admin/trainees') return listTrainees(query);
  if (method === 'GET' && /^\/admin\/trainees\/[^/]+$/.test(path)) return adminOne(getState().trainees, id, 'Trainee not found.');
  if (method === 'POST' && path === '/admin/trainees') return saveNew('content.write', () => updateState((s) => ({ ...s, trainees: [traineeBody(body), ...s.trainees] })).trainees[0]);
  if (method === 'PATCH' && path.startsWith('/admin/trainees/')) return patchTrainee(id, body);
  if (method === 'DELETE' && path.startsWith('/admin/trainees/')) return remove('content.write', 'trainees', id);
  if (method === 'POST' && path === '/admin/trainees/bulk') return bulk('trainees', body);

  if (method === 'GET' && path === '/admin/projects') return listProjects(query);
  if (method === 'GET' && /^\/admin\/projects\/[^/]+$/.test(path)) return adminOne(getState().projects, id, 'Project not found.');
  if (method === 'POST' && path === '/admin/projects') return saveNew('content.write', () => updateState((s) => ({ ...s, projects: [projectBody(body), ...s.projects] })).projects[0]);
  if (method === 'PATCH' && path.startsWith('/admin/projects/')) return patchProject(id, body);
  if (method === 'DELETE' && path.startsWith('/admin/projects/')) return remove('content.write', 'projects', id);
  if (method === 'POST' && path === '/admin/projects/bulk') return bulk('projects', body);

  if (method === 'GET' && path === '/admin/events') return listEvents(query);
  if (method === 'GET' && /^\/admin\/events\/[^/]+$/.test(path)) return adminOne(getState().events, id, 'Event not found.');
  if (method === 'POST' && path === '/admin/events') return saveNew('content.write', () => updateState((s) => ({ ...s, events: [eventBody(body), ...s.events] })).events[0]);
  if (method === 'PATCH' && path.startsWith('/admin/events/')) return patchEvent(id, body);
  if (method === 'DELETE' && path.startsWith('/admin/events/')) return remove('content.write', 'events', id);
  if (method === 'POST' && path === '/admin/events/bulk') return bulk('events', body);

  if (method === 'GET' && path === '/admin/media') return getState().media;
  if (method === 'POST' && path === '/admin/media') return addMedia(body);
  if (method === 'POST' && /^\/admin\/media\/[^/]+\/publish$/.test(path)) return publishMedia(id, body);
  if (method === 'POST' && /^\/admin\/media\/[^/]+\/withdraw-consent$/.test(path)) return withdrawMedia(id);
  if (method === 'PATCH' && path.startsWith('/admin/media/')) return patchMedia(id, body);
  if (method === 'DELETE' && path.startsWith('/admin/media/')) return remove('media.write', 'media', id);

  if (method === 'GET' && path === '/admin/work-photos') return listWorkPhotos(query);
  if (method === 'POST' && path === '/admin/work-photos') return addWorkPhoto(body);
  if (method === 'POST' && /^\/admin\/work-photos\/[^/]+\/publish$/.test(path)) return publishWorkPhoto(id);
  if (method === 'POST' && /^\/admin\/work-photos\/[^/]+\/unpublish$/.test(path)) return unpublishWorkPhoto(id);
  if (method === 'DELETE' && /^\/admin\/work-photos\/[^/]+$/.test(path)) return removeWorkPhoto(id);

  if (method === 'GET' && path === '/admin/milestones') return { milestones: getState().milestones, publicationStatus: getState().milestonePublicationStatus };
  if (method === 'PUT' && path === '/admin/milestones') return saveNew('content.write', () => updateState((s) => ({ ...s, milestones: Array.isArray(body.milestones) ? body.milestones as typeof s.milestones : s.milestones })).milestones);

  if (method === 'GET' && path === '/admin/about') return getState().about;
  if (method === 'PUT' && path === '/admin/about') return saveNew('content.write', () => updateState((s) => ({ ...s, about: { ...s.about, ...(body as unknown as typeof s.about) } })).about);
  if (method === 'GET' && path === '/admin/home') return getState().homepage;
  if (method === 'PUT' && path === '/admin/home') return saveNew('content.write', () => updateState((s) => ({ ...s, homepage: { ...s.homepage, ...(body as unknown as typeof s.homepage), publicationStatus: s.homepage.publicationStatus ?? 'draft' } })).homepage);
  if (method === 'POST' && path === '/admin/home/publish') return saveNew('content.write', () => updateState((s) => ({ ...s, homepage: { ...s.homepage, publicationStatus: 'published' } })).homepage);
  if (method === 'POST' && path === '/admin/home/unpublish') return saveNew('content.write', () => updateState((s) => ({ ...s, homepage: { ...s.homepage, publicationStatus: 'draft' } })).homepage);
  if (method === 'POST' && path === '/admin/about/publish') return saveNew('content.write', () => updateState((s) => ({ ...s, about: { ...s.about, publicationStatus: 'published' } })).about);
  if (method === 'POST' && path === '/admin/about/unpublish') return saveNew('content.write', () => updateState((s) => ({ ...s, about: { ...s.about, publicationStatus: 'draft' } })).about);
  if (method === 'POST' && path === '/admin/milestones/publish') return saveNew('content.write', () => { updateState((s) => ({ ...s, milestonePublicationStatus: 'published' })); return getState().milestones; });
  if (method === 'POST' && path === '/admin/milestones/unpublish') return saveNew('content.write', () => { updateState((s) => ({ ...s, milestonePublicationStatus: 'draft' })); return getState().milestones; });
  if (method === 'POST' && /^\/admin\/(classes|projects|events|trainees)\/[^/]+\/publish$/.test(path)) return publishRecord(path.split('/')[2] ?? '', id);

  if (method === 'GET' && path === '/admin/settings') {
    requireUser('settings.manage');
    return getState().settings;
  }
  if (method === 'PUT' && path === '/admin/settings') {
    requireUser('settings.manage');
    const contactEmail = String(body.contactEmail ?? getState().settings.contactEmail);
    const siteName = String(body.siteName ?? getState().settings.siteName);
    assertFields(collect({
      siteName: required(siteName, 'Enter a site name.'),
      contactEmail: emailAddress(contactEmail),
    }));
    return updateState((s) => ({ ...s, settings: { ...s.settings, ...(body as unknown as typeof s.settings), contactEmail: contactEmail.trim(), siteName: siteName.trim(), publicationStatus: s.settings.publicationStatus ?? 'draft' } })).settings;
  }
  if (method === 'POST' && path === '/admin/settings/publish') {
    requireUser('settings.manage');
    return updateState((s) => ({ ...s, settings: { ...s.settings, publicationStatus: 'published' } })).settings;
  }
  if (method === 'POST' && path === '/admin/settings/unpublish') {
    requireUser('settings.manage');
    return updateState((s) => ({ ...s, settings: { ...s.settings, publicationStatus: 'draft' } })).settings;
  }

  if (method === 'GET' && path === '/admin/users') {
    requireUser('users.read');
    return getState().users;
  }
  if (method === 'PATCH' && path.startsWith('/admin/users/')) return patchUser(id, body);
  if (method === 'POST' && path === '/admin/users/invite') return invite(body);
  if (method === 'GET' && path === '/admin/enquiries') {
    requireUser('users.manage');
    return getState().enquiries;
  }
  if (method === 'PATCH' && /^\/admin\/enquiries\/[^/]+$/.test(path)) return patchEnquiry(id, body);
  if (method === 'DELETE' && /^\/admin\/enquiries\/[^/]+$/.test(path)) return deleteEnquiry(id);

  if (method === 'GET' && path === '/admin/account') {
    const user = requireUser('account.manage');
    return user;
  }
  if (method === 'POST' && path === '/admin/account/password') {
    requireUser('account.manage');
    const next = String(body.next ?? '');
    const confirm = String(body.confirm ?? '');
    assertFields(collect({
      current: required(String(body.current ?? ''), 'Enter your current password.'),
      next: required(next, 'Choose a new password.') ?? minLength(next, 12, 'Use at least 12 characters.'),
      confirm: next === confirm ? null : 'The two passwords do not match.',
    }));
    fail('pending', 'Password changes need the production authentication provider, which is not connected. The password was not stored.', 501);
  }

  fail('pending', `No handler is implemented for ${method} ${path}. The API contract is pending a backend.`, 501);
}

function login(body: Record<string, unknown>) {
  const env = currentEnv();
  if (env.authMode !== 'development') {
    fail('unauthenticated', 'Production authentication is disabled until a verified backend is connected. This build will not create a session.', 401);
  }
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const ack = body.developmentAck === true;
  assertFields(collect({
    email: emailAddress(email),
    password: required(password, 'Enter your password.') ?? minLength(password, 8, 'Use at least 8 characters.'),
    developmentAck: ack ? null : 'Confirm that you understand this is the development adapter.',
  }));
  const locked = failures.get(email);
  if (locked && locked.lockedUntil > Date.now()) fail('rate_limited', 'Too many sign-in attempts. Wait a minute and try again.', 429);
  const user = getState().users.find((item) => item.email === email);
  if (!user) {
    const row = failures.get(email) ?? { count: 0, lockedUntil: 0 };
    row.count += 1;
    if (row.count >= 5) {
      row.lockedUntil = Date.now() + 60_000;
      row.count = 0;
    }
    failures.set(email, row);
    fail('unauthenticated', 'No development fixture matches that email. Try viewer@example.test, editor@example.test or administrator@example.test.', 401);
  }
  failures.delete(email);
  const session = {
    mode: 'development' as const,
    user: { id: user.id, email: user.email, displayName: user.displayName, initials: user.initials, hue: user.hue, role: user.role },
    expiresAt: Date.now() + env.sessionTtlMs,
  };
  setSession(session);
  return { user: session.user, mode: session.mode, expiresAt: session.expiresAt, provider: 'development-adapter' };
}

function requestReset(body: Record<string, unknown>) {
  if (currentEnv().authMode !== 'development') {
    fail('pending', 'Password reset is not available until production authentication is connected. No email was sent.', 501);
  }
  const email = String(body.email ?? '').trim().toLowerCase();
  assertFields(collect({ email: emailAddress(email) }));
  const user = getState().users.find((item) => item.email === email);
  const token = newId('reset');
  if (user) resetTickets.set(token, { userId: user.id, expiresAt: Date.now() + 15 * 60_000 });
  return {
    accepted: true,
    delivered: false,
    message: 'No email was sent. The development adapter does not have a mail provider.',
    developmentResetPath: user ? `/admin/reset-password?token=${token}` : null,
  };
}

function completeReset(body: Record<string, unknown>) {
  const token = String(body.token ?? '');
  const next = String(body.password ?? '');
  const confirm = String(body.confirm ?? '');
  const ticket = resetTickets.get(token);
  assertFields(collect({
    token: ticket && ticket.expiresAt > Date.now() ? null : 'This reset link is missing, used or expired.',
    password: required(next, 'Choose a new password.') ?? minLength(next, 8, 'Use at least 8 characters.'),
    confirm: next && next === confirm ? null : 'The two passwords do not match.',
  }));
  resetTickets.delete(token);
  return {
    completed: true,
    passwordStored: false,
    message: 'The development adapter accepted the form and discarded the password. No credential store exists.',
  };
}

function adminOne<T extends { id: string }>(rows: T[], itemId: string, message: string): T {
  const item = rows.find((row) => row.id === itemId);
  if (!item) fail('not_found', message, 404);
  return item;
}

function patchEnquiry(id: string, body: Record<string, unknown>) {
  requireUser('users.manage');
  const current = getState().enquiries.find((row) => row.id === id);
  if (!current) fail('not_found', 'Enquiry not found.', 404);
  const handled = body.handled === true;
  const next = { ...current, handled };
  updateState((s) => ({ ...s, enquiries: s.enquiries.map((row) => (row.id === id ? next : row)) }));
  return next;
}

function deleteEnquiry(id: string) {
  requireUser('users.manage');
  const current = getState().enquiries.find((row) => row.id === id);
  if (!current) fail('not_found', 'Enquiry not found.', 404);
  updateState((s) => ({ ...s, enquiries: s.enquiries.filter((row) => row.id !== id) }));
  return { deleted: true, id };
}

function publicOne<T extends { id: string; listing: 'hidden' | 'sample' | 'public'; publicationStatus: Lesson['publicationStatus'] }, R>(rows: T[], itemId: string, map: (item: T) => R): R {
  const item = rows.find((row) => row.id === itemId);
  if (!item || !isPubliclyListable(item)) fail('not_found', 'That page is not available.', 404);
  return map(item);
}

function createEnquiry(body: Record<string, unknown>) {
  const name = String(body.name ?? '');
  const email = String(body.email ?? '');
  const message = String(body.message ?? '');
  assertFields(collect({
    name: required(name, 'Enter your name.'),
    email: emailAddress(email),
    message: required(message, 'Write a short message.') ?? minLength(message, 20, 'Use at least 20 characters.'),
    consent: body.consent === true ? null : 'Tick to confirm you understand this message is not delivered.',
  }));
  const record = {
    id: newId('enquiry'),
    name: name.trim(),
    email: email.trim(),
    topic: String(body.topic ?? 'The 2026 bootcamp'),
    message: message.trim(),
    createdAt: new Date().toISOString(),
    handled: false,
    notified: false,
    delivered: false as const,
  };
  updateState((s) => ({ ...s, enquiries: [record, ...s.enquiries] }));
  return { id: record.id, delivered: false, message: 'Validated by the development adapter. Nothing was emailed or stored on a server.' };
}

function listLessons(query: ListQuery) {
  requireUser('content.read');
  let rows = getState().lessons.filter((lesson) => includesQuery(query.q ?? '', [lesson.title, lesson.moduleId, lesson.summary]));
  const filters = query.filters ?? {};
  if (filters.moduleId) rows = rows.filter((lesson) => lesson.moduleId === filters.moduleId);
  if (filters.scheduleStatus) rows = rows.filter((lesson) => lesson.scheduleStatus === filters.scheduleStatus);
  if (filters.publicationStatus) rows = rows.filter((lesson) => lesson.publicationStatus === filters.publicationStatus);
  rows = sortBy(rows, query.sort, query.dir, (lesson, key) => String(lesson[key as keyof Lesson] ?? ''));
  return pageOf(rows, query);
}

function listTrainees(query: ListQuery) {
  requireUser('content.read');
  let rows = getState().trainees.filter((trainee) => includesQuery(query.q ?? '', [trainee.displayName, trainee.track, trainee.skills.join(' ')]));
  const filters = query.filters ?? {};
  if (filters.track) rows = rows.filter((trainee) => trainee.track === filters.track);
  if (filters.focus) rows = rows.filter((trainee) => trainee.focus === filters.focus);
  rows = sortBy(rows, query.sort, query.dir, (trainee, key) => String(trainee[key as keyof Trainee] ?? ''));
  return pageOf(rows.map((trainee) => ({ ...trainee })), query);
}

function listProjects(query: ListQuery) {
  requireUser('content.read');
  let rows = getState().projects.filter((project) => includesQuery(query.q ?? '', [project.title, project.type]));
  if (query.filters?.type) rows = rows.filter((project) => project.type === query.filters?.type);
  rows = sortBy(rows, query.sort, query.dir, (project, key) => String(project[key as keyof Project] ?? ''));
  return pageOf(rows, query);
}

function listEvents(query: ListQuery) {
  requireUser('content.read');
  let rows = getState().events.filter((event) => includesQuery(query.q ?? '', [event.title, event.place]));
  const filters = query.filters ?? {};
  if (filters.kind) rows = rows.filter((event) => event.kind === filters.kind);
  if (filters.verification === 'verified') rows = rows.filter((event) => event.verified);
  if (filters.verification === 'tbc') rows = rows.filter((event) => event.dateTbc || Boolean(event.internalNotes && !event.verified && !event.sample));
  if (filters.verification === 'sample') rows = rows.filter((event) => event.sample);
  rows = sortBy(rows, query.sort, query.dir, (event, key) => String(event[key as keyof BootcampEvent] ?? ''));
  return pageOf(rows, query);
}

function saveNew<T>(permission: Permission, run: () => T): T {
  requireUser(permission);
  const value = run();
  if (value === undefined) fail('server', 'The development adapter could not save that record.', 500);
  return value;
}

function patchLesson(id: string, body: Record<string, unknown>) {
  requireUser('content.write');
  const current = getState().lessons.find((lesson) => lesson.id === id);
  if (!current) fail('not_found', 'Class not found.', 404);
  const next = lessonBody(body as Partial<Lesson>, current);
  updateState((s) => ({ ...s, lessons: s.lessons.map((lesson) => (lesson.id === id ? next : lesson)) }));
  return next;
}

function traineeBody(input: Record<string, unknown>, current?: Trainee): Trainee {
  const displayName = String(input.displayName ?? current?.displayName ?? '');
  const email = String(input.email ?? current?.email ?? '');
  assertFields(collect({
    displayName: required(displayName, 'Enter a display name.'),
    email: emailAddress(email),
    linkedin: linkValue(input.linkedin, current?.linkedin).error,
    portfolio: linkValue(input.portfolio, current?.portfolio).error,
  }));
  const consentReceived = Boolean(input.consentReceived ?? current?.consentReceived);
  const publicationStatus = (input.publicationStatus as Trainee['publicationStatus']) ?? current?.publicationStatus ?? 'draft';
  if (publicationStatus === 'published' && !consentReceived) {
    const consent = 'Consent is required before this profile can be published.';
    assertFields({ publicationStatus: consent, consentReceived: consent });
  }
  let listing = (input.listing as Trainee['listing']) ?? current?.listing ?? 'hidden';
  if (listing === 'public' && !consentReceived) listing = 'sample';
  return {
    id: current?.id ?? newId('trainee'),
    displayName: displayName.trim(),
    initials: String(input.initials ?? current?.initials ?? displayName.slice(0, 2).toUpperCase()),
    hue: Number(input.hue ?? current?.hue ?? 140),
    email: email.trim(),
    track: String(input.track ?? current?.track ?? 'Blue team'),
    focus: (input.focus as Trainee['focus']) ?? current?.focus ?? 'network',
    skills: (input.skills as string[]) ?? current?.skills ?? [],
    bio: String(input.bio ?? current?.bio ?? ''),
    quote: String(input.quote ?? current?.quote ?? ''),
    linkedin: linkValue(input.linkedin, current?.linkedin).stored,
    portfolio: linkValue(input.portfolio, current?.portfolio).stored,
    photoUrl: storedPhoto(input.photoUrl, current?.photoUrl ?? null),
    consentReceived,
    listing,
    publicationStatus,
    statusLabel: String(input.statusLabel ?? current?.statusLabel ?? 'In training'),
    lessonIds: idList(input.lessonIds, current?.lessonIds),
    internalNotes: String(input.internalNotes ?? current?.internalNotes ?? ''),
  };
}

function storedPhoto(value: unknown, current: string | null): string | null {
  if (value === undefined) return current;
  if (value === null) return null;
  if (typeof value !== 'string') {
    assertFields({ photoUrl: 'Use a JPEG, PNG, or WebP image.' });
    return current;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  const stored = displayPhotoUrl(trimmed);
  if (!stored) {
    assertFields({ photoUrl: 'Use a JPEG, PNG, or WebP image.' });
    return current;
  }
  return stored;
}

function patchTrainee(id: string, body: Record<string, unknown>) {
  requireUser('content.write');
  const current = getState().trainees.find((trainee) => trainee.id === id);
  if (!current) fail('not_found', 'Trainee not found.', 404);
  const next = traineeBody(body, current);
  updateState((s) => ({ ...s, trainees: s.trainees.map((trainee) => (trainee.id === id ? next : trainee)) }));
  return next;
}

function projectBody(input: Record<string, unknown>, current?: Project): Project {
  const title = String(input.title ?? current?.title ?? '');
  const abstract = String(input.abstract ?? current?.abstract ?? '');
  const type = String(input.type ?? current?.type ?? '');
  assertFields(collect({
    title: required(title, 'Give the project a title.') ?? minLength(title, 6, 'Use at least 6 characters.'),
    type: required(type, 'Choose a type.'),
    abstract: required(abstract, 'Write an abstract of at least 30 characters.') ?? minLength(abstract, 30, 'Use at least 30 characters.'),
    repositoryUrl: httpUrl(String(input.repositoryUrl ?? current?.repositoryUrl ?? '')),
    demoUrl: httpUrl(String(input.demoUrl ?? current?.demoUrl ?? '')),
  }));
  const publicationStatus = (input.publicationStatus as Project['publicationStatus']) ?? current?.publicationStatus ?? 'draft';
  return {
    id: current?.id ?? newId('project'),
    title: title.trim(),
    slug: slugify(title),
    type,
    moduleId: (input.moduleId as Project['moduleId']) ?? current?.moduleId ?? 'network',
    cover: String(input.cover ?? current?.cover ?? 'terminal'),
    image: String(input.image ?? current?.image ?? 'electronics-lab'),
    abstract: abstract.trim(),
    tools: String(input.tools ?? current?.tools ?? ''),
    steps: (input.steps as string[]) ?? current?.steps ?? [],
    team: (input.team as string[]) ?? current?.team ?? [],
    traineeIds: idList(input.traineeIds, current?.traineeIds),
    lessonIds: idList(input.lessonIds, current?.lessonIds),
    repositoryUrl: String(input.repositoryUrl ?? current?.repositoryUrl ?? ''),
    demoUrl: String(input.demoUrl ?? current?.demoUrl ?? ''),
    labOnlyConfirmed: Boolean(input.labOnlyConfirmed ?? current?.labOnlyConfirmed),
    shareAgreed: Boolean(input.shareAgreed ?? current?.shareAgreed),
    publicationStatus,
    listing: (input.listing as Project['listing']) ?? current?.listing ?? (publicationStatus === 'published' ? 'sample' : 'hidden'),
    internalNotes: String(input.internalNotes ?? current?.internalNotes ?? ''),
  };
}

function patchProject(id: string, body: Record<string, unknown>) {
  requireUser('content.write');
  const current = getState().projects.find((project) => project.id === id);
  if (!current) fail('not_found', 'Project not found.', 404);
  const next = projectBody(body, current);
  updateState((s) => ({ ...s, projects: s.projects.map((project) => (project.id === id ? next : project)) }));
  return next;
}

function eventBody(input: Record<string, unknown>, current?: BootcampEvent): BootcampEvent {
  const title = String(input.title ?? current?.title ?? '');
  const place = String(input.place ?? current?.place ?? '');
  const summary = String(input.summary ?? current?.summary ?? '');
  const verified = Boolean(input.verified ?? current?.verified);
  const sourceUrl = String(input.sourceUrl ?? current?.sourceUrl ?? '');
  const dateTbc = Boolean(input.dateTbc ?? current?.dateTbc);
  const startTime = String(input.startTime ?? current?.startTime ?? '');
  const endTime = String(input.endTime ?? current?.endTime ?? '');
  assertFields(collect({
    title: required(title, 'Give the event a name.'),
    place: required(place, 'Enter a venue, or “Venue to be confirmed”.'),
    summary: required(summary, 'Write a summary of at least 20 characters.') ?? minLength(summary, 20),
    sourceUrl: verified && !sourceUrl.trim() ? 'Enter a full link starting with https://' : httpsLink(sourceUrl, 'Enter a full link starting with https://'),
    startTime: dateTbc && (startTime.trim() || endTime.trim()) ? 'Leave the times blank while the date is to be confirmed.' : null,
    date: !dateTbc && !String(input.date ?? current?.date ?? '').trim() ? 'Pick a date.' : null,
  }));
  return {
    id: current?.id ?? newId('event'),
    title: title.trim(),
    date: String(input.date ?? current?.date ?? '2026-10-24'),
    dateTbc,
    whenLabel: String(input.whenLabel ?? current?.whenLabel ?? ''),
    place: place.trim(),
    kind: (input.kind as BootcampEvent['kind']) ?? current?.kind ?? 'Milestone',
    verified,
    sample: Boolean(input.sample ?? current?.sample ?? !verified),
    summary: summary.trim(),
    body: (input.body as BootcampEvent['body']) ?? current?.body ?? { kind: 'placeholder', text: summary },
    source: String(input.source ?? current?.source ?? ''),
    sourceUrl,
    image: String(input.image ?? current?.image ?? 'guests-seated'),
    showOnAnniversary: Boolean(input.showOnAnniversary ?? current?.showOnAnniversary),
    calendarDownload: Boolean(input.calendarDownload ?? current?.calendarDownload),
    startTime: dateTbc ? '' : startTime,
    endTime: dateTbc ? '' : endTime,
    lessonIds: idList(input.lessonIds, current?.lessonIds),
    projectIds: idList(input.projectIds, current?.projectIds),
    mediaIds: idList(input.mediaIds, current?.mediaIds),
    publicationStatus: (input.publicationStatus as BootcampEvent['publicationStatus']) ?? current?.publicationStatus ?? 'draft',
    listing: (input.listing as BootcampEvent['listing']) ?? current?.listing ?? 'sample',
    internalNotes: String(input.internalNotes ?? current?.internalNotes ?? ''),
  };
}

function patchEvent(id: string, body: Record<string, unknown>) {
  requireUser('content.write');
  const current = getState().events.find((event) => event.id === id);
  if (!current) fail('not_found', 'Event not found.', 404);
  const next = eventBody(body, current);
  updateState((s) => ({ ...s, events: s.events.map((event) => (event.id === id ? next : event)) }));
  return next;
}

function addMedia(body: Record<string, unknown>): MediaItem {
  const actor = requireAny(['media.upload']);
  const alt = String(body.alt ?? '').trim();
  assertFields(collect({ alt: required(alt, 'Describe the image without naming anyone.') }));
  const item: MediaItem = {
    id: newId('media'),
    file: String(body.file ?? 'upload'),
    src: String(body.src ?? ''),
    width: Number(body.width ?? 1600),
    height: Number(body.height ?? 1066),
    caption: String(body.caption ?? alt),
    alt,
    album: (body.album as MediaItem['album']) ?? 'community',
    consent: 'pending',
    publicationStatus: 'draft',
    listing: 'hidden',
    uploadedBy: actor.id,
  };
  updateState((s) => ({ ...s, media: [item, ...s.media] }));
  return item;
}

function idList(value: unknown, fallback: string[] | undefined): string[] {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  return fallback ?? [];
}

function httpsLink(value: string, message: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https:\/\/\S+\.\S+/.test(trimmed) ? null : message;
}

function linkValue(value: unknown, fallback: string | null | undefined): { stored: string | null; error: string | null } {
  const raw = value === undefined ? (fallback ?? '') : value === null ? '' : String(value);
  const trimmed = raw.trim();
  if (!trimmed) return { stored: null, error: null };
  return { stored: trimmed, error: httpUrl(trimmed, false) };
}

function patchMedia(id: string, body: Record<string, unknown>) {
  requireUser('media.write');
  const current = getState().media.find((item) => item.id === id);
  if (!current) fail('not_found', 'Image not found.', 404);
  const alt = String(body.alt ?? current.alt).trim();
  assertFields(collect({ alt: required(alt, 'Describe the image without naming anyone.') }));
  if (body.consent === 'verified' && body.publicationStatus === 'published' && current.consent !== 'verified') {
    fail('validation', 'Verifying consent does not publish the photo.', 422, { publicationStatus: 'Verifying consent does not publish the photo.' });
  }
  const consent = body.consent === 'verified' ? 'verified' : body.consent === 'pending' ? 'pending' : current.consent;
  const publicationStatus = (body.publicationStatus as MediaItem['publicationStatus']) ?? current.publicationStatus;
  if (publicationStatus === 'published' && consent !== 'verified') {
    fail('validation', 'Verify consent before this photo can be published.', 422, { publicationStatus: 'Verify consent before this photo can be published.' });
  }
  const next: MediaItem = {
    ...current,
    alt,
    caption: String(body.caption ?? alt),
    album: (body.album as MediaItem['album']) ?? current.album,
    consent,
    listing: (body.listing as MediaItem['listing']) ?? current.listing,
    publicationStatus,
    src: String(body.src ?? current.src),
  };
  updateState((s) => ({ ...s, media: s.media.map((item) => (item.id === id ? next : item)) }));
  return next;
}

function publishMedia(id: string, body: Record<string, unknown>) {
  const actor = requireUser('media.write');
  const current = getState().media.find((item) => item.id === id);
  if (!current) fail('not_found', 'Image not found.', 404);
  if (body.confirmConsent === true && actor.role !== 'administrator') {
    fail('forbidden', 'An administrator confirms consent and publishes in one step.', 403);
  }
  if (current.consent === 'withdrawn') {
    fail('validation', 'Consent was withdrawn. This photo cannot be published.', 422, { consent: 'Consent was withdrawn. This photo cannot be published.' });
  }
  const next: MediaItem = { ...current };
  if (body.confirmConsent === true) next.consent = 'verified';
  if (next.consent !== 'verified') fail('validation', 'Verify consent before this photo can be published.', 422);
  if (typeof body.listing === 'string') next.listing = body.listing as MediaItem['listing'];
  next.publicationStatus = 'published';
  updateState((s) => ({ ...s, media: s.media.map((item) => (item.id === id ? next : item)) }));
  return next;
}

function withdrawMedia(id: string) {
  requireUser('media.write');
  const current = getState().media.find((item) => item.id === id);
  if (!current) fail('not_found', 'Image not found.', 404);
  const next: MediaItem = { ...current, consent: 'withdrawn', publicationStatus: 'draft', listing: 'hidden', src: '' };
  updateState((s) => ({ ...s, media: s.media.map((item) => (item.id === id ? next : item)) }));
  return next;
}

function publishRecord(kind: string, id: string) {
  requireUser('content.write');
  const key = kind === 'projects' ? 'projects' : kind === 'events' ? 'events' : kind === 'trainees' ? 'trainees' : kind === 'classes' ? 'lessons' : '';
  if (!key) fail('not_found', 'Record not found.', 404);
  const rows = getState()[key];
  const current = rows.find((row) => row.id === id);
  if (!current) fail('not_found', 'Record not found.', 404);
  if (key === 'trainees' && !('consentReceived' in current && current.consentReceived)) {
    const consent = 'Consent is required before this profile can be published.';
    fail('validation', consent, 422, { publicationStatus: consent, consentReceived: consent });
  }
  const next = { ...current, publicationStatus: 'published' as const };
  updateState((s) => ({ ...s, [key]: s[key].map((row) => (row.id === id ? next : row)) }));
  return next;
}

function remove(permission: Permission, key: 'lessons' | 'trainees' | 'projects' | 'events' | 'media', id: string) {
  requireUser(permission);
  const rows = getState()[key] as Array<{ id: string }>;
  if (!rows.some((row) => row.id === id)) fail('not_found', 'Record not found.', 404);
  updateState((s) => ({ ...s, [key]: (s[key] as Array<{ id: string }>).filter((row) => row.id !== id) }));
  return { deleted: true, id };
}

function bulk(key: 'lessons' | 'trainees' | 'projects' | 'events', body: Record<string, unknown>) {
  requireUser('content.write');
  const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
  if (!ids.length) fail('validation', 'Select at least one row.', 422);
  const action = String(body.action ?? '');
  updateState((s) => {
    const rows = s[key].map((row) => {
      if (!ids.includes(row.id)) return row;
      if (action === 'publish') return { ...row, publicationStatus: 'published' as const, listing: row.listing === 'hidden' ? 'sample' as const : row.listing };
      return row;
    }).filter((row) => action !== 'delete' || !ids.includes(row.id));
    return { ...s, [key]: rows };
  });
  return { ok: true, action, count: ids.length };
}

function patchUser(id: string, body: Record<string, unknown>) {
  const actor = requireUser('users.manage');
  const role = String(body.role ?? '') as Role;
  if (!['trainee', 'trainer', 'viewer', 'editor', 'administrator'].includes(role)) fail('validation', 'Choose a valid role.', 422, { role: 'Choose viewer, editor, trainer, trainee, or administrator.' });
  if (actor.id === id && role !== 'administrator') {
    fail('validation', 'You cannot remove your own administrator access from this session.', 422, { role: 'Ask another administrator to change your role.' });
  }
  const current = getState().users.find((user) => user.id === id);
  if (!current) fail('not_found', 'User not found.', 404);
  const next = { ...current, role };
  updateState((s) => ({ ...s, users: s.users.map((user) => (user.id === id ? next : user)) }));
  const session = readActiveSession();
  if (session?.user.id === id) setSession({ ...session, user: { ...session.user, role } });
  return next;
}

function invite(body: Record<string, unknown>) {
  requireUser('users.manage');
  const email = String(body.email ?? '');
  assertFields(collect({ email: emailAddress(email) }));
  return { invited: false, delivered: false, message: 'No invitation was sent. User provisioning is pending a backend.' };
}

function publicWorkPhotos(query: ListQuery & Record<string, string>) {
  return getState().workPhotos
    .filter((photo) => photo.publicationStatus === 'published' && photo.listing !== 'hidden')
    .filter((photo) => !query.traineeId || photo.traineeId === query.traineeId)
    .filter((photo) => !query.projectId || photo.projectId === query.projectId)
    .map(toPublicWorkPhoto);
}

function listWorkPhotos(query: ListQuery & Record<string, string>) {
  requireAdministrator();
  return getState().workPhotos.filter((photo) => {
    if (query.traineeId && photo.traineeId !== query.traineeId) return false;
    if (query.projectId && photo.projectId !== query.projectId) return false;
    return true;
  });
}

async function addWorkPhoto(body: Record<string, unknown>): Promise<WorkPhoto> {
  const actor = requireAdministrator();
  const traineeId = String(body.traineeId ?? '').trim();
  const projectId = String(body.projectId ?? '').trim();
  const alt = String(body.alt ?? '');
  const caption = String(body.caption ?? '');
  const file = body.file instanceof File ? body.file : undefined;
  const problems = workPhotoFieldErrors({ traineeId, alt, caption, fileCount: file ? 1 : 0 });
  const trainee = getState().trainees.find((item) => item.id === traineeId);
  if (!problems.traineeId && !trainee) problems.traineeId = 'Choose a trainee.';
  if (projectId) {
    const project = getState().projects.find((item) => item.id === projectId);
    const linked = project?.traineeIds ?? [];
    if (!project) problems.projectId = 'Choose a project.';
    else if (linked.length > 0 && !linked.includes(traineeId)) problems.projectId = 'Choose a project this trainee is on.';
  }
  if (file) {
    const fileProblem = workPhotoFileError(file);
    if (fileProblem) problems.file = fileProblem;
  }
  assertFields(problems);
  if (!file) fail('validation', 'Check the highlighted fields.', 422, { file: 'Choose an image.' });
  let stored: { src: string; width: number; height: number };
  try {
    stored = await readWorkPhotoDataUrl(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Use a JPEG, PNG, or WebP image.';
    fail('validation', 'Check the highlighted fields.', 422, { file: message });
  }
  const item: WorkPhoto = {
    id: newId('work'),
    traineeId,
    projectId: projectId || null,
    src: stored.src,
    width: stored.width,
    height: stored.height,
    alt: alt.trim(),
    caption: caption.trim() || alt.trim(),
    publicationStatus: 'draft',
    listing: 'hidden',
    storageProvider: 'memory',
    uploadedBy: actor.id,
    updatedAt: new Date().toISOString(),
  };
  updateState((s) => ({ ...s, workPhotos: [item, ...s.workPhotos] }));
  return item;
}

function publishWorkPhoto(id: string): WorkPhoto {
  requireAdministrator();
  const current = getState().workPhotos.find((photo) => photo.id === id);
  if (!current) fail('not_found', 'Image not found.', 404);
  const next: WorkPhoto = {
    ...current,
    publicationStatus: 'published',
    listing: current.listing === 'hidden' ? 'public' : current.listing,
  };
  updateState((s) => ({ ...s, workPhotos: s.workPhotos.map((photo) => (photo.id === id ? next : photo)) }));
  return next;
}

function unpublishWorkPhoto(id: string): WorkPhoto {
  requireAdministrator();
  const current = getState().workPhotos.find((photo) => photo.id === id);
  if (!current) fail('not_found', 'Image not found.', 404);
  const next: WorkPhoto = { ...current, publicationStatus: 'draft' };
  updateState((s) => ({ ...s, workPhotos: s.workPhotos.map((photo) => (photo.id === id ? next : photo)) }));
  return next;
}

function removeWorkPhoto(id: string) {
  requireAdministrator();
  if (!getState().workPhotos.some((photo) => photo.id === id)) fail('not_found', 'Record not found.', 404);
  updateState((s) => ({ ...s, workPhotos: s.workPhotos.filter((photo) => photo.id !== id) }));
  return { deleted: true, id };
}

function toPublicWorkPhoto(photo: WorkPhoto) {
  return {
    id: photo.id,
    traineeId: photo.traineeId,
    projectId: photo.projectId,
    src: photo.src,
    width: photo.width,
    height: photo.height,
    alt: photo.alt,
    caption: photo.caption,
  };
}

function requireAdministrator() {
  const user = requireUser('content.read');
  if (user.role !== 'administrator') fail('forbidden', 'You do not have access to that.', 403);
  return user;
}

function search(q: string): SearchHit[] {
  requireUser('content.read');
  const hits: SearchHit[] = [];
  for (const lesson of getState().lessons) if (includesQuery(q, [lesson.title])) hits.push({ type: 'Class', id: lesson.id, title: lesson.title, href: `/admin/classes/${lesson.id}` });
  for (const trainee of getState().trainees) if (includesQuery(q, [trainee.displayName])) hits.push({ type: 'Trainee', id: trainee.id, title: trainee.displayName, href: `/admin/trainees/${trainee.id}` });
  for (const project of getState().projects) if (includesQuery(q, [project.title])) hits.push({ type: 'Project', id: project.id, title: project.title, href: `/admin/projects/${project.id}` });
  for (const event of getState().events) if (includesQuery(q, [event.title])) hits.push({ type: 'Event', id: event.id, title: event.title, href: `/admin/events/${event.id}` });
  return hits.slice(0, 8);
}

export function localPreviewUrl(file: string): string {
  return mediaSrc(file, 800);
}
