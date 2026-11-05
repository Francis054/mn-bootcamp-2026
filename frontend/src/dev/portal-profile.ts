import { ApiError } from '@/domain/types';
import type { Trainee } from '@/domain/types';
import { displayPhotoUrl, profilePhotoFileProblem, readFileBytes, sniffedPhotoMime } from '@/domain/photo';
import {
  CONSENT_POLICY_VERSION,
  CONSENT_WORDING,
  githubProblem,
  linkedinProblem,
  type PortalProfile,
  type ProfileFields,
  type ReviewStatus,
} from '@/domain/portalProfile';
import { can } from '@/domain/permissions';
import { getState, updateState } from './store';
import { clearSession, readActiveSession } from './session';

interface DraftState {
  status: ReviewStatus;
  rejectionReason: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  pending: ProfileFields | null;
  consents: { publicProfile: boolean; publicPhoto: boolean; contactRelay: boolean };
}

const drafts = new Map<string, DraftState>();

export function resetPortalProfileDev(): void {
  drafts.clear();
}

export async function portalProfileRoute(method: string, path: string, raw: unknown): Promise<unknown | undefined> {
  if (path === '/portal/profile' && method === 'GET') return present(ownTrainee());
  if (path === '/portal/profile' && method === 'PATCH') return saveOwn(record(raw));
  if (path === '/portal/profile/photo' && method === 'POST') return uploadOwn(raw);
  if (path === '/portal/profile/photo' && method === 'DELETE') return clearOwnPhoto();
  if (path === '/portal/profile/submit' && method === 'POST') return submitOwn();
  if (path === '/portal/consents' && method === 'PUT') return saveConsents(record(raw));
  if (path === '/admin/review-queue' && method === 'GET') return listQueue();
  const review = /^\/admin\/review-queue\/([^/]+)(?:\/(approve|reject))?$/.exec(path);
  if (!review) return undefined;
  const traineeId = decodeURIComponent(review[1] ?? '');
  const action = review[2];
  if (method === 'PATCH' && !action) return editPending(traineeId, record(raw));
  if (method === 'POST' && action === 'approve') return approve(traineeId);
  if (method === 'POST' && action === 'reject') return reject(traineeId, record(raw));
  return undefined;
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
  if (!user) fail('unauthenticated', 'This development session is no longer valid.', 401);
  const permission = write ? 'content.write' : 'content.read';
  if (!can(user.role, permission)) fail('forbidden', 'You do not have access to that.', 403);
}

function saveOwn(body: Record<string, unknown>): PortalProfile {
  const trainee = requireWrite();
  const draft = ensure(trainee);
  const base = draft.pending ?? liveOf(trainee);
  const next = applyText(base, body);
  draft.pending = next;
  draft.status = draft.status === 'pending' ? 'pending' : 'draft';
  if (typeof next.displayName === 'string') rename(trainee.id, next.displayName);
  return present(trainee);
}

async function uploadOwn(raw: unknown): Promise<PortalProfile> {
  const trainee = requireWrite();
  const file = photoFile(raw);
  if (!file) fail('validation', 'Check the highlighted fields.', 422, { photoUrl: 'Choose an image.' });
  const size = profilePhotoFileProblem(file);
  if (size) fail('validation', 'Check the highlighted fields.', 422, { photoUrl: size });
  const bytes = await readFileBytes(file);
  const mime = sniffedPhotoMime(bytes);
  if (!mime) fail('validation', 'Check the highlighted fields.', 422, { photoUrl: 'Use a JPEG, PNG, or WebP image.' });
  const draft = ensure(trainee);
  const base = draft.pending ?? liveOf(trainee);
  draft.pending = { ...base, photoUrl: dataUrl(bytes, mime) };
  draft.status = draft.status === 'pending' ? 'pending' : 'draft';
  return present(trainee);
}

function clearOwnPhoto(): PortalProfile {
  const trainee = requireWrite();
  const draft = ensure(trainee);
  const base = draft.pending ?? liveOf(trainee);
  draft.pending = { ...base, photoUrl: null };
  draft.status = draft.status === 'pending' ? 'pending' : 'draft';
  return present(trainee);
}

function submitOwn(): PortalProfile {
  const trainee = requireWrite();
  const draft = ensure(trainee);
  if (!draft.pending) draft.pending = liveOf(trainee);
  if (!draft.consents.publicProfile) {
    fail('validation', 'Agree to a public profile before you submit it for review.', 422);
  }
  if (draft.status === 'pending') fail('validation', 'This profile is already waiting for review.', 422);
  if (draft.status === 'approved') fail('validation', 'Change the profile before you submit it again.', 422);
  draft.status = 'pending';
  draft.rejectionReason = '';
  draft.submittedAt = new Date().toISOString();
  return present(trainee);
}

function saveConsents(body: Record<string, unknown>): PortalProfile {
  const trainee = requireWrite();
  const draft = ensure(trainee);
  if ('publicProfile' in body) {
    if (typeof body.publicProfile !== 'boolean') fail('validation', 'Check the highlighted fields.', 422, { publicProfile: 'Choose yes or no.' });
    draft.consents.publicProfile = body.publicProfile;
    updateState((state) => ({
      ...state,
      trainees: state.trainees.map((item) => {
        if (item.id !== trainee.id) return item;
        if (!body.publicProfile) return { ...item, consentReceived: false, publicationStatus: 'draft' };
        if (draft.status === 'approved' && item.listing !== 'hidden') {
          return { ...item, consentReceived: true, publicationStatus: 'published' };
        }
        return { ...item, consentReceived: true };
      }),
    }));
  }
  if ('publicPhoto' in body) {
    if (typeof body.publicPhoto !== 'boolean') fail('validation', 'Check the highlighted fields.', 422, { publicPhoto: 'Choose yes or no.' });
    draft.consents.publicPhoto = body.publicPhoto;
    updateState((state) => ({
      ...state,
      trainees: state.trainees.map((item) => (item.id === trainee.id ? { ...item, photoConsent: body.publicPhoto === true } : item)),
    }));
  }
  if ('contactRelay' in body) {
    if (typeof body.contactRelay !== 'boolean') fail('validation', 'Check the highlighted fields.', 422, { contactRelay: 'Choose yes or no.' });
    draft.consents.contactRelay = body.contactRelay;
  }
  if (!('publicProfile' in body) && !('publicPhoto' in body) && !('contactRelay' in body)) {
    fail('validation', 'Choose the consent items you want to change.', 422);
  }
  return present(fresh(trainee.id));
}

function listQueue(): unknown[] {
  requireStaff(false);
  return getState().trainees.flatMap((trainee) => {
    const draft = drafts.get(trainee.id);
    if (!draft || draft.status !== 'pending' || !draft.pending) return [];
    return [{
      traineeId: trainee.id,
      email: trainee.email,
      displayName: draft.pending.displayName,
      status: 'pending',
      submittedAt: draft.submittedAt,
      draft: draft.pending,
      live: liveOf(trainee),
      consents: draft.consents,
    }];
  });
}

function editPending(traineeId: string, body: Record<string, unknown>): unknown {
  requireStaff(true);
  const trainee = fresh(traineeId);
  const draft = drafts.get(trainee.id);
  if (!draft || draft.status !== 'pending' || !draft.pending) fail('not_found', 'That profile is not waiting for review.', 404);
  draft.pending = applyText(draft.pending, body);
  return queueItem(trainee.id);
}

function approve(traineeId: string): unknown {
  requireStaff(true);
  const trainee = fresh(traineeId);
  const draft = drafts.get(trainee.id);
  if (!draft || draft.status !== 'pending' || !draft.pending) fail('not_found', 'That profile is not waiting for review.', 404);
  const next = draft.pending;
  updateState((state) => ({
    ...state,
    trainees: state.trainees.map((item) => {
      if (item.id !== trainee.id) return item;
      const listing = draft.consents.publicProfile && item.listing === 'hidden' ? 'public' : item.listing;
      return {
        ...item,
        displayName: next.displayName,
        headline: next.headline,
        bio: next.bio,
        location: next.location,
        linkedin: next.linkedin,
        githubUrl: next.githubUrl,
        portfolio: next.portfolio,
        photoUrl: next.photoUrl,
        photoConsent: draft.consents.publicPhoto,
        publicLinks: true,
        consentReceived: draft.consents.publicProfile,
        publicationStatus: draft.consents.publicProfile ? 'published' : item.publicationStatus,
        listing,
      };
    }),
    users: state.users.map((user) => (user.traineeId === trainee.id ? { ...user, displayName: next.displayName } : user)),
  }));
  draft.status = 'approved';
  draft.pending = null;
  draft.rejectionReason = '';
  draft.reviewedAt = new Date().toISOString();
  return queueItem(trainee.id);
}

function reject(traineeId: string, body: Record<string, unknown>): unknown {
  requireStaff(true);
  const trainee = fresh(traineeId);
  const draft = drafts.get(trainee.id);
  if (!draft || draft.status !== 'pending' || !draft.pending) fail('not_found', 'That profile is not waiting for review.', 404);
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) fail('validation', 'Enter a reason the trainee can read.', 422, { reason: 'Enter a reason the trainee can read.' });
  draft.status = 'rejected';
  draft.rejectionReason = reason;
  draft.reviewedAt = new Date().toISOString();
  return queueItem(trainee.id);
}

function present(trainee: Trainee): PortalProfile {
  const current = fresh(trainee.id);
  const draft = ensure(current);
  return {
    traineeId: current.id,
    email: current.email,
    status: draft.status,
    rejectionReason: draft.rejectionReason,
    submittedAt: draft.submittedAt,
    reviewedAt: draft.reviewedAt,
    draft: draft.pending ?? liveOf(current),
    live: liveOf(current),
    consents: draft.consents,
    policyVersion: CONSENT_POLICY_VERSION,
    wording: CONSENT_WORDING,
  };
}

function queueItem(traineeId: string): unknown {
  const trainee = fresh(traineeId);
  const draft = ensure(trainee);
  return {
    traineeId: trainee.id,
    email: trainee.email,
    displayName: trainee.displayName,
    status: draft.status,
    submittedAt: draft.submittedAt,
    draft: draft.pending ?? liveOf(trainee),
    live: liveOf(trainee),
    consents: draft.consents,
  };
}

function ensure(trainee: Trainee): DraftState {
  const existing = drafts.get(trainee.id);
  if (existing) return existing;
  const created: DraftState = {
    status: trainee.publicationStatus === 'published' ? 'approved' : 'draft',
    rejectionReason: '',
    submittedAt: null,
    reviewedAt: null,
    pending: null,
    consents: {
      publicProfile: trainee.consentReceived,
      publicPhoto: trainee.photoConsent ?? false,
      contactRelay: false,
    },
  };
  drafts.set(trainee.id, created);
  return created;
}

function liveOf(trainee: Trainee): ProfileFields {
  return {
    displayName: trainee.displayName,
    headline: trainee.headline ?? '',
    bio: trainee.bio,
    location: trainee.location ?? '',
    linkedin: trainee.linkedin,
    githubUrl: trainee.githubUrl ?? null,
    portfolio: trainee.portfolio,
    photoUrl: trainee.photoUrl,
  };
}

function applyText(base: ProfileFields, body: Record<string, unknown>): ProfileFields {
  const next = { ...base };
  const errors: Record<string, string> = {};
  if ('displayName' in body) {
    const name = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    if (!name || name.length > 120) errors.displayName = name ? 'Use at most 120 characters.' : 'Enter a display name.';
    else next.displayName = name;
  }
  if ('headline' in body) {
    const headline = typeof body.headline === 'string' ? body.headline.trim() : '';
    if (typeof body.headline !== 'string' || headline.length > 160) errors.headline = 'Use at most 160 characters.';
    else next.headline = headline;
  }
  if ('bio' in body) {
    const bio = typeof body.bio === 'string' ? body.bio : '';
    if (bio.length > 5000) errors.bio = 'Use at most 5000 characters.';
    else next.bio = bio;
  }
  if ('location' in body) {
    const location = typeof body.location === 'string' ? body.location.trim() : '';
    if (typeof body.location !== 'string' || location.length > 120) errors.location = 'Use at most 120 characters.';
    else next.location = location;
  }
  if ('linkedin' in body) assignLink(next, errors, 'linkedin', body.linkedin, linkedinProblem);
  if ('githubUrl' in body) assignLink(next, errors, 'githubUrl', body.githubUrl, githubProblem);
  if ('portfolio' in body) {
    const portfolio = typeof body.portfolio === 'string' ? body.portfolio.trim() : '';
    if (body.portfolio !== null && portfolio && !portfolio.startsWith('https://')) errors.portfolio = 'Enter a full link starting with https://.';
    else next.portfolio = portfolio || null;
  }
  if (Object.keys(errors).length) fail('validation', 'Check the highlighted fields.', 422, errors);
  return next;
}

function assignLink(
  next: ProfileFields,
  errors: Record<string, string>,
  key: 'linkedin' | 'githubUrl',
  value: unknown,
  problem: (value: string) => string | null,
): void {
  if (value === null || value === '') {
    next[key] = null;
    return;
  }
  if (typeof value !== 'string') {
    errors[key] = key === 'linkedin' ? 'Use a https://www.linkedin.com link.' : 'Use a https://github.com link.';
    return;
  }
  const message = problem(value);
  if (message) errors[key] = message;
  else next[key] = value.trim();
}

function rename(traineeId: string, displayName: string): void {
  updateState((state) => ({
    ...state,
    users: state.users.map((user) => (user.traineeId === traineeId ? { ...user, displayName } : user)),
  }));
}

function fresh(id: string): Trainee {
  const trainee = getState().trainees.find((item) => item.id === id);
  if (!trainee) fail('not_found', 'Trainee not found.', 404);
  return trainee;
}

function photoFile(value: unknown): File | null {
  if (typeof FormData === 'undefined' || !(value instanceof FormData)) return null;
  const item = value.get('file');
  if (typeof File !== 'undefined' && item instanceof File && item.size > 0) return item;
  return null;
}

function dataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  const url = `data:${mime};base64,${btoa(binary)}`;
  return displayPhotoUrl(url) ?? url;
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
