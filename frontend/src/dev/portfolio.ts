import { ApiError } from '@/domain/types';
import type { Trainee } from '@/domain/types';
import { can } from '@/domain/permissions';
import { newId } from '@/domain/format';
import { displayPhotoUrl, profilePhotoFileProblem, readFileBytes, sniffedPhotoMime } from '@/domain/photo';
import {
  KIND_LABEL,
  parseVideoLink,
  type PortfolioContent,
  type PortfolioFields,
  type PortfolioItem,
  type PortfolioKind,
  type PortfolioMedia,
  type PublicPortfolioItem,
  isPortfolioKind,
} from '@/domain/portfolio';
import { getState } from './store';
import { clearSession, readActiveSession } from './session';

const VIDEO_MAX = 50 * 1024 * 1024;
const items = new Map<string, DevItem>();

interface DevItem {
  id: string;
  traineeId: string;
  sortOrder: number;
  status: PortfolioItem['status'];
  rejectionReason: string;
  submittedAt: string | null;
  hasPending: boolean;
  live: PortfolioFields;
  pending: PortfolioFields | null;
  liveMedia: PortfolioMedia[];
  pendingMedia: PortfolioMedia[] | null;
}

export function portfolioOwned(traineeId: string, id: string): boolean {
  const row = items.get(id);
  return Boolean(row && row.traineeId === traineeId);
}

/** Approved title only. A draft title is not evidence on the public profile. */
export function portfolioEvidence(traineeId: string, id: string): { id: string; title: string; kind: string } | null {
  const row = items.get(id);
  if (!row || row.traineeId !== traineeId || !row.live.title.trim()) return null;
  return { id: row.id, title: row.live.title, kind: row.live.kind };
}

export function resetPortfolioDev(): void {
  items.clear();
}

export async function portfolioRoute(method: string, path: string, raw: unknown): Promise<unknown | undefined> {
  const publicItem = /^\/public\/trainees\/([^/]+)\/portfolio$/.exec(path);
  if (publicItem && method === 'GET') return publicList(decodeURIComponent(publicItem[1] ?? ''));
  if (path === '/admin/review-queue/items' && method === 'GET') return listQueue();
  const review = /^\/admin\/review-queue\/items\/([^/]+)(?:\/(approve|reject))?$/.exec(path);
  if (review) {
    const id = decodeURIComponent(review[1] ?? '');
    const action = review[2];
    if (method === 'PATCH' && !action) return editPending(id, record(raw));
    if (method === 'POST' && action === 'approve') return approve(id);
    if (method === 'POST' && action === 'reject') return reject(id, record(raw));
    if (method === 'DELETE' && !action) return removeByAdmin(id);
    return undefined;
  }
  if (!path.startsWith('/portal/portfolio')) return undefined;
  if (path === '/portal/portfolio' && method === 'GET') return listOwn();
  if (path === '/portal/portfolio' && method === 'POST') return createOwn(record(raw));
  if (path === '/portal/portfolio/reorder' && method === 'POST') return reorder(record(raw));
  const item = /^\/portal\/portfolio\/([^/]+)(?:\/(submit|images|videos|media))?(?:\/(grant|file|complete|reorder|[^/]+))?$/.exec(path);
  if (!item) return undefined;
  const id = decodeURIComponent(item[1] ?? '');
  const section = item[2];
  const extra = item[3];
  if (!section && method === 'GET') return getOwn(id);
  if (!section && method === 'PATCH') return updateOwn(id, record(raw));
  if (!section && method === 'DELETE') return removeOwn(id);
  if (section === 'submit' && method === 'POST') return submit(id);
  if (section === 'images' && method === 'POST') return addImage(id, raw);
  if (section === 'images' && method === 'DELETE' && extra) return removeMedia(id, extra, 'image');
  if (section === 'videos' && method === 'POST' && !extra) return addLink(id, record(raw));
  if (section === 'videos' && extra === 'grant' && method === 'POST') return grant(id, record(raw));
  if (section === 'videos' && extra === 'file' && method === 'POST') return addFile(id, raw);
  if (section === 'videos' && extra === 'complete' && method === 'POST') return fail('validation', 'Start the upload again.', 422, { video: 'Start the upload again.' });
  if (section === 'videos' && method === 'DELETE' && extra) return removeMedia(id, extra, 'video');
  if (section === 'media' && extra === 'reorder' && method === 'POST') return reorderMedia(id, record(raw));
  return undefined;
}

function listOwn(): PortfolioItem[] {
  const trainee = ownTrainee();
  return [...items.values()].filter((item) => item.traineeId === trainee.id).sort(byOrder).map(present);
}

function getOwn(id: string): PortfolioItem {
  return present(ownItem(id));
}

function createOwn(body: Record<string, unknown>): PortfolioItem {
  const trainee = requireWrite();
  const fields = readFields(body, emptyFields('project'), true);
  const mine = [...items.values()].filter((item) => item.traineeId === trainee.id);
  if (mine.length >= 30) fail('validation', 'You can keep at most 30 portfolio items.', 422);
  const row: DevItem = {
    id: newId('item'),
    traineeId: trainee.id,
    sortOrder: mine.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1,
    status: 'draft',
    rejectionReason: '',
    submittedAt: null,
    hasPending: true,
    live: emptyFields(fields.kind),
    pending: fields,
    liveMedia: [],
    pendingMedia: [],
  };
  items.set(row.id, row);
  return present(row);
}

function updateOwn(id: string, body: Record<string, unknown>): PortfolioItem {
  const row = ownItem(id);
  ensurePending(row);
  row.pending = readFields(body, row.pending ?? row.live, false);
  if (row.status !== 'pending') row.status = 'draft';
  return present(row);
}

function removeOwn(id: string): { id: string } {
  const row = ownItem(id);
  items.delete(row.id);
  return { id: row.id };
}

function reorder(body: Record<string, unknown>): PortfolioItem[] {
  const trainee = requireWrite();
  const mine = [...items.values()].filter((item) => item.traineeId === trainee.id).sort(byOrder);
  const ids = readIds(body);
  if (!ids || !same(ids, mine.map((item) => item.id))) fail('validation', 'Check the highlighted fields.', 422, { ids: 'Include every portfolio item once.' });
  ids.forEach((id, index) => {
    const row = items.get(id);
    if (row) row.sortOrder = index;
  });
  return listOwn();
}

async function addImage(id: string, raw: unknown): Promise<PortfolioItem> {
  const row = ownItem(id);
  const file = formFile(raw);
  const alt = record(raw).alt;
  const caption = typeof alt === 'string' ? alt.trim() : '';
  if (!caption) fail('validation', 'Check the highlighted fields.', 422, { image: 'Describe the picture.' });
  if (!file) fail('validation', 'Check the highlighted fields.', 422, { image: 'Choose an image.' });
  const size = profilePhotoFileProblem(file);
  if (size) fail('validation', 'Check the highlighted fields.', 422, { image: size });
  const bytes = await readFileBytes(file);
  const mime = sniffedPhotoMime(bytes);
  if (!mime) fail('validation', 'Check the highlighted fields.', 422, { image: 'Use a JPEG, PNG, or WebP image.' });
  ensurePending(row);
  const pending = row.pendingMedia ?? [];
  if (pending.filter((item) => item.kind === 'image').length >= 8) fail('validation', 'Check the highlighted fields.', 422, { image: 'You can add at most 8 pictures.' });
  pending.push({
    id: newId('media'),
    kind: 'image',
    alt: caption,
    url: dataUrl(bytes, mime),
    provider: null,
    externalId: null,
    sortOrder: pending.length,
  });
  row.pendingMedia = pending;
  if (row.status !== 'pending') row.status = 'draft';
  return present(row);
}

function addLink(id: string, body: Record<string, unknown>): PortfolioItem {
  const row = ownItem(id);
  const parsed = parseVideoLink(typeof body.url === 'string' ? body.url : '');
  if (!parsed) fail('validation', 'Check the highlighted fields.', 422, { video: 'Use a YouTube, Vimeo, or Loom link.' });
  ensurePending(row);
  const pending = row.pendingMedia ?? [];
  if (pending.filter((item) => item.kind !== 'image').length >= 3) fail('validation', 'Check the highlighted fields.', 422, { video: 'You can add at most 3 videos.' });
  pending.push({
    id: newId('media'),
    kind: 'video_link',
    alt: '',
    url: null,
    provider: parsed.provider,
    externalId: parsed.externalId,
    sortOrder: pending.length,
  });
  row.pendingMedia = pending;
  if (row.status !== 'pending') row.status = 'draft';
  return present(row);
}

function grant(id: string, body: Record<string, unknown>): { grantId: string; mode: 'api'; expiresAt: string; maxBytes: number } {
  ownItem(id);
  const mime = typeof body.mime === 'string' ? body.mime : '';
  const bytes = typeof body.bytes === 'number' ? body.bytes : 0;
  if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(mime)) {
    fail('validation', 'Check the highlighted fields.', 422, { video: 'Use an MP4, WebM, or MOV video.' });
  }
  if (!Number.isInteger(bytes) || bytes < 1) fail('validation', 'Check the highlighted fields.', 422, { video: 'Choose a video file.' });
  if (bytes > VIDEO_MAX) fail('validation', 'Check the highlighted fields.', 422, { video: 'Use a video of at most 50 MB.' });
  return { grantId: newId('grant'), mode: 'api', expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), maxBytes: VIDEO_MAX };
}

async function addFile(id: string, raw: unknown): Promise<PortfolioItem> {
  const row = ownItem(id);
  const file = formFile(raw);
  if (!file) fail('validation', 'Check the highlighted fields.', 422, { video: 'Choose a video file.' });
  if (file.size > VIDEO_MAX) fail('validation', 'Check the highlighted fields.', 422, { video: 'Use a video of at most 50 MB.' });
  const bytes = await readFileBytes(file);
  const mime = sniffVideo(bytes);
  if (!mime) fail('validation', 'Check the highlighted fields.', 422, { video: 'Use an MP4, WebM, or MOV video.' });
  ensurePending(row);
  const pending = row.pendingMedia ?? [];
  if (pending.filter((item) => item.kind !== 'image').length >= 3) fail('validation', 'Check the highlighted fields.', 422, { video: 'You can add at most 3 videos.' });
  pending.push({
    id: newId('media'),
    kind: 'video_file',
    alt: '',
    url: dataUrl(bytes, mime),
    provider: 'upload',
    externalId: null,
    sortOrder: pending.length,
  });
  row.pendingMedia = pending;
  if (row.status !== 'pending') row.status = 'draft';
  return present(row);
}

function removeMedia(id: string, mediaId: string, kind: 'image' | 'video'): PortfolioItem {
  const row = ownItem(id);
  ensurePending(row);
  const pending = row.pendingMedia ?? [];
  const index = pending.findIndex((item) => item.id === mediaId && (kind === 'image' ? item.kind === 'image' : item.kind !== 'image'));
  if (index < 0) fail('not_found', 'That portfolio item is not available.', 404);
  pending.splice(index, 1);
  row.pendingMedia = pending;
  if (row.status !== 'pending') row.status = 'draft';
  return present(row);
}

function reorderMedia(id: string, body: Record<string, unknown>): PortfolioItem {
  const row = ownItem(id);
  ensurePending(row);
  const pending = row.pendingMedia ?? [];
  const ids = readIds(body);
  if (!ids || !same(ids, pending.map((item) => item.id))) fail('validation', 'Check the highlighted fields.', 422, { ids: 'Include every picture and video once.' });
  row.pendingMedia = ids.flatMap((mediaId, index) => {
    const media = pending.find((item) => item.id === mediaId);
    return media ? [{ ...media, sortOrder: index }] : [];
  });
  if (row.status !== 'pending') row.status = 'draft';
  return present(row);
}

function submit(id: string): PortfolioItem {
  const trainee = requireWrite();
  const row = ownItem(id);
  if (!row.hasPending) ensurePending(row);
  if (!trainee.consentReceived) fail('validation', 'Agree to a public profile before you submit this for review.', 422);
  if (row.status === 'pending') fail('validation', 'This item is already waiting for review.', 422);
  if (row.status === 'approved') fail('validation', 'Change the item before you submit it again.', 422);
  row.status = 'pending';
  row.rejectionReason = '';
  row.submittedAt = new Date().toISOString();
  return present(row);
}

function listQueue(): unknown[] {
  requireStaff(false);
  return [...items.values()].filter((item) => item.status === 'pending' && item.hasPending).map((item) => reviewItem(item));
}

function editPending(id: string, body: Record<string, unknown>): unknown {
  requireStaff(true);
  const row = pendingItem(id);
  row.pending = readFields(body, row.pending ?? row.live, false);
  return reviewItem(row);
}

function approve(id: string): unknown {
  requireStaff(true);
  const row = pendingItem(id);
  row.live = { ...(row.pending ?? row.live) };
  row.liveMedia = [...(row.pendingMedia ?? [])];
  row.pending = null;
  row.pendingMedia = null;
  row.hasPending = false;
  row.status = 'approved';
  row.rejectionReason = '';
  return reviewItem(row);
}

function reject(id: string, body: Record<string, unknown>): unknown {
  requireStaff(true);
  const row = pendingItem(id);
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) fail('validation', 'Enter a reason the trainee can read.', 422, { reason: 'Enter a reason the trainee can read.' });
  row.status = 'rejected';
  row.rejectionReason = reason;
  return reviewItem(row);
}

function removeByAdmin(id: string): { id: string } {
  requireStaff(true);
  if (!items.has(id)) fail('not_found', 'That portfolio item is not available.', 404);
  items.delete(id);
  return { id };
}

function publicList(traineeId: string): PublicPortfolioItem[] {
  const trainee = getState().trainees.find((item) => item.id === traineeId);
  if (!trainee || trainee.listing === 'hidden') fail('not_found', 'That page is not available.', 404);
  if (trainee.listing !== 'sample' && (trainee.publicationStatus !== 'published' || !trainee.consentReceived)) {
    fail('not_found', 'That page is not available.', 404);
  }
  const showMedia = trainee.photoConsent === true && trainee.consentReceived;
  return [...items.values()]
    .filter((item) => item.traineeId === trainee.id && item.live.title.trim())
    .sort(byOrder)
    .map((item) => ({ ...item.live, id: item.id, media: showMedia ? item.liveMedia : [] }));
}

function present(row: DevItem): PortfolioItem {
  const draftMedia = row.hasPending ? row.pendingMedia ?? [] : row.liveMedia;
  return {
    id: row.id,
    sortOrder: row.sortOrder,
    status: row.status,
    rejectionReason: row.rejectionReason,
    submittedAt: row.submittedAt,
    draft: { ...(row.pending ?? row.live), media: draftMedia },
    live: { ...row.live, media: row.liveMedia },
  };
}

function reviewItem(row: DevItem): unknown {
  const trainee = fresh(row.traineeId);
  const view = present(row);
  return {
    id: row.id,
    traineeId: trainee.id,
    email: trainee.email,
    traineeName: trainee.displayName,
    status: row.status,
    submittedAt: row.submittedAt,
    draft: view.draft,
    live: view.live,
    consents: { publicProfile: trainee.consentReceived, publicPhoto: trainee.photoConsent === true },
  };
}

function ensurePending(row: DevItem): void {
  if (row.hasPending) return;
  row.pending = { ...row.live, skills: [...row.live.skills] };
  row.pendingMedia = row.liveMedia.map((media) => ({ ...media, id: newId('media') }));
  row.hasPending = true;
}

function ownItem(id: string): DevItem {
  const trainee = requireWrite();
  const row = items.get(id);
  if (!row || row.traineeId !== trainee.id) fail('not_found', 'That portfolio item is not available.', 404);
  return row;
}

function pendingItem(id: string): DevItem {
  const row = items.get(id);
  if (!row || row.status !== 'pending' || !row.hasPending) fail('not_found', 'That item is not waiting for review.', 404);
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

function readFields(body: Record<string, unknown>, current: PortfolioFields, create: boolean): PortfolioFields {
  const next = { ...current, skills: [...current.skills] };
  const errors: Record<string, string> = {};
  if (create || 'kind' in body) {
    const kind = typeof body.kind === 'string' ? body.kind : '';
    if (!isPortfolioKind(kind)) errors.kind = 'Choose a project, a lab, or a case study.';
    else next.kind = kind;
  }
  if (create || 'title' in body) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) errors.title = 'Enter a title.';
    else if (title.length > 160) errors.title = 'Use at most 160 characters.';
    else next.title = title;
  }
  if (create || 'summary' in body) {
    if (typeof body.summary === 'string') next.summary = body.summary.trim();
    else if (body.summary !== undefined) errors.summary = 'Enter a summary or write-up.';
  }
  if ('skills' in body) {
    const skills = Array.isArray(body.skills)
      ? body.skills.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
      : typeof body.skills === 'string'
        ? body.skills.split(',').map((item) => item.trim()).filter(Boolean)
        : null;
    if (!skills) errors.skills = 'List skills or tools as text.';
    else next.skills = skills;
  }
  if ('repositoryUrl' in body) next.repositoryUrl = link(body.repositoryUrl, 'repositoryUrl', errors);
  if ('demoUrl' in body) next.demoUrl = link(body.demoUrl, 'demoUrl', errors);
  if ('startedOn' in body) next.startedOn = date(body.startedOn, 'startedOn', errors);
  if ('completedOn' in body) next.completedOn = date(body.completedOn, 'completedOn', errors);
  if (next.startedOn && next.completedOn && next.startedOn > next.completedOn) errors.completedOn = 'The end date cannot be earlier than the start date.';
  if (Object.keys(errors).length) fail('validation', 'Check the highlighted fields.', 422, errors);
  return next;
}

function emptyFields(kind: PortfolioKind): PortfolioFields {
  return { kind, title: '', summary: '', skills: [], startedOn: null, completedOn: null, repositoryUrl: null, demoUrl: null };
}

function link(value: unknown, key: string, errors: Record<string, string>): string | null {
  if (value === null || value === '' || value === undefined) return null;
  if (typeof value !== 'string' || !value.startsWith('https://')) {
    errors[key] = 'Enter a full link starting with https://.';
    return null;
  }
  return value.trim();
}

function date(value: unknown, key: string, errors: Record<string, string>): string | null {
  if (value === null || value === '' || value === undefined) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    errors[key] = 'Use a date as YYYY-MM-DD, or leave it blank.';
    return null;
  }
  return value;
}

function readIds(body: Record<string, unknown>): string[] | undefined {
  if (!Array.isArray(body.ids) || body.ids.some((id) => typeof id !== 'string')) return undefined;
  return body.ids;
}

function same(left: string[], right: string[]): boolean {
  return left.length === right.length && new Set(left).size === left.length && left.every((id) => right.includes(id));
}

function byOrder(left: DevItem, right: DevItem): number {
  return left.sortOrder - right.sortOrder;
}

function fresh(id: string): Trainee {
  const trainee = getState().trainees.find((item) => item.id === id);
  if (!trainee) fail('not_found', 'Trainee not found.', 404);
  return trainee;
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
  const url = `data:${mime};base64,${btoa(binary)}`;
  return displayPhotoUrl(url) ?? url;
}

function sniffVideo(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'video/webm';
  if (bytes.length < 12) return undefined;
  const box = String.fromCharCode(bytes[4] ?? 0, bytes[5] ?? 0, bytes[6] ?? 0, bytes[7] ?? 0);
  if (box !== 'ftyp') return undefined;
  const brand = String.fromCharCode(bytes[8] ?? 0, bytes[9] ?? 0, bytes[10] ?? 0, bytes[11] ?? 0);
  if (brand === 'qt  ') return 'video/quicktime';
  if (['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V '].includes(brand)) return 'video/mp4';
  return undefined;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    const fields: Record<string, unknown> = {};
    value.forEach((item, key) => {
      if (typeof item === 'string') fields[key] = item;
    });
    return fields;
  }
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function fail(code: 'validation' | 'unauthenticated' | 'forbidden' | 'not_found', message: string, status: number, fieldErrors?: Record<string, string>): never {
  throw new ApiError(code, message, status, fieldErrors);
}

export const portfolioKindLabel = KIND_LABEL;
export type { PortfolioContent };
