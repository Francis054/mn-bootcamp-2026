import type { AuditRepository } from '../auth/audit.repository.js';
import type { AuditAction } from '../auth/audit-event.entity.js';
import type { Actor } from '../curriculum/actor.js';
import { isoTimestamp } from '../curriculum/actor.js';
import type { Listing } from '../curriculum/publication.js';
import { ApiError } from '../../shared/errors/api-error.js';
import { initialsFrom } from '../users/profile.js';
import type { UserRepository } from '../users/user.repository.js';
import type { EmailProvider } from '../mail/email-provider.js';
import { deliverReview } from '../mail/review-mail.js';
import type { StorageProvider } from '../storage/storage-provider.js';
import {
  CONSENT_POLICY_VERSION,
  CONSENT_WORDING,
  applyPublicProfileConsent,
  readConsentChoices,
  type ConsentChoices,
  type ConsentScope,
} from './consent-policy.js';
import {
  applyProfilePatch,
  clearPending,
  editingFields,
  hasPending,
  liveFields,
  publicFields,
  writePending,
  type ProfileFields,
} from './profile-fields.js';
import { readProfilePatch } from './profile-links.js';
import { storeProfilePhoto } from './profile-photo.js';
import {
  approveReview,
  isReviewStatus,
  rejectReview,
  statusAfterEdit,
  submitForReview,
  type ReviewStatus,
} from './profile-review.js';
import type { TraineeConsentRepository } from './trainee-consent.repository.js';
import type { TraineeEntity } from './trainee.entity.js';
import type { TraineeRepository } from './trainee.repository.js';
import { photoPairMessage } from './trainee.rules.js';

export interface PortalProfile {
  traineeId: string;
  email: string;
  status: ReviewStatus;
  rejectionReason: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  draft: ReturnType<typeof publicFields>;
  live: ReturnType<typeof publicFields>;
  consents: { publicProfile: boolean; publicPhoto: boolean; contactRelay: boolean };
  policyVersion: string;
  wording: typeof CONSENT_WORDING;
}

export interface ReviewQueueItem {
  traineeId: string;
  email: string;
  displayName: string;
  status: ReviewStatus;
  submittedAt: string | null;
  draft: ReturnType<typeof publicFields>;
  live: ReturnType<typeof publicFields>;
  consents: { publicProfile: boolean; publicPhoto: boolean; contactRelay: boolean };
}

/**
 * The signed-in trainee's own profile. The trainee id always comes from the
 * session. A body cannot name another trainee.
 */
export class PortalProfileService {
  constructor(
    private readonly trainees: TraineeRepository,
    private readonly users: UserRepository,
    private readonly consents: TraineeConsentRepository,
    private readonly audit: AuditRepository,
    private readonly storage: StorageProvider,
    private readonly maxBytes: number,
    private readonly mail: EmailProvider,
    private readonly portalUrl: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getOwn(userId: string): Promise<PortalProfile> {
    return this.present(await this.own(userId));
  }

  async updateOwn(userId: string, body: unknown): Promise<PortalProfile> {
    const parsed = readProfilePatch(body);
    if (Object.keys(parsed.errors).length) {
      throw new ApiError('validation', 'Check the highlighted fields.', parsed.errors);
    }
    const row = await this.own(userId);
    const next = applyProfilePatch(editingFields(row), parsed.value);
    writePending(row, next);
    row.profileReviewStatus = statusAfterEdit(reviewStatus(row));
    await this.save(row);
    if (parsed.value.displayName) await this.renameLogin(row.id, parsed.value.displayName);
    return this.present(row);
  }

  async setPhoto(userId: string, bytes: Buffer, actor: Actor): Promise<PortalProfile> {
    const row = await this.own(userId);
    const stored = await storeProfilePhoto(bytes, this.storage, this.maxBytes);
    const current = editingFields(row);
    const previousKey = hasPending(row) ? current.photoStorageKey : null;
    writePending(row, {
      ...current,
      photoUrl: stored.photoUrl,
      photoStorageKey: stored.storageKey,
    });
    row.profileReviewStatus = statusAfterEdit(reviewStatus(row));
    await this.save(row);
    if (previousKey && previousKey !== stored.storageKey && previousKey !== row.photoStorageKey) {
      await this.removeStored(previousKey);
    }
    await this.auditPhoto(actor, row.id);
    return this.present(row);
  }

  async clearPhoto(userId: string, actor: Actor): Promise<PortalProfile> {
    const row = await this.own(userId);
    const current = editingFields(row);
    const previousKey = hasPending(row) ? current.photoStorageKey : null;
    writePending(row, { ...current, photoUrl: null, photoStorageKey: null });
    row.profileReviewStatus = statusAfterEdit(reviewStatus(row));
    await this.save(row);
    if (previousKey && previousKey !== row.photoStorageKey) await this.removeStored(previousKey);
    await this.auditPhoto(actor, row.id);
    return this.present(row);
  }

  async submit(userId: string): Promise<PortalProfile> {
    const row = await this.own(userId);
    if (!hasPending(row)) writePending(row, liveFields(row));
    const decision = submitForReview(reviewStatus(row), row.consentReceived);
    if (!decision.ok) throw new ApiError('validation', decision.message);
    row.profileReviewStatus = decision.status;
    row.profileSubmittedAt = this.now();
    row.profileRejectionReason = '';
    await this.save(row);
    return this.present(row);
  }

  async setConsents(userId: string, body: unknown, actor: Actor): Promise<PortalProfile> {
    const parsed = readConsentChoices(body);
    if (Object.keys(parsed.errors).length) {
      throw new ApiError('validation', 'Check the highlighted fields.', parsed.errors);
    }
    const row = await this.own(userId);
    const changed = await this.applyConsents(row, parsed.value, actor, 'self');
    if (changed) await this.auditConsent(actor, row.id);
    await this.save(row);
    return this.present(row);
  }

  async listQueue(): Promise<ReviewQueueItem[]> {
    const rows = await this.trainees.findAll();
    return rows
      .filter((row) => reviewStatus(row) === 'pending' && hasPending(row))
      .map((row) => ({
        traineeId: row.id,
        email: row.email,
        displayName: row.pendingDisplayName ?? row.displayName,
        status: 'pending',
        submittedAt: stamp(row.profileSubmittedAt),
        draft: publicFields(pendingFieldsOrLive(row)),
        live: publicFields(liveFields(row)),
        consents: consentsOf(row),
      }));
  }

  async editPending(traineeId: string, body: unknown, actor: Actor): Promise<ReviewQueueItem> {
    const row = await this.requirePending(traineeId);
    const parsed = readProfilePatch(body);
    const photoErrors = this.readAdminPhoto(body, parsed.errors);
    if (Object.keys(parsed.errors).length) {
      throw new ApiError('validation', 'Check the highlighted fields.', parsed.errors);
    }
    const next = applyProfilePatch(pendingFieldsOrLive(row), parsed.value);
    if (photoErrors.photo) {
      next.photoUrl = photoErrors.photo.photoUrl;
      next.photoStorageKey = photoErrors.photo.photoStorageKey;
    }
    const previousKey = row.pendingPhotoStorageKey;
    writePending(row, next);
    await this.save(row);
    await this.auditPortal(actor, 'portal.profile.admin_updated', row.id, 'trainee');
    if (photoErrors.photo && photoErrors.photo.photoStorageKey !== previousKey) {
      await this.auditPhoto(actor, row.id);
      if (
        previousKey &&
        previousKey !== row.photoStorageKey &&
        previousKey !== next.photoStorageKey
      ) {
        await this.removeStored(previousKey);
      }
    }
    return this.queueItem(row);
  }

  async approve(traineeId: string, actor: Actor): Promise<ReviewQueueItem> {
    const row = await this.requirePending(traineeId);
    const decision = approveReview(reviewStatus(row));
    if (!decision.ok) throw new ApiError('validation', decision.message);
    const next = pendingFieldsOrLive(row);
    const previousKey = row.photoStorageKey;
    row.displayName = next.displayName;
    row.initials = initialsFrom(next.displayName);
    row.headline = next.headline;
    row.bio = next.bio;
    row.location = next.location;
    row.linkedin = next.linkedin;
    row.githubUrl = next.githubUrl;
    row.portfolio = next.portfolio;
    row.photoUrl = next.photoUrl;
    row.photoStorageKey = next.photoStorageKey;
    row.publicLinks = true;
    row.profileReviewStatus = 'approved';
    row.profileRejectionReason = '';
    row.profileReviewedAt = this.now();
    row.profileReviewedBy = actor.userId;
    if (row.consentReceived && row.listing === 'hidden') row.listing = 'public' satisfies Listing;
    if (row.consentReceived) row.publicationStatus = 'published';
    clearPending(row);
    await this.save(row);
    await this.renameLogin(row.id, next.displayName);
    if (previousKey && previousKey !== next.photoStorageKey) await this.removeStored(previousKey);
    await this.auditPortal(actor, 'portal.profile.approved', row.id, 'trainee');
    if (previousKey !== next.photoStorageKey) await this.auditPhoto(actor, row.id);
    await this.notify(row, 'profile', row.displayName, true, '');
    return this.queueItem(row);
  }

  async reject(traineeId: string, body: unknown, actor: Actor): Promise<ReviewQueueItem> {
    const row = await this.requirePending(traineeId);
    const reason = isRecord(body) && typeof body.reason === 'string' ? body.reason : '';
    const decision = rejectReview(reviewStatus(row), reason);
    if (!decision.ok) {
      throw new ApiError('validation', decision.message, { reason: decision.message });
    }
    row.profileReviewStatus = 'rejected';
    row.profileRejectionReason = decision.reason;
    row.profileReviewedAt = this.now();
    row.profileReviewedBy = actor.userId;
    await this.save(row);
    await this.auditPortal(actor, 'portal.profile.rejected', row.id, 'trainee');
    await this.notify(row, 'profile', row.displayName, false, row.profileRejectionReason);
    return this.queueItem(row);
  }

  private notify(
    row: TraineeEntity,
    item: string,
    title: string,
    approved: boolean,
    reason: string,
  ): Promise<boolean> {
    return deliverReview(this.mail, {
      to: row.email,
      traineeId: row.id,
      item,
      title,
      approved,
      reason,
      portalUrl: this.portalUrl,
    });
  }

  private async own(userId: string): Promise<TraineeEntity> {
    const user = await this.users.findById(userId);
    if (!user?.traineeId) {
      throw new ApiError('not_found', 'Your login is not linked to a trainee record yet.');
    }
    const row = await this.trainees.findById(user.traineeId);
    if (!row) throw new ApiError('not_found', 'Your login is not linked to a trainee record yet.');
    return row;
  }

  private async requirePending(traineeId: string): Promise<TraineeEntity> {
    const row = await this.trainees.findById(traineeId);
    if (!row || reviewStatus(row) !== 'pending' || !hasPending(row)) {
      throw new ApiError('not_found', 'That profile is not waiting for review.');
    }
    return row;
  }

  private async applyConsents(
    row: TraineeEntity,
    choices: ConsentChoices,
    actor: Actor,
    source: 'self' | 'admin',
  ): Promise<boolean> {
    let changed = false;
    if (choices.publicProfile !== undefined) {
      if (choices.publicProfile !== row.consentReceived) {
        const applied = applyPublicProfileConsent({
          granted: choices.publicProfile,
          reviewStatus: reviewStatus(row),
          listing: row.listing,
          publicationStatus: row.publicationStatus,
        });
        row.consentReceived = applied.consentReceived;
        row.publicationStatus = applied.publicationStatus;
        if (applied.consentReceived && !applied.withdrawing) {
          row.consentReceivedAt = this.now();
          row.consentRecordedBy = actor.userId;
          row.consentWithdrawnAt = null;
        }
        if (applied.withdrawing) row.consentWithdrawnAt = this.now();
      }
      await this.writeConsent(row.id, 'public_profile', choices.publicProfile, source, actor);
      changed = true;
    }
    if (choices.publicPhoto !== undefined) {
      row.photoConsent = choices.publicPhoto;
      await this.writeConsent(row.id, 'public_photo', choices.publicPhoto, source, actor);
      changed = true;
    }
    if (choices.contactRelay !== undefined) {
      row.contactConsent = choices.contactRelay;
      await this.writeConsent(row.id, 'contact_relay', choices.contactRelay, source, actor);
      changed = true;
    }
    return changed;
  }

  private writeConsent(
    traineeId: string,
    scope: ConsentScope,
    granted: boolean,
    source: 'self' | 'admin',
    actor: Actor,
  ): Promise<unknown> {
    return this.consents.record({
      traineeId,
      scope,
      granted,
      source,
      policyVersion: CONSENT_POLICY_VERSION,
      wording: CONSENT_WORDING[scope],
      recordedBy: actor.userId,
    });
  }

  private async renameLogin(traineeId: string, displayName: string): Promise<void> {
    const user = await this.users.findByTraineeId(traineeId);
    if (!user) return;
    await this.users.rename(user.id, displayName, initialsFrom(displayName));
  }

  private readAdminPhoto(
    body: unknown,
    errors: Record<string, string>,
  ): { photo?: { photoUrl: string | null; photoStorageKey: string | null } } {
    if (!isRecord(body) || !('photoUrl' in body)) return {};
    if (body.photoUrl === null) return { photo: { photoUrl: null, photoStorageKey: null } };
    if (typeof body.photoUrl !== 'string') {
      errors.photoUrl = 'Use a JPEG, PNG, or WebP image.';
      return {};
    }
    const key = typeof body.photoStorageKey === 'string' ? body.photoStorageKey : '';
    const problem = photoPairMessage(body.photoUrl, key);
    if (problem) {
      errors.photoUrl = problem;
      return {};
    }
    return { photo: { photoUrl: body.photoUrl, photoStorageKey: key } };
  }

  private present(row: TraineeEntity): PortalProfile {
    return {
      traineeId: row.id,
      email: row.email,
      status: reviewStatus(row),
      rejectionReason: row.profileRejectionReason,
      submittedAt: stamp(row.profileSubmittedAt),
      reviewedAt: stamp(row.profileReviewedAt),
      draft: publicFields(editingFields(row)),
      live: publicFields(liveFields(row)),
      consents: consentsOf(row),
      policyVersion: CONSENT_POLICY_VERSION,
      wording: CONSENT_WORDING,
    };
  }

  private queueItem(row: TraineeEntity): ReviewQueueItem {
    return {
      traineeId: row.id,
      email: row.email,
      displayName: row.displayName,
      status: reviewStatus(row),
      submittedAt: stamp(row.profileSubmittedAt),
      draft: publicFields(hasPending(row) ? pendingFieldsOrLive(row) : liveFields(row)),
      live: publicFields(liveFields(row)),
      consents: consentsOf(row),
    };
  }

  private async save(row: TraineeEntity): Promise<void> {
    await this.trainees.save(row);
  }

  private auditPhoto(actor: Actor, traineeId: string): Promise<void> {
    return this.auditPortal(actor, 'portal.photo.changed', traineeId, 'trainee_photo');
  }

  private auditConsent(actor: Actor, traineeId: string): Promise<void> {
    return this.auditPortal(actor, 'portal.consent.changed', traineeId, 'trainee_consent');
  }

  private auditPortal(
    actor: Actor,
    action: AuditAction,
    traineeId: string,
    subjectType: string,
  ): Promise<void> {
    return this.audit.record({
      action,
      actorUserId: actor.userId,
      ip: actor.ip,
      requestId: actor.requestId,
      subjectType,
      subjectId: traineeId,
    });
  }

  private async removeStored(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'Image storage is not configured.') {
        throw new ApiError('server', 'Image storage is not configured.');
      }
      throw new ApiError('server', 'The previous photo could not be removed.');
    }
  }
}

function pendingFieldsOrLive(row: TraineeEntity): ProfileFields {
  return hasPending(row) ? editingFields(row) : liveFields(row);
}

function reviewStatus(row: TraineeEntity): ReviewStatus {
  return isReviewStatus(row.profileReviewStatus) ? row.profileReviewStatus : 'draft';
}

function consentsOf(row: TraineeEntity): {
  publicProfile: boolean;
  publicPhoto: boolean;
  contactRelay: boolean;
} {
  return {
    publicProfile: row.consentReceived,
    publicPhoto: row.photoConsent,
    contactRelay: row.contactConsent,
  };
}

function stamp(value: Date | null): string | null {
  if (!value) return null;
  return isoTimestamp(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
