import { randomUUID } from 'node:crypto';
import type { AuditRepository } from '../auth/audit.repository.js';
import { curriculumAuditAction, type CurriculumVerb } from '../auth/audit-event.entity.js';
import { isoTimestamp, type Actor } from '../curriculum/actor.js';
import { readImage } from '../gallery/image-bytes.js';
import { imageSizeMessage } from '../gallery/media.rules.js';
import { publicImageUrl } from '../site-images/image-url.js';
import type { StorageProvider } from '../storage/storage-provider.js';
import { storeProfilePhoto } from '../trainees/profile-photo.js';
import { ApiError } from '../../shared/errors/api-error.js';
import type { AboutPersonEntity, AboutPersonGroup } from './about-person.entity.js';
import type { AboutPersonRepository } from './about-person.repository.js';
import { isAboutPersonGroup } from './about-person.rules.js';
import { toPublicAboutPerson, type AboutPersonRecord, type PublicAboutPerson } from './records.js';

const CHOOSE_IMAGE = 'Use a JPEG, PNG, or WebP image.';
const NOT_FOUND = 'That person was not found.';
const ORDER = 'Include each person in this group once.';
const REMOVE_FAILED = 'The photo could not be removed from storage. Try again.';

const GROUP_RANK: Record<AboutPersonGroup, number> = { founder: 0, team: 1, partner: 2 };

export interface AboutPersonWrite {
  group?: string;
  name?: string;
  title?: string;
  description?: string;
  displayOrder?: number;
  published?: boolean;
}

export class AboutPersonService {
  constructor(
    private readonly people: AboutPersonRepository,
    private readonly audit: AuditRepository,
    private readonly storage: StorageProvider,
    private readonly maxBytes: number,
  ) {}

  async listPublic(): Promise<PublicAboutPerson[]> {
    const rows = await this.people.findAll();
    return rows
      .filter((row) => row.published)
      .sort(byPlace)
      .map((row) => toPublicAboutPerson(this.toRecord(row)));
  }

  async listAdmin(): Promise<AboutPersonRecord[]> {
    const rows = await this.people.findAll();
    return rows.sort(byPlace).map((row) => this.toRecord(row));
  }

  async getAdmin(id: string): Promise<AboutPersonRecord> {
    return this.toRecord(await this.requirePerson(id));
  }

  async create(input: AboutPersonWrite, actor: Actor): Promise<AboutPersonRecord> {
    const group = this.readGroup(input.group);
    const name = this.readName(input.name);
    const nextOrder = input.displayOrder ?? (await this.people.findByGroup(group)).length;
    const saved = await this.people.insert({
      id: randomUUID(),
      group,
      name,
      title: trimOptional(input.title),
      description: trimOptional(input.description),
      photoUrl: '',
      photoStorageKey: '',
      storageProvider: 'memory',
      width: 0,
      height: 0,
      displayOrder: nextOrder,
      published: input.published === true,
      updatedBy: actor.userId,
    });
    await this.writeAudit(actor, 'created', saved.id);
    return this.toRecord(saved);
  }

  async update(id: string, input: AboutPersonWrite, actor: Actor): Promise<AboutPersonRecord> {
    const row = await this.requirePerson(id);
    const wasPublished = row.published;
    if (input.group !== undefined) row.group = this.readGroup(input.group);
    if (input.name !== undefined) row.name = this.readName(input.name);
    if (input.title !== undefined) row.title = trimOptional(input.title);
    if (input.description !== undefined) row.description = trimOptional(input.description);
    if (input.displayOrder !== undefined) row.displayOrder = input.displayOrder;
    if (input.published !== undefined) row.published = input.published;
    row.updatedBy = actor.userId;
    const saved = await this.people.save(row);
    await this.writeAudit(actor, publishVerb(wasPublished, input.published), saved.id);
    return this.toRecord(saved);
  }

  async replacePhoto(id: string, bytes: Buffer, actor: Actor): Promise<AboutPersonRecord> {
    const row = await this.requirePerson(id);
    if (bytes.length > this.maxBytes) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        file: imageSizeMessage(this.maxBytes),
      });
    }
    const image = readImage(bytes);
    if (!image) {
      throw new ApiError('validation', 'Check the highlighted fields.', { file: CHOOSE_IMAGE });
    }
    let stored: { photoUrl: string; storageKey: string };
    try {
      stored = await storeProfilePhoto(bytes, this.storage, this.maxBytes);
    } catch (error) {
      throw asFileError(error);
    }
    const previousKey = row.photoStorageKey;
    row.photoUrl = stored.photoUrl;
    row.photoStorageKey = stored.storageKey;
    row.storageProvider = this.storage.name;
    row.width = image.width;
    row.height = image.height;
    row.updatedBy = actor.userId;
    let saved: AboutPersonEntity;
    try {
      saved = await this.people.save(row);
    } catch (error) {
      try {
        await this.storage.delete(stored.storageKey);
      } catch {
        // The original save error is the one to show.
      }
      throw error;
    }
    if (previousKey && previousKey !== stored.storageKey) {
      try {
        await this.storage.delete(previousKey);
      } catch {
        throw new ApiError(
          'server',
          'The new photo is saved. The previous file could not be removed.',
        );
      }
    }
    await this.writeAudit(actor, 'updated', saved.id);
    return this.toRecord(saved);
  }

  async removePhoto(id: string, actor: Actor): Promise<AboutPersonRecord> {
    const row = await this.requirePerson(id);
    await this.deleteStored(row.photoStorageKey);
    row.photoUrl = '';
    row.photoStorageKey = '';
    row.storageProvider = 'memory';
    row.width = 0;
    row.height = 0;
    row.updatedBy = actor.userId;
    const saved = await this.people.save(row);
    await this.writeAudit(actor, 'updated', saved.id);
    return this.toRecord(saved);
  }

  async remove(id: string, actor: Actor): Promise<{ deleted: true; id: string }> {
    const row = await this.requirePerson(id);
    await this.deleteStored(row.photoStorageKey);
    await this.people.remove(row);
    await this.writeAudit(actor, 'deleted', id);
    return { deleted: true, id };
  }

  async reorder(groupValue: string, ids: string[], actor: Actor): Promise<AboutPersonRecord[]> {
    const group = this.readGroup(groupValue);
    const rows = await this.people.findByGroup(group);
    const current = new Set(rows.map((row) => row.id));
    if (ids.length !== rows.length || ids.some((id) => !current.has(id))) {
      throw new ApiError('validation', 'Check the highlighted fields.', { ids: ORDER });
    }
    for (const [index, id] of ids.entries()) {
      const row = rows.find((item) => item.id === id);
      if (!row) continue;
      row.displayOrder = index;
      row.updatedBy = actor.userId;
      await this.people.save(row);
    }
    await this.writeAudit(actor, 'updated', group);
    return this.listAdmin();
  }

  private readGroup(value: string | undefined): AboutPersonGroup {
    if (!value || !isAboutPersonGroup(value)) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        group: 'Choose Founder, Team, or Partners.',
      });
    }
    return value;
  }

  private readName(value: string | undefined): string {
    const name = value?.trim() ?? '';
    if (!name) {
      throw new ApiError('validation', 'Check the highlighted fields.', { name: 'Enter a name.' });
    }
    return name;
  }

  private async requirePerson(id: string): Promise<AboutPersonEntity> {
    const row = await this.people.findById(id);
    if (!row) throw new ApiError('not_found', NOT_FOUND);
    return row;
  }

  private async deleteStored(key: string): Promise<void> {
    if (!key) return;
    try {
      await this.storage.delete(key);
    } catch {
      throw new ApiError('server', REMOVE_FAILED);
    }
  }

  private toRecord(row: AboutPersonEntity): AboutPersonRecord {
    return {
      id: row.id,
      group: row.group,
      name: row.name,
      title: row.title,
      description: row.description,
      photoUrl: publicImageUrl(row.photoUrl) ?? null,
      width: row.width,
      height: row.height,
      displayOrder: row.displayOrder,
      published: row.published,
      updatedAt: isoTimestamp(row.updatedAt),
    };
  }

  private writeAudit(actor: Actor, verb: CurriculumVerb, id: string): Promise<void> {
    return this.audit.record({
      action: curriculumAuditAction('about_person', verb),
      actorUserId: actor.userId,
      ip: actor.ip,
      requestId: actor.requestId,
      subjectType: 'about_person',
      subjectId: id,
    });
  }
}

function trimOptional(value: string | undefined): string {
  return value?.trim() ?? '';
}

function publishVerb(wasPublished: boolean, next: boolean | undefined): CurriculumVerb {
  if (next === true && !wasPublished) return 'published';
  if (next === false && wasPublished) return 'unpublished';
  return 'updated';
}

function byPlace(left: AboutPersonEntity, right: AboutPersonEntity): number {
  const group = GROUP_RANK[left.group] - GROUP_RANK[right.group];
  if (group !== 0) return group;
  if (left.displayOrder !== right.displayOrder) return left.displayOrder - right.displayOrder;
  const name = left.name.localeCompare(right.name);
  if (name !== 0) return name;
  return left.id.localeCompare(right.id);
}

function asFileError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    const photo = error.fieldErrors?.photoUrl;
    if (photo) return new ApiError(error.code, error.message, { file: photo });
    return error;
  }
  return new ApiError('server', 'The image could not be stored.');
}
