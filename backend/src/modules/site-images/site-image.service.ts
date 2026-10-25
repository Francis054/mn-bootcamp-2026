import type { AuditRepository } from '../auth/audit.repository.js';
import { curriculumAuditAction, type CurriculumVerb } from '../auth/audit-event.entity.js';
import { isoTimestamp, type Actor } from '../curriculum/actor.js';
import { readImage } from '../gallery/image-bytes.js';
import { imageSizeMessage } from '../gallery/media.rules.js';
import { storeProfilePhoto } from '../trainees/profile-photo.js';
import type { StorageProvider } from '../storage/storage-provider.js';
import { ApiError } from '../../shared/errors/api-error.js';
import { postgresCode } from '../../shared/persistence/postgres-error.js';
import {
  SITE_IMAGE_SLOTS,
  siteImageSeedRow,
  siteImageSlot,
  type SiteImageSlot,
} from './catalogue.js';
import { publicImageUrl } from './image-url.js';
import type { PublicSiteImage, SiteImageRecord } from './records.js';
import type { SiteImageEntity } from './site-image.entity.js';
import type { SiteImageRepository } from './site-image.repository.js';
import { siteImageAltMessage } from './site-image.rules.js';

const CHOOSE_IMAGE = 'Use a JPEG, PNG, or WebP image.';
const NOT_FOUND = 'Image slot not found.';
const ALREADY = 'That image slot already exists.';

export class SiteImageService {
  constructor(
    private readonly images: SiteImageRepository,
    private readonly audit: AuditRepository,
    private readonly storage: StorageProvider,
    private readonly maxBytes: number,
  ) {}

  async listPublic(): Promise<PublicSiteImage[]> {
    const stored = await this.byKey();
    return SITE_IMAGE_SLOTS.flatMap((slot) => {
      const row = stored.get(slot.key);
      return row ? [this.toPublic(row)] : [];
    });
  }

  async getPublic(key: string): Promise<PublicSiteImage> {
    return this.toPublic(await this.require(key));
  }

  async listAdmin(): Promise<SiteImageRecord[]> {
    const stored = await this.byKey();
    return SITE_IMAGE_SLOTS.flatMap((slot) => {
      const row = stored.get(slot.key);
      return row ? [this.toAdmin(row)] : [];
    });
  }

  async create(key: string, actor: Actor): Promise<SiteImageRecord> {
    const slot = siteImageSlot(key.trim());
    if (!slot) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        key: 'Choose a known image slot.',
      });
    }
    if (await this.images.findByKey(slot.key)) {
      throw new ApiError('validation', 'Check the highlighted fields.', { key: ALREADY });
    }
    let saved: SiteImageEntity;
    try {
      saved = await this.images.insert({ ...siteImageSeedRow(slot), updatedBy: actor.userId });
    } catch (error) {
      if (postgresCode(error) === '23505') {
        throw new ApiError('validation', 'Check the highlighted fields.', { key: ALREADY });
      }
      throw error;
    }
    await this.writeAudit(actor, 'created', saved.key);
    return this.toAdmin(saved);
  }

  async updateAlt(key: string, alt: string, actor: Actor): Promise<SiteImageRecord> {
    const problem = siteImageAltMessage(alt);
    if (problem) {
      throw new ApiError('validation', 'Check the highlighted fields.', { alt: problem });
    }
    const row = await this.require(key);
    row.alt = alt.trim();
    row.updatedBy = actor.userId;
    const saved = await this.images.save(row);
    await this.writeAudit(actor, 'updated', saved.key);
    return this.toAdmin(saved);
  }

  async replace(
    key: string,
    input: { bytes: Buffer; alt: string },
    actor: Actor,
  ): Promise<SiteImageRecord> {
    const altProblem = siteImageAltMessage(input.alt);
    if (altProblem) {
      throw new ApiError('validation', 'Check the highlighted fields.', { alt: altProblem });
    }
    const row = await this.require(key);
    if (input.bytes.length > this.maxBytes) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        file: imageSizeMessage(this.maxBytes),
      });
    }
    const image = readImage(input.bytes);
    if (!image) {
      throw new ApiError('validation', 'Check the highlighted fields.', { file: CHOOSE_IMAGE });
    }
    let stored: { photoUrl: string; storageKey: string };
    try {
      stored = await storeProfilePhoto(input.bytes, this.storage, this.maxBytes);
    } catch (error) {
      throw asFileError(error);
    }
    const previousKey = row.storageKey;
    const previousProvider = row.storageProvider;
    row.url = stored.photoUrl;
    row.storageKey = stored.storageKey;
    row.storageProvider = this.storage.name;
    row.width = image.width;
    row.height = image.height;
    row.alt = input.alt.trim();
    row.updatedBy = actor.userId;
    const saved = await this.images.save(row);
    if (previousKey && previousProvider !== 'static') {
      try {
        await this.storage.delete(previousKey);
      } catch {
        throw new ApiError(
          'server',
          'The new image is saved. The previous file could not be removed.',
        );
      }
    }
    await this.writeAudit(actor, 'updated', saved.key);
    return this.toAdmin(saved);
  }

  async reset(key: string, actor: Actor): Promise<SiteImageRecord> {
    const row = await this.require(key);
    if (isDefault(row)) return this.toAdmin(row);
    if (row.storageKey && row.storageProvider !== 'static') {
      try {
        await this.storage.delete(row.storageKey);
      } catch {
        throw new ApiError(
          'server',
          'The uploaded image could not be removed, so the original picture was left in place.',
        );
      }
    }
    row.url = row.defaultUrl;
    row.alt = row.defaultAlt;
    row.width = row.defaultWidth;
    row.height = row.defaultHeight;
    row.storageProvider = 'static';
    row.storageKey = '';
    row.updatedBy = actor.userId;
    const saved = await this.images.save(row);
    await this.writeAudit(actor, 'updated', saved.key);
    return this.toAdmin(saved);
  }

  private async byKey(): Promise<Map<string, SiteImageEntity>> {
    const rows = await this.images.findAll();
    return new Map(rows.map((row) => [row.key, row]));
  }

  private async require(key: string): Promise<SiteImageEntity> {
    const slot = siteImageSlot(key);
    if (!slot) throw new ApiError('not_found', NOT_FOUND);
    const row = await this.images.findByKey(slot.key);
    if (!row) throw new ApiError('not_found', NOT_FOUND);
    return row;
  }

  private toPublic(row: SiteImageEntity): PublicSiteImage {
    const slot = slotFor(row.key);
    return {
      key: row.key,
      label: row.label,
      description: row.description,
      url: this.displayUrl(row, slot),
      alt: row.alt.trim(),
      width: row.width,
      height: row.height,
      fit: row.fit === 'contain' ? 'contain' : 'cover',
      updatedAt: isoTimestamp(row.updatedAt),
    };
  }

  private toAdmin(row: SiteImageEntity): SiteImageRecord {
    return {
      ...this.toPublic(row),
      defaultUrl: publicImageUrl(row.defaultUrl) ?? slotFor(row.key).url,
      defaultAlt: row.defaultAlt,
      usingDefault: isDefault(row),
      updatedBy: row.updatedBy,
    };
  }

  private displayUrl(row: SiteImageEntity, slot: SiteImageSlot): string {
    return publicImageUrl(row.url) ?? publicImageUrl(row.defaultUrl) ?? slot.url;
  }

  private writeAudit(actor: Actor, verb: CurriculumVerb, key: string): Promise<void> {
    return this.audit.record({
      action: curriculumAuditAction('site_image', verb),
      actorUserId: actor.userId,
      ip: actor.ip,
      requestId: actor.requestId,
      subjectType: 'site_image',
      subjectId: key,
    });
  }
}

function slotFor(key: string): SiteImageSlot {
  const slot = siteImageSlot(key);
  if (!slot) {
    return {
      key,
      label: key,
      description: '',
      url: '',
      alt: '',
      width: 1,
      height: 1,
      fit: 'cover',
    };
  }
  return slot;
}

function isDefault(row: SiteImageEntity): boolean {
  return (
    row.storageKey === '' &&
    row.url === row.defaultUrl &&
    row.alt === row.defaultAlt &&
    row.width === row.defaultWidth &&
    row.height === row.defaultHeight
  );
}

function asFileError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    const photo = error.fieldErrors?.photoUrl;
    if (photo) return new ApiError(error.code, error.message, { file: photo });
    return error;
  }
  return new ApiError('server', 'The image could not be stored.');
}
