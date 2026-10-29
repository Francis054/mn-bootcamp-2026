import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { AuditRepository } from '../auth/audit.repository.js';
import type { AuditAction } from '../auth/audit-event.entity.js';
import type { Actor } from '../curriculum/actor.js';
import { ApiError } from '../../shared/errors/api-error.js';
import { CONSENT_POLICY_VERSION, CONSENT_WORDING } from '../trainees/consent-policy.js';
import type { TraineeRepository } from '../trainees/trainee.repository.js';
import { isPublicTrainee } from '../trainees/visibility.js';
import type { UserRepository } from '../users/user.repository.js';
import type { DocumentStorage } from './document-storage.js';
import type { DocumentRepository, CvRow } from './document.repository.js';
import { readCvLink, signCvLink } from './cv-link.js';
import { cvRateLimit } from './cv-rate-limit.js';
import {
  HIDDEN_CV,
  attachmentDisposition,
  consentGrants,
  publicCvFrom,
  readRejectionReason,
  readVisibilityBody,
  type CvVisibility,
  type PublicCv,
} from './cv-rules.js';
import { CvFileError, inspectCv } from './pdf-rules.js';

export interface CvView {
  id: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  visibility: CvVisibility;
  reviewStatus: CvRow['reviewStatus'];
  rejectionReason: string;
  submittedAt: string | null;
  createdAt: string;
}

export interface CvQueueItem extends CvView {
  traineeId: string;
  traineeName: string;
}

export interface CvFile {
  bytes: Buffer;
  disposition: string;
}

export interface CvLink {
  path: string;
  expiresAt: string;
}

/**
 * One current CV per trainee. A replacement deletes the previous file in the same step.
 * There is no timed history. A new file waits for review before a public download is offered.
 */
export class CvService {
  readonly uploadLimit: RequestHandler;
  readonly downloadLimit: RequestHandler;

  constructor(
    private readonly documents: DocumentRepository,
    private readonly users: UserRepository,
    private readonly trainees: TraineeRepository,
    private readonly audit: AuditRepository,
    private readonly storage: DocumentStorage,
    private readonly secret: string | undefined,
    private readonly linkTtlMs: number,
    uploadMax: number,
    downloadMax: number,
    windowMs: number,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.uploadLimit = cvRateLimit({
      windowMs,
      max: uploadMax,
      message: 'Too many CV uploads. Try again later.',
    });
    this.downloadLimit = cvRateLimit({
      windowMs,
      max: downloadMax,
      message: 'Too many CV downloads. Try again later.',
    });
  }

  async getOwn(userId: string): Promise<{ cv: CvView | null }> {
    const trainee = await this.ownTrainee(userId);
    const row = await this.documents.current(this.documents.manager(), trainee.id);
    return { cv: row ? toView(row) : null };
  }

  async uploadOwn(
    userId: string,
    bytes: Buffer,
    fileName: string,
    visibility: CvVisibility | null,
    actor: Actor,
  ): Promise<CvView> {
    const trainee = await this.ownTrainee(userId);
    return this.store(trainee.id, bytes, fileName, visibility ?? 'on_request', actor, 'self');
  }

  async setVisibilityOwn(userId: string, body: unknown, actor: Actor): Promise<CvView> {
    const trainee = await this.ownTrainee(userId);
    return this.changeVisibility(trainee.id, body, actor, 'self');
  }

  async removeOwn(userId: string, actor: Actor): Promise<{ removed: true }> {
    const trainee = await this.ownTrainee(userId);
    await this.remove(trainee.id, actor);
    return { removed: true };
  }

  async readOwn(userId: string): Promise<CvFile> {
    const trainee = await this.ownTrainee(userId);
    const row = await this.documents.current(this.documents.manager(), trainee.id);
    if (!row) throw new ApiError('not_found', 'There is no CV to download.');
    return this.bytesFor(row);
  }

  async publicFlags(traineeIds: readonly string[]): Promise<Map<string, PublicCv>> {
    const rows = await this.documents.publicRows(this.documents.manager(), traineeIds);
    const flags = new Map<string, PublicCv>();
    for (const row of rows)
      flags.set(row.traineeId, publicCvFrom(row.visibility, row.reviewStatus));
    return flags;
  }

  async mintPublicLink(traineeId: string): Promise<CvLink> {
    const secret = this.requireSecret();
    const trainee = await this.trainees.findById(traineeId);
    if (!trainee || !isPublicTrainee(trainee))
      throw new ApiError('not_found', 'That CV is not available.');
    const row = await this.documents.current(this.documents.manager(), trainee.id);
    const offered = row ? publicCvFrom(row.visibility, row.reviewStatus) : HIDDEN_CV;
    if (!row || offered.mode !== 'public')
      throw new ApiError('not_found', 'That CV is not available.');
    const issuedAt = this.now().getTime();
    const token = signCvLink({
      secret,
      documentId: row.id,
      nowMs: issuedAt,
      ttlMs: this.linkTtlMs,
    });
    return {
      path: `/api/v1/public/cv/${token}`,
      expiresAt: new Date(issuedAt + this.linkTtlMs).toISOString(),
    };
  }

  async readPublicToken(token: string): Promise<CvFile> {
    const secret = this.requireSecret();
    const link = readCvLink(token, secret, this.now().getTime());
    if (!link) throw new ApiError('not_found', 'That download link is not valid.');
    if (link.expired) throw new ApiError('not_found', 'This download link has expired.');
    const row = await this.documents.byId(this.documents.manager(), link.documentId);
    if (!row || publicCvFrom(row.visibility, row.reviewStatus).mode !== 'public') {
      throw new ApiError('not_found', 'That CV is not available.');
    }
    const trainee = await this.trainees.findById(row.traineeId);
    if (!trainee || !isPublicTrainee(trainee))
      throw new ApiError('not_found', 'That CV is not available.');
    return this.bytesFor(row);
  }

  async listQueue(): Promise<CvQueueItem[]> {
    const rows = await this.documents.listPending(this.documents.manager());
    return rows.map((row) => ({
      ...toView(row),
      traineeId: row.traineeId,
      traineeName: row.traineeName,
    }));
  }

  async approve(id: string, actor: Actor): Promise<CvQueueItem> {
    const reviewerId = this.requireActor(actor);
    const row = await this.pending(id);
    await this.documents.transaction(async (manager) => {
      await this.documents.review(manager, row.id, 'approved', '', reviewerId);
    });
    await this.audit.record({
      action: 'portal.cv.approved',
      actorUserId: reviewerId,
      ip: actor.ip,
      requestId: actor.requestId,
      subjectType: 'cv',
      subjectId: row.id,
    });
    const next = await this.documents.byId(this.documents.manager(), row.id);
    if (!next) throw new ApiError('not_found', 'That CV is not available.');
    return { ...toView(next), traineeId: next.traineeId, traineeName: next.traineeName };
  }

  async reject(id: string, body: unknown, actor: Actor): Promise<CvQueueItem> {
    const reviewerId = this.requireActor(actor);
    const parsed = readRejectionReason(body);
    if (!parsed.value) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        reason: parsed.error ?? 'Add a reason the trainee can read.',
      });
    }
    const reason = parsed.value;
    const row = await this.pending(id);
    await this.documents.transaction(async (manager) => {
      await this.documents.review(manager, row.id, 'rejected', reason, reviewerId);
    });
    await this.audit.record({
      action: 'portal.cv.rejected',
      actorUserId: reviewerId,
      ip: actor.ip,
      requestId: actor.requestId,
      subjectType: 'cv',
      subjectId: row.id,
    });
    const next = await this.documents.byId(this.documents.manager(), row.id);
    if (!next) throw new ApiError('not_found', 'That CV is not available.');
    return { ...toView(next), traineeId: next.traineeId, traineeName: next.traineeName };
  }

  async getForTrainee(traineeId: string): Promise<{ cv: CvView | null }> {
    await this.requireTrainee(traineeId);
    const row = await this.documents.current(this.documents.manager(), traineeId);
    return { cv: row ? toView(row) : null };
  }

  async uploadForTrainee(
    traineeId: string,
    bytes: Buffer,
    fileName: string,
    visibility: CvVisibility | null,
    actor: Actor,
  ): Promise<CvView> {
    await this.requireTrainee(traineeId);
    return this.store(traineeId, bytes, fileName, visibility ?? 'on_request', actor, 'admin');
  }

  async removeForTrainee(traineeId: string, actor: Actor): Promise<{ removed: true }> {
    await this.requireTrainee(traineeId);
    await this.remove(traineeId, actor);
    return { removed: true };
  }

  async readForTrainee(traineeId: string): Promise<CvFile> {
    await this.requireTrainee(traineeId);
    const row = await this.documents.current(this.documents.manager(), traineeId);
    if (!row) throw new ApiError('not_found', 'There is no CV to download.');
    return this.bytesFor(row);
  }

  private async store(
    traineeId: string,
    bytes: Buffer,
    fileName: string,
    visibility: CvVisibility,
    actor: Actor,
    source: 'self' | 'admin',
  ): Promise<CvView> {
    const actorId = this.requireActor(actor);
    let inspected;
    try {
      inspected = await inspectCv(bytes);
    } catch (error) {
      if (error instanceof CvFileError) {
        throw new ApiError('validation', 'Check the highlighted fields.', {
          file: error.fieldMessage,
        });
      }
      throw error;
    }
    let storedKey = '';
    let documentId = '';
    let previousKey: string | null;
    try {
      previousKey = await this.documents.transaction(async (manager) => {
        const locked = await this.documents.lockTrainee(manager, traineeId);
        if (!locked) throw new ApiError('not_found', 'That trainee was not found.');
        const existing = await this.documents.current(manager, traineeId);
        const stored = await this.storage.put({ bytes, contentType: 'application/pdf' });
        storedKey = stored.key;
        const input = {
          traineeId,
          fileName,
          sizeBytes: bytes.length,
          sha256: inspected.sha256,
          storageProvider: this.storage.name,
          storageKey: stored.key,
          visibility,
          uploadedBy: actorId,
        };
        if (existing) {
          await this.documents.replaceFile(manager, existing.id, input);
          documentId = existing.id;
          return existing.storageKey;
        }
        documentId = await this.documents.insert(manager, input);
        return null;
      });
      if (previousKey && previousKey !== storedKey) {
        await this.storage.delete(previousKey).catch(() => undefined);
      }
    } catch (error) {
      if (storedKey) await this.storage.delete(storedKey).catch(() => undefined);
      throw asStorageError(error);
    }
    await this.writeConsent(traineeId, visibility, source, actorId);
    await this.record(previousKey ? 'portal.cv.replaced' : 'portal.cv.uploaded', actor, documentId);
    const row = await this.documents.current(this.documents.manager(), traineeId);
    if (!row) throw new ApiError('server', 'The CV could not be saved.');
    return toView(row);
  }

  private async changeVisibility(
    traineeId: string,
    body: unknown,
    actor: Actor,
    source: 'self' | 'admin',
  ): Promise<CvView> {
    const actorId = this.requireActor(actor);
    const parsed = readVisibilityBody(body);
    if (!parsed.value) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        visibility: parsed.error ?? 'Choose private, on request, or public.',
      });
    }
    const visibility = parsed.value;
    const row = await this.documents.transaction(async (manager) => {
      const locked = await this.documents.lockTrainee(manager, traineeId);
      if (!locked) throw new ApiError('not_found', 'That trainee was not found.');
      const current = await this.documents.current(manager, traineeId);
      if (!current) throw new ApiError('not_found', 'There is no CV to update.');
      await this.documents.setVisibility(manager, current.id, visibility);
      return current.id;
    });
    await this.writeConsent(traineeId, visibility, source, actorId);
    await this.record('portal.cv.visibility', actor, row);
    const next = await this.documents.current(this.documents.manager(), traineeId);
    if (!next) throw new ApiError('not_found', 'There is no CV to update.');
    return toView(next);
  }

  private async remove(traineeId: string, actor: Actor): Promise<void> {
    const actorId = this.requireActor(actor);
    const removed = await this.documents.transaction(async (manager) => {
      const locked = await this.documents.lockTrainee(manager, traineeId);
      if (!locked) throw new ApiError('not_found', 'That trainee was not found.');
      const current = await this.documents.current(manager, traineeId);
      if (!current) throw new ApiError('not_found', 'There is no CV to remove.');
      await this.documents.clearCurrent(manager, traineeId, current.id);
      return current;
    });
    await this.storage.delete(removed.storageKey).catch(() => undefined);
    await this.record('portal.cv.removed', { ...actor, userId: actorId }, removed.id);
  }

  private async writeConsent(
    traineeId: string,
    visibility: CvVisibility,
    source: 'self' | 'admin',
    recordedBy: string,
  ): Promise<void> {
    const grants = consentGrants(visibility);
    await this.documents.transaction(async (manager) => {
      await this.documents.recordConsent(manager, {
        traineeId,
        scope: 'cv_public',
        granted: grants.cv_public,
        source,
        policyVersion: CONSENT_POLICY_VERSION,
        wording: CONSENT_WORDING.cv_public,
        recordedBy,
      });
      await this.documents.recordConsent(manager, {
        traineeId,
        scope: 'cv_on_request',
        granted: grants.cv_on_request,
        source,
        policyVersion: CONSENT_POLICY_VERSION,
        wording: CONSENT_WORDING.cv_on_request,
        recordedBy,
      });
    });
  }

  private async bytesFor(row: CvRow): Promise<CvFile> {
    let bytes: Buffer;
    try {
      bytes = await this.storage.read(row.storageKey);
    } catch (error) {
      throw asStorageError(error);
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== row.sha256) throw new ApiError('server', 'The CV could not be read.');
    return { bytes, disposition: attachmentDisposition(row.fileName) };
  }

  private async pending(id: string): Promise<CvRow> {
    const row = await this.documents.byId(this.documents.manager(), id);
    if (!row || row.reviewStatus !== 'pending')
      throw new ApiError('not_found', 'That CV is not waiting for review.');
    return row;
  }

  private async ownTrainee(userId: string) {
    const user = await this.users.findById(userId);
    if (!user?.traineeId)
      throw new ApiError('not_found', 'Your login is not linked to a trainee record yet.');
    const trainee = await this.trainees.findById(user.traineeId);
    if (!trainee)
      throw new ApiError('not_found', 'Your login is not linked to a trainee record yet.');
    return trainee;
  }

  private async requireTrainee(traineeId: string) {
    const trainee = await this.trainees.findById(traineeId);
    if (!trainee) throw new ApiError('not_found', 'That trainee was not found.');
    return trainee;
  }

  private requireActor(actor: Actor): string {
    if (!actor.userId) throw new ApiError('unauthenticated', 'Sign in to continue.');
    return actor.userId;
  }

  private requireSecret(): string {
    if (!this.secret) throw new ApiError('server', 'CV downloads are not configured.');
    return this.secret;
  }

  private async record(action: AuditAction, actor: Actor, documentId: string): Promise<void> {
    await this.audit.record({
      action,
      actorUserId: actor.userId,
      ip: actor.ip,
      requestId: actor.requestId,
      subjectType: 'cv',
      subjectId: documentId,
    });
  }
}

function toView(row: CvRow): CvView {
  return {
    id: row.id,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    visibility: row.visibility,
    reviewStatus: row.reviewStatus,
    rejectionReason: row.rejectionReason,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function asStorageError(error: unknown): unknown {
  if (error instanceof ApiError || error instanceof CvFileError) return error;
  const message = error instanceof Error ? error.message : '';
  if (
    message === 'CV storage is not configured.' ||
    message === 'The CV bucket is not available.' ||
    message === 'The CV could not be saved.' ||
    message === 'The CV could not be read.' ||
    message === 'The previous CV could not be removed.'
  ) {
    return new ApiError('server', message);
  }
  return error;
}
