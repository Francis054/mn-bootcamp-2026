import type { TraineeEntity } from './trainee.entity.js';
import type { ProfilePatch } from './profile-links.js';

export interface ProfileFields {
  displayName: string;
  headline: string;
  bio: string;
  location: string;
  linkedin: string | null;
  githubUrl: string | null;
  portfolio: string | null;
  photoUrl: string | null;
  photoStorageKey: string | null;
}

export function liveFields(row: TraineeEntity): ProfileFields {
  return {
    displayName: row.displayName,
    headline: row.headline,
    bio: row.bio,
    location: row.location,
    linkedin: row.linkedin,
    githubUrl: row.githubUrl,
    portfolio: row.portfolio,
    photoUrl: row.photoUrl,
    photoStorageKey: row.photoStorageKey,
  };
}

export function hasPending(row: TraineeEntity): boolean {
  return typeof row.pendingDisplayName === 'string';
}

export function pendingFields(row: TraineeEntity): ProfileFields {
  return {
    displayName: row.pendingDisplayName ?? row.displayName,
    headline: row.pendingHeadline ?? '',
    bio: row.pendingBio ?? '',
    location: row.pendingLocation ?? '',
    linkedin: row.pendingLinkedin,
    githubUrl: row.pendingGithubUrl,
    portfolio: row.pendingPortfolio,
    photoUrl: row.pendingPhotoUrl,
    photoStorageKey: row.pendingPhotoStorageKey,
  };
}

export function editingFields(row: TraineeEntity): ProfileFields {
  return hasPending(row) ? pendingFields(row) : liveFields(row);
}

export function writePending(row: TraineeEntity, fields: ProfileFields): void {
  row.pendingDisplayName = fields.displayName;
  row.pendingHeadline = fields.headline;
  row.pendingBio = fields.bio;
  row.pendingLocation = fields.location;
  row.pendingLinkedin = fields.linkedin;
  row.pendingGithubUrl = fields.githubUrl;
  row.pendingPortfolio = fields.portfolio;
  row.pendingPhotoUrl = fields.photoUrl;
  row.pendingPhotoStorageKey = fields.photoStorageKey;
}

export function clearPending(row: TraineeEntity): void {
  row.pendingDisplayName = null;
  row.pendingHeadline = null;
  row.pendingBio = null;
  row.pendingLocation = null;
  row.pendingLinkedin = null;
  row.pendingGithubUrl = null;
  row.pendingPortfolio = null;
  row.pendingPhotoUrl = null;
  row.pendingPhotoStorageKey = null;
}

export function applyProfilePatch(base: ProfileFields, patch: ProfilePatch): ProfileFields {
  return { ...base, ...patch };
}

/** Fields the trainee and the review screen see. Storage keys stay on the server. */
export function publicFields(fields: ProfileFields): Omit<ProfileFields, 'photoStorageKey'> {
  return {
    displayName: fields.displayName,
    headline: fields.headline,
    bio: fields.bio,
    location: fields.location,
    linkedin: fields.linkedin,
    githubUrl: fields.githubUrl,
    portfolio: fields.portfolio,
    photoUrl: fields.photoUrl,
  };
}
