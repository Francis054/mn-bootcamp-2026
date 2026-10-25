import { randomUUID } from 'node:crypto';
import type { AuditRepository } from '../auth/audit.repository.js';
import { curriculumAuditAction, type CurriculumVerb } from '../auth/audit-event.entity.js';
import type { Actor } from '../curriculum/actor.js';
import { isoTimestamp } from '../curriculum/actor.js';
import { isPublicRecord } from '../curriculum/publication.js';
import { readImage } from '../gallery/image-bytes.js';
import type { ProjectRepository } from '../projects/project.repository.js';
import { isMemoryStorage } from '../storage/memory-storage.js';
import type { StorageProvider } from '../storage/storage-provider.js';
import type { TraineeRepository } from '../trainees/trainee.repository.js';
import { ApiError } from '../../shared/errors/api-error.js';
import type { ImageMime } from '../gallery/image-bytes.js';
import {
  altMessage,
  captionMessage,
  imageSizeMessage,
  projectIdMessage,
  traineeIdMessage,
} from './work-photo.rules.js';
import type { WorkPhotoEntity } from './work-photo.entity.js';
import type { WorkPhotoRepository } from './work-photo.repository.js';
import { toPublicWorkPhoto, type PublicWorkPhoto, type WorkPhotoRecord } from './records.js';

const CHOOSE_IMAGE = 'Use a JPEG, PNG, or WebP image.';
const CHOOSE_TRAINEE = 'Choose a trainee.';
const CHOOSE_PROJECT = 'Choose a project.';
const PROJECT_FOR_TRAINEE = 'Choose a project this trainee is on.';
const DELIVERY_FAILED = 'The photo could not be removed from storage. Try again.';

export type WorkPhotoFile =
  { kind: 'bytes'; mime: ImageMime; bytes: Buffer } | { kind: 'redirect'; url: string };

export class WorkPhotoService {
  constructor(
    private readonly photos: WorkPhotoRepository,
    private readonly trainees: TraineeRepository,
    private readonly projects: ProjectRepository,
    private readonly audit: AuditRepository,
    private readonly storage: StorageProvider,
    private readonly maxBytes: number,
  ) {}

  async listPublic(filter: { traineeId?: string; projectId?: string }): Promise<PublicWorkPhoto[]> {
    const rows = await this.photos.findFiltered(filter);
    return rows.filter(isPublicWorkPhoto).map((row) => toPublicWorkPhoto(this.toRecord(row)));
  }

  async listAdmin(filter: { traineeId?: string; projectId?: string }): Promise<WorkPhotoRecord[]> {
    const rows = await this.photos.findFiltered(filter);
    return rows.map((row) => this.toRecord(row));
  }

  async getAdmin(id: string): Promise<WorkPhotoRecord> {
    return this.toRecord(await this.requirePhoto(id, 'Image not found.'));
  }

  async createUpload(
    input: { traineeId: string; projectId: string; alt: string; caption: string; bytes: Buffer },
    actor: Actor,
  ): Promise<WorkPhotoRecord> {
    const problems: Record<string, string> = {};
    const traineeProblem = traineeIdMessage(input.traineeId);
    if (traineeProblem) problems.traineeId = traineeProblem;
    const projectProblem = projectIdMessage(input.projectId);
    if (projectProblem) problems.projectId = projectProblem;
    const altProblem = altMessage(input.alt);
    if (altProblem) problems.alt = altProblem;
    if (input.caption !== '') {
      const captionProblem = captionMessage(input.caption);
      if (captionProblem) problems.caption = captionProblem;
    }
    if (input.bytes.length > this.maxBytes) problems.file = imageSizeMessage(this.maxBytes);
    const image = input.bytes.length > this.maxBytes ? undefined : readImage(input.bytes);
    if (!problems.file && !image) problems.file = CHOOSE_IMAGE;
    if (Object.keys(problems).length > 0 || !image) {
      throw new ApiError('validation', 'Check the highlighted fields.', problems);
    }

    const traineeId = input.traineeId.trim();
    const projectId = input.projectId.trim();
    await this.assertTrainee(traineeId);
    if (projectId !== '') await this.assertProject(projectId, traineeId);

    let stored: { key: string; publicUrl: string };
    try {
      stored = await this.storage.put({ bytes: input.bytes, mime: image.mime });
    } catch (error) {
      throw storageFailure(error);
    }

    const alt = input.alt.trim();
    try {
      const saved = await this.photos.insert({
        id: randomUUID(),
        traineeId,
        projectId: projectId === '' ? null : projectId,
        src: stored.publicUrl,
        width: image.width,
        height: image.height,
        alt,
        caption: input.caption.trim() || alt,
        publicationStatus: 'draft',
        listing: 'hidden',
        storageProvider: this.storage.name,
        storageKey: stored.key,
        uploadedBy: actor.userId,
      });
      await this.writeAudit(actor, 'created', saved.id);
      return this.toRecord(saved);
    } catch (error) {
      try {
        await this.storage.delete(stored.key);
      } catch {
        // The original save error is the one to show.
      }
      throw error;
    }
  }

  async publish(id: string, actor: Actor): Promise<WorkPhotoRecord> {
    const current = await this.requirePhoto(id, 'Image not found.');
    let changed = false;
    if (current.publicationStatus !== 'published') {
      current.publicationStatus = 'published';
      changed = true;
    }
    if (current.listing === 'hidden') {
      current.listing = 'public';
      changed = true;
    }
    if (changed) {
      await this.photos.save(current);
      await this.writeAudit(actor, 'published', current.id);
    }
    return this.toRecord(current);
  }

  async unpublish(id: string, actor: Actor): Promise<WorkPhotoRecord> {
    const current = await this.requirePhoto(id, 'Image not found.');
    if (current.publicationStatus !== 'draft') {
      current.publicationStatus = 'draft';
      await this.photos.save(current);
      await this.writeAudit(actor, 'unpublished', current.id);
    }
    return this.toRecord(current);
  }

  async remove(id: string, actor: Actor): Promise<{ deleted: true; id: string }> {
    const current = await this.requirePhoto(id, 'Record not found.');
    if (current.storageKey !== '') {
      try {
        await this.storage.delete(current.storageKey);
      } catch {
        throw new ApiError('server', DELIVERY_FAILED);
      }
    }
    await this.photos.remove(current);
    await this.writeAudit(actor, 'deleted', id);
    return { deleted: true, id };
  }

  async open(id: string, audience: 'admin' | 'public'): Promise<WorkPhotoFile> {
    const missing = audience === 'admin' ? 'Image not found.' : 'That page is not available.';
    const row = await this.requirePhoto(id, missing);
    if (audience === 'public' && !isPublicWorkPhoto(row)) {
      throw new ApiError('not_found', 'That page is not available.');
    }
    const redirect = cloudinaryUrl(row.src);
    if (redirect) return { kind: 'redirect', url: redirect };
    const bytes = isMemoryStorage(this.storage)
      ? this.storage.objects.get(row.storageKey)
      : undefined;
    if (!bytes) throw new ApiError('not_found', missing);
    const image = readImage(bytes);
    if (!image) throw new ApiError('not_found', missing);
    return { kind: 'bytes', mime: image.mime, bytes };
  }

  private async assertTrainee(traineeId: string): Promise<void> {
    if (!(await this.trainees.findById(traineeId))) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        traineeId: CHOOSE_TRAINEE,
      });
    }
  }

  private async assertProject(projectId: string, traineeId: string): Promise<void> {
    if (!(await this.projects.findById(projectId))) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        projectId: CHOOSE_PROJECT,
      });
    }
    const links = await this.projects.traineeIdsByProject([projectId]);
    const traineeIds = links.get(projectId) ?? [];
    if (traineeIds.length > 0 && !traineeIds.includes(traineeId)) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        projectId: PROJECT_FOR_TRAINEE,
      });
    }
  }

  private async requirePhoto(id: string, message: string): Promise<WorkPhotoEntity> {
    const row = await this.photos.findById(id);
    if (!row) throw new ApiError('not_found', message);
    return row;
  }

  private toRecord(row: WorkPhotoEntity): WorkPhotoRecord {
    return {
      id: row.id,
      traineeId: row.traineeId,
      projectId: row.projectId,
      src: row.src,
      width: row.width,
      height: row.height,
      alt: row.alt,
      caption: row.caption,
      publicationStatus: row.publicationStatus,
      listing: row.listing,
      storageProvider: row.storageProvider,
      uploadedBy: row.uploadedBy,
      updatedAt: isoTimestamp(row.updatedAt),
    };
  }

  private writeAudit(actor: Actor, verb: CurriculumVerb, id: string): Promise<void> {
    return this.audit.record({
      action: curriculumAuditAction('work_photo', verb),
      actorUserId: actor.userId,
      ip: actor.ip,
      requestId: actor.requestId,
      subjectType: 'work_photo',
      subjectId: id,
    });
  }
}

export function isPublicWorkPhoto(row: {
  publicationStatus: WorkPhotoEntity['publicationStatus'];
  listing: WorkPhotoEntity['listing'];
}): boolean {
  return isPublicRecord(row);
}

function cloudinaryUrl(src: string): string | undefined {
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function storageFailure(error: unknown): ApiError {
  const message = error instanceof Error ? error.message : '';
  if (message === 'Image storage is not configured.') {
    return new ApiError('server', 'Image storage is not configured.');
  }
  return new ApiError('server', 'The image could not be stored.');
}
