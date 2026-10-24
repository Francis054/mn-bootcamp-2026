import { randomUUID } from 'node:crypto';
import type { AuditRepository } from '../auth/audit.repository.js';
import { curriculumAuditAction, type CurriculumVerb } from '../auth/audit-event.entity.js';
import type { Actor } from '../curriculum/actor.js';
import { isoTimestamp } from '../curriculum/actor.js';
import {
  isListing,
  isPublicationStatus,
  type Listing,
  type PublicationStatus,
} from '../curriculum/publication.js';
import { ApiError } from '../../shared/errors/api-error.js';
import type { StorageProvider } from '../storage/storage-provider.js';
import { readImage } from './image-bytes.js';
import type { MediaCreateDto, MediaPatchDto } from './media.dto.js';
import type { MediaConsent, MediaEntity } from './media.entity.js';
import type { MediaRepository } from './media.repository.js';
import {
  albumMessage,
  altMessage,
  captionMessage,
  imageSizeMessage,
  isAlbum,
  type AlbumId,
} from './media.rules.js';
import { toPublicMedia, type MediaRecord, type PublicMedia } from './records.js';

const VERIFY_FIRST = 'Verify consent before this photo can be published.';
const VERIFY_SEPARATE = 'Verifying consent does not publish the photo.';
const DELIVERY_FAILED =
  'Delivery removal failed. The photo is already off the public site. Try again.';
const CHOOSE_IMAGE = 'Use a JPEG, PNG, or WebP image.';

export class MediaService {
  constructor(
    private readonly media: MediaRepository,
    private readonly audit: AuditRepository,
    private readonly storage: StorageProvider,
    private readonly maxBytes: number,
    private readonly now: () => Date,
  ) {}

  async listPublic(): Promise<PublicMedia[]> {
    const rows = (await this.media.findAll()).filter(isPublicMedia);
    return rows.map((row) => toPublicMedia(this.toRecord(row)));
  }

  async getPublic(id: string): Promise<PublicMedia> {
    const row = await this.media.findById(id);
    if (!row || !isPublicMedia(row)) throw new ApiError('not_found', 'That page is not available.');
    return toPublicMedia(this.toRecord(row));
  }

  async listAdmin(): Promise<MediaRecord[]> {
    return (await this.media.findAll()).map((row) => this.toRecord(row));
  }

  async getAdmin(id: string): Promise<MediaRecord> {
    return this.toRecord(await this.requireMedia(id, 'Image not found.'));
  }

  async createMetadata(dto: MediaCreateDto, actor: Actor): Promise<MediaRecord> {
    const alt = dto.alt.trim();
    const saved = await this.media.insert({
      id: randomUUID(),
      file: dto.file?.trim() || 'upload',
      src: '',
      width: dto.width ?? 1600,
      height: dto.height ?? 1066,
      caption: dto.caption?.trim() || alt,
      alt,
      album: albumOr(dto.album, 'community'),
      consent: 'pending',
      consentVerifiedAt: null,
      consentRecordedBy: null,
      consentWithdrawnAt: null,
      publicationStatus: 'draft',
      listing: 'hidden',
      storageProvider: 'static',
      storageKey: '',
    });
    await this.writeAudit(actor, 'created', saved.id);
    return this.toRecord(saved);
  }

  async createUpload(
    input: { alt: string; caption: string; album: string; bytes: Buffer },
    actor: Actor,
  ): Promise<MediaRecord> {
    const problems: Record<string, string> = {};
    const altProblem = altMessage(input.alt);
    if (altProblem) problems.alt = altProblem;
    if (input.caption !== '' && captionMessage(input.caption)) {
      const caption = captionMessage(input.caption);
      if (caption) problems.caption = caption;
    }
    if (input.album !== '' && albumMessage(input.album)) {
      const album = albumMessage(input.album);
      if (album) problems.album = album;
    }
    if (input.bytes.length > this.maxBytes) problems.file = imageSizeMessage(this.maxBytes);
    const image = input.bytes.length > this.maxBytes ? undefined : readImage(input.bytes);
    if (!problems.file && !image) problems.file = CHOOSE_IMAGE;
    if (Object.keys(problems).length > 0 || !image) {
      throw new ApiError('validation', 'Check the highlighted fields.', problems);
    }
    const alt = input.alt.trim();
    let stored: { key: string; publicUrl: string };
    try {
      stored = await this.storage.put({ bytes: input.bytes, mime: image.mime });
    } catch (error) {
      throw storageFailure(error);
    }
    const saved = await this.media.insert({
      id: randomUUID(),
      file: 'upload',
      src: stored.publicUrl,
      width: image.width,
      height: image.height,
      caption: input.caption.trim() || alt,
      alt,
      album: albumOr(input.album, 'community'),
      consent: 'pending',
      consentVerifiedAt: null,
      consentRecordedBy: null,
      consentWithdrawnAt: null,
      publicationStatus: 'draft',
      listing: 'hidden',
      storageProvider: this.storage.name,
      storageKey: stored.key,
    });
    await this.writeAudit(actor, 'created', saved.id);
    return this.toRecord(saved);
  }

  async update(id: string, patch: MediaPatchDto, actor: Actor): Promise<MediaRecord> {
    const current = await this.requireMedia(id, 'Image not found.');
    const verifying = patch.consent === 'verified' && current.consent !== 'verified';
    if (verifying && patch.publicationStatus === 'published') {
      throw new ApiError('validation', VERIFY_SEPARATE, { publicationStatus: VERIFY_SEPARATE });
    }
    if (patch.consent === 'pending' && current.publicationStatus === 'published') {
      throw new ApiError('validation', 'Withdraw consent to take this photo off the public site.', {
        consent: 'Withdraw consent to take this photo off the public site.',
      });
    }
    if (patch.alt !== undefined) current.alt = patch.alt.trim();
    if (patch.caption !== undefined) current.caption = patch.caption.trim() || current.alt;
    if (patch.album !== undefined) current.album = albumOr(patch.album, current.album);
    if (patch.listing !== undefined) current.listing = listingOr(patch.listing, current.listing);
    if (verifying) {
      current.consent = 'verified';
      current.consentVerifiedAt = this.now();
      current.consentRecordedBy = actor.userId;
      current.consentWithdrawnAt = null;
    } else if (patch.consent === 'pending') {
      current.consent = 'pending';
    }
    let verb: CurriculumVerb = 'updated';
    if (patch.publicationStatus === 'published') {
      if (current.consent !== 'verified') {
        throw new ApiError('validation', VERIFY_FIRST, { publicationStatus: VERIFY_FIRST });
      }
      if (current.publicationStatus !== 'published') {
        current.publicationStatus = 'published';
        verb = 'published';
      }
    } else if (patch.publicationStatus !== undefined) {
      const next = statusOr(patch.publicationStatus, current.publicationStatus);
      if (current.publicationStatus === 'published' && next !== 'published') verb = 'unpublished';
      current.publicationStatus = next;
    }
    const saved = await this.media.save(current);
    await this.writeAudit(actor, verb, saved.id);
    return this.toRecord(saved);
  }

  async publish(id: string, actor: Actor): Promise<MediaRecord> {
    const current = await this.requireMedia(id, 'Image not found.');
    if (current.consent !== 'verified') throw new ApiError('validation', VERIFY_FIRST);
    if (current.publicationStatus !== 'published') {
      current.publicationStatus = 'published';
      await this.media.save(current);
      await this.writeAudit(actor, 'published', current.id);
    }
    return this.toRecord(current);
  }

  async unpublish(id: string, actor: Actor): Promise<MediaRecord> {
    const current = await this.requireMedia(id, 'Image not found.');
    if (current.publicationStatus !== 'draft') {
      current.publicationStatus = 'draft';
      await this.media.save(current);
      await this.writeAudit(actor, 'unpublished', current.id);
    }
    return this.toRecord(current);
  }

  async withdraw(id: string, actor: Actor): Promise<MediaRecord> {
    const current = await this.requireMedia(id, 'Image not found.');
    current.consent = 'withdrawn';
    current.consentWithdrawnAt = this.now();
    current.publicationStatus = 'draft';
    current.listing = 'hidden';
    current.src = '';
    await this.media.save(current);
    await this.writeAudit(actor, 'unpublished', current.id);
    if (keepsBytes(current)) return this.toRecord(current);
    try {
      await this.storage.delete(current.storageKey);
    } catch {
      throw new ApiError('server', DELIVERY_FAILED);
    }
    current.storageKey = '';
    const saved = await this.media.save(current);
    return this.toRecord(saved);
  }

  async remove(id: string, actor: Actor): Promise<{ deleted: true; id: string }> {
    const current = await this.requireMedia(id, 'Record not found.');
    if (!keepsBytes(current)) {
      try {
        await this.storage.delete(current.storageKey);
      } catch {
        throw new ApiError('server', DELIVERY_FAILED);
      }
    }
    await this.media.remove(current);
    await this.writeAudit(actor, 'deleted', id);
    return { deleted: true, id };
  }

  private async requireMedia(id: string, message: string): Promise<MediaEntity> {
    const row = await this.media.findById(id);
    if (!row) throw new ApiError('not_found', message);
    return row;
  }

  private toRecord(row: MediaEntity): MediaRecord {
    return {
      id: row.id,
      file: row.file,
      src: row.src,
      width: row.width,
      height: row.height,
      caption: row.caption,
      alt: row.alt,
      album: row.album,
      consent: row.consent,
      consentVerifiedAt: stamp(row.consentVerifiedAt),
      consentRecordedBy: row.consentRecordedBy,
      consentWithdrawnAt: stamp(row.consentWithdrawnAt),
      publicationStatus: row.publicationStatus,
      listing: row.listing,
      storageProvider: row.storageProvider,
      updatedAt: isoTimestamp(row.updatedAt),
    };
  }

  private writeAudit(actor: Actor, verb: CurriculumVerb, id: string): Promise<void> {
    return this.audit.record({
      action: curriculumAuditAction('media', verb),
      actorUserId: actor.userId,
      ip: actor.ip,
      requestId: actor.requestId,
      subjectType: 'media',
      subjectId: id,
    });
  }
}

export function isPublicMedia(row: {
  publicationStatus: PublicationStatus;
  listing: Listing;
  consent: MediaConsent;
}): boolean {
  return (
    row.publicationStatus === 'published' && row.listing !== 'hidden' && row.consent === 'verified'
  );
}

function keepsBytes(row: MediaEntity): boolean {
  return row.storageProvider === 'static' || row.storageKey === '';
}

function albumOr(value: string | undefined, fallback: string): AlbumId {
  const album = value?.trim();
  if (album && isAlbum(album)) return album;
  if (isAlbum(fallback)) return fallback;
  return 'community';
}

function statusOr(value: string, fallback: PublicationStatus): PublicationStatus {
  if (isPublicationStatus(value)) return value;
  return fallback;
}

function listingOr(value: string, fallback: Listing): Listing {
  if (isListing(value)) return value;
  return fallback;
}

function stamp(value: Date | null): string | null {
  return value ? isoTimestamp(value) : null;
}

function storageFailure(error: unknown): ApiError {
  const message = error instanceof Error ? error.message : '';
  if (message === 'Image storage is not configured.') {
    return new ApiError('server', 'Image storage is not configured.');
  }
  return new ApiError('server', 'The image could not be stored.');
}
