import type { AuditRepository } from '../auth/audit.repository.js';
import {
  curriculumAuditAction,
  type CurriculumKind,
  type CurriculumVerb,
} from '../auth/audit-event.entity.js';
import { ApiError } from '../../shared/errors/api-error.js';
import { postgresCode } from '../../shared/persistence/postgres-error.js';
import type { Actor } from './actor.js';
import { isoTimestamp } from './actor.js';
import type {
  ModulePatchDto,
  ModuleWriteDto,
  PhasePatchDto,
  PhaseWriteDto,
  TrackPatchDto,
  TrackWriteDto,
} from './catalogue.dto.js';
import type { ModuleEntity } from './module.entity.js';
import type { PhaseEntity } from './phase.entity.js';
import type { TrackEntity } from './track.entity.js';
import {
  isListing,
  isPublicationStatus,
  isPublicRecord,
  type Listing,
  type PublicationStatus,
} from './publication.js';
import type {
  LessonRepository,
  ModuleRepository,
  PhaseRepository,
  TrackRepository,
} from './repositories.js';
import type {
  ModuleRecord,
  PhaseRecord,
  PublicModule,
  PublicPhase,
  PublicTrack,
  TrackRecord,
} from './records.js';
import { isCatalogueId, slugify } from './slug.js';

interface TraineeModuleUse {
  countByModule(moduleId: string): Promise<number>;
}

/**
 * Tracks, modules, and phases. Lessons live in `LessonService` because their
 * rules and the class form are a different shape.
 */
export class CatalogueService {
  constructor(
    private readonly tracks: TrackRepository,
    private readonly modules: ModuleRepository,
    private readonly phases: PhaseRepository,
    private readonly lessons: LessonRepository,
    private readonly trainees: TraineeModuleUse,
    private readonly audit: AuditRepository,
  ) {}

  async listPublicTracks(): Promise<PublicTrack[]> {
    const rows = await this.tracks.findAll();
    return rows.filter(isPublicRecord).map(toPublicTrack);
  }

  async getPublicTrack(id: string): Promise<PublicTrack> {
    const row = await this.tracks.findById(id);
    if (!row || !isPublicRecord(row))
      throw new ApiError('not_found', 'That page is not available.');
    return toPublicTrack(row);
  }

  listTracks(): Promise<TrackRecord[]> {
    return this.tracks.findAll().then((rows) => rows.map(toTrack));
  }

  async getTrack(id: string): Promise<TrackRecord> {
    return toTrack(await this.requireTrack(id));
  }

  async createTrack(dto: TrackWriteDto, actor: Actor): Promise<TrackRecord> {
    const name = dto.name.trim();
    const id = (dto.id?.trim() || slugify(name)).slice(0, 40);
    if (!isCatalogueId(id)) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        id: 'Use a short id made of lowercase letters, numbers, and hyphens.',
      });
    }
    if (await this.tracks.findById(id)) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        id: 'A track with that id already exists.',
      });
    }
    if (await this.tracks.findByName(name)) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        name: 'A track with that name already exists.',
      });
    }
    const saved = await this.insertTrack({
      id,
      name,
      summary: dto.summary.trim(),
      sortOrder: dto.sortOrder ?? 0,
      publicationStatus: statusOr(dto.publicationStatus, 'draft'),
      listing: listingOr(dto.listing, 'hidden'),
    });
    await this.writeAudit(actor, 'track', 'created', saved.id);
    return toTrack(saved);
  }

  async updateTrack(id: string, patch: TrackPatchDto, actor: Actor): Promise<TrackRecord> {
    const current = await this.requireTrack(id);
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      const other = await this.tracks.findByName(name);
      if (other && other.id !== current.id) {
        throw new ApiError('validation', 'Check the highlighted fields.', {
          name: 'A track with that name already exists.',
        });
      }
      current.name = name;
    }
    if (patch.summary !== undefined) current.summary = patch.summary.trim();
    if (patch.sortOrder !== undefined) current.sortOrder = patch.sortOrder;
    if (patch.publicationStatus !== undefined) {
      current.publicationStatus = statusOr(patch.publicationStatus, current.publicationStatus);
    }
    if (patch.listing !== undefined) current.listing = listingOr(patch.listing, current.listing);
    const saved = await this.tracks.save(current);
    await this.writeAudit(actor, 'track', 'updated', saved.id);
    return toTrack(saved);
  }

  publishTrack(id: string, actor: Actor): Promise<TrackRecord> {
    return this.setTrackStatus(id, 'published', 'published', actor);
  }

  unpublishTrack(id: string, actor: Actor): Promise<TrackRecord> {
    return this.setTrackStatus(id, 'draft', 'unpublished', actor);
  }

  async deleteTrack(id: string, actor: Actor): Promise<{ deleted: true; id: string }> {
    const current = await this.requireTrack(id);
    await this.tracks.remove(current);
    await this.writeAudit(actor, 'track', 'deleted', id);
    return { deleted: true, id };
  }

  async listPublicModules(): Promise<PublicModule[]> {
    const rows = await this.modules.findAll();
    return rows.filter(isPublicRecord).map(toPublicModule);
  }

  async getPublicModule(id: string): Promise<PublicModule> {
    const row = await this.modules.findById(id);
    if (!row || !isPublicRecord(row))
      throw new ApiError('not_found', 'That page is not available.');
    return toPublicModule(row);
  }

  listModules(): Promise<ModuleRecord[]> {
    return this.modules.findAll().then((rows) => rows.map(toModule));
  }

  async getModule(id: string): Promise<ModuleRecord> {
    return toModule(await this.requireModule(id));
  }

  async createModule(dto: ModuleWriteDto, actor: Actor): Promise<ModuleRecord> {
    const name = dto.name.trim();
    const id = (dto.id?.trim() || slugify(name)).slice(0, 40);
    if (!isCatalogueId(id)) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        id: 'Use a short id made of lowercase letters, numbers, and hyphens.',
      });
    }
    if (await this.modules.findById(id)) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        id: 'A module with that id already exists.',
      });
    }
    if (await this.modules.findByName(name)) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        name: 'A module with that name already exists.',
      });
    }
    const saved = await this.insertModule({
      id,
      name,
      short: dto.short.trim(),
      icon: dto.icon.trim(),
      summary: dto.summary.trim(),
      sortOrder: dto.sortOrder ?? 0,
      publicationStatus: statusOr(dto.publicationStatus, 'draft'),
      listing: listingOr(dto.listing, 'hidden'),
    });
    await this.writeAudit(actor, 'module', 'created', saved.id);
    return toModule(saved);
  }

  async updateModule(id: string, patch: ModulePatchDto, actor: Actor): Promise<ModuleRecord> {
    const current = await this.requireModule(id);
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      const other = await this.modules.findByName(name);
      if (other && other.id !== current.id) {
        throw new ApiError('validation', 'Check the highlighted fields.', {
          name: 'A module with that name already exists.',
        });
      }
      current.name = name;
    }
    if (patch.short !== undefined) current.short = patch.short.trim();
    if (patch.icon !== undefined) current.icon = patch.icon.trim();
    if (patch.summary !== undefined) current.summary = patch.summary.trim();
    if (patch.sortOrder !== undefined) current.sortOrder = patch.sortOrder;
    if (patch.publicationStatus !== undefined) {
      current.publicationStatus = statusOr(patch.publicationStatus, current.publicationStatus);
    }
    if (patch.listing !== undefined) current.listing = listingOr(patch.listing, current.listing);
    const saved = await this.modules.save(current);
    await this.writeAudit(actor, 'module', 'updated', saved.id);
    return toModule(saved);
  }

  publishModule(id: string, actor: Actor): Promise<ModuleRecord> {
    return this.setModuleStatus(id, 'published', 'published', actor);
  }

  unpublishModule(id: string, actor: Actor): Promise<ModuleRecord> {
    return this.setModuleStatus(id, 'draft', 'unpublished', actor);
  }

  async deleteModule(id: string, actor: Actor): Promise<{ deleted: true; id: string }> {
    const current = await this.requireModule(id);
    if ((await this.lessons.countByModule(id)) > 0) {
      throw new ApiError(
        'validation',
        'That module still has classes. Move or delete those classes first.',
      );
    }
    if ((await this.trainees.countByModule(id)) > 0) {
      throw new ApiError(
        'validation',
        'That module still has trainee profiles. Move or delete those profiles first.',
      );
    }
    const phases = await this.phases.findAll();
    if (phases.some((phase) => phase.moduleIds.includes(id))) {
      throw new ApiError(
        'validation',
        'That module is still listed on a phase. Remove it there first.',
      );
    }
    await this.modules.remove(current);
    await this.writeAudit(actor, 'module', 'deleted', id);
    return { deleted: true, id };
  }

  async listPublicPhases(): Promise<PublicPhase[]> {
    const [phases, modules] = await Promise.all([this.phases.findAll(), this.modules.findAll()]);
    return phases.filter(isPublicRecord).map((phase) => toPublicPhase(phase, modules));
  }

  async getPublicPhase(id: number): Promise<PublicPhase> {
    const phase = await this.phases.findById(id);
    if (!phase || !isPublicRecord(phase)) {
      throw new ApiError('not_found', 'That page is not available.');
    }
    const modules = await this.modules.findAll();
    return toPublicPhase(phase, modules);
  }

  async listPhases(): Promise<PhaseRecord[]> {
    const [phases, modules] = await Promise.all([this.phases.findAll(), this.modules.findAll()]);
    return phases.map((phase) => toPhase(phase, modules));
  }

  async getPhase(id: number): Promise<PhaseRecord> {
    const phase = await this.requirePhase(id);
    const modules = await this.modules.findAll();
    return toPhase(phase, modules);
  }

  async createPhase(dto: PhaseWriteDto, actor: Actor): Promise<PhaseRecord> {
    if (await this.phases.findById(dto.id)) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        id: 'A phase with that number already exists.',
      });
    }
    await this.assertModules(dto.moduleIds);
    const saved = await this.insertPhase({
      id: dto.id,
      name: dto.name.trim(),
      months: dto.months.trim(),
      summary: dto.summary.trim(),
      moduleIds: uniqueIds(dto.moduleIds),
      publicationStatus: statusOr(dto.publicationStatus, 'draft'),
      listing: listingOr(dto.listing, 'hidden'),
    });
    await this.writeAudit(actor, 'phase', 'created', String(saved.id));
    const modules = await this.modules.findAll();
    return toPhase(saved, modules);
  }

  async updatePhase(id: number, patch: PhasePatchDto, actor: Actor): Promise<PhaseRecord> {
    const current = await this.requirePhase(id);
    if (patch.name !== undefined) current.name = patch.name.trim();
    if (patch.months !== undefined) current.months = patch.months.trim();
    if (patch.summary !== undefined) current.summary = patch.summary.trim();
    if (patch.moduleIds !== undefined) {
      await this.assertModules(patch.moduleIds);
      current.moduleIds = uniqueIds(patch.moduleIds);
    }
    if (patch.publicationStatus !== undefined) {
      current.publicationStatus = statusOr(patch.publicationStatus, current.publicationStatus);
    }
    if (patch.listing !== undefined) current.listing = listingOr(patch.listing, current.listing);
    const saved = await this.phases.save(current);
    await this.writeAudit(actor, 'phase', 'updated', String(saved.id));
    const modules = await this.modules.findAll();
    return toPhase(saved, modules);
  }

  async publishPhase(id: number, actor: Actor): Promise<PhaseRecord> {
    return this.setPhaseStatus(id, 'published', 'published', actor);
  }

  async unpublishPhase(id: number, actor: Actor): Promise<PhaseRecord> {
    return this.setPhaseStatus(id, 'draft', 'unpublished', actor);
  }

  async deletePhase(id: number, actor: Actor): Promise<{ deleted: true; id: number }> {
    const current = await this.requirePhase(id);
    if ((await this.lessons.countByPhase(id)) > 0) {
      throw new ApiError(
        'validation',
        'That phase still has classes. Move or delete those classes first.',
      );
    }
    await this.phases.remove(current);
    await this.writeAudit(actor, 'phase', 'deleted', String(id));
    return { deleted: true, id };
  }

  private async setTrackStatus(
    id: string,
    status: PublicationStatus,
    verb: CurriculumVerb,
    actor: Actor,
  ): Promise<TrackRecord> {
    const current = await this.requireTrack(id);
    if (current.publicationStatus !== status) {
      current.publicationStatus = status;
      await this.tracks.save(current);
      await this.writeAudit(actor, 'track', verb, id);
    }
    return toTrack(current);
  }

  private async setModuleStatus(
    id: string,
    status: PublicationStatus,
    verb: CurriculumVerb,
    actor: Actor,
  ): Promise<ModuleRecord> {
    const current = await this.requireModule(id);
    if (current.publicationStatus !== status) {
      current.publicationStatus = status;
      await this.modules.save(current);
      await this.writeAudit(actor, 'module', verb, id);
    }
    return toModule(current);
  }

  private async setPhaseStatus(
    id: number,
    status: PublicationStatus,
    verb: CurriculumVerb,
    actor: Actor,
  ): Promise<PhaseRecord> {
    const current = await this.requirePhase(id);
    if (current.publicationStatus !== status) {
      current.publicationStatus = status;
      await this.phases.save(current);
      await this.writeAudit(actor, 'phase', verb, String(id));
    }
    const modules = await this.modules.findAll();
    return toPhase(current, modules);
  }

  private async requireTrack(id: string): Promise<TrackEntity> {
    const row = await this.tracks.findById(id);
    if (!row) throw new ApiError('not_found', 'Track not found.');
    return row;
  }

  private async requireModule(id: string): Promise<ModuleEntity> {
    const row = await this.modules.findById(id);
    if (!row) throw new ApiError('not_found', 'Module not found.');
    return row;
  }

  private async requirePhase(id: number): Promise<PhaseEntity> {
    const row = await this.phases.findById(id);
    if (!row) throw new ApiError('not_found', 'Phase not found.');
    return row;
  }

  private async assertModules(ids: string[]): Promise<void> {
    const modules = await this.modules.findAll();
    const known = new Set(modules.map((module) => module.id));
    if (ids.some((id) => !known.has(id))) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        moduleIds: 'Choose a module that exists.',
      });
    }
  }

  private async insertTrack(
    input: Omit<TrackEntity, 'createdAt' | 'updatedAt'>,
  ): Promise<TrackEntity> {
    try {
      return await this.tracks.insert(input);
    } catch (error) {
      throw mappedUnique(error, 'A track with that id already exists.');
    }
  }

  private async insertModule(
    input: Omit<ModuleEntity, 'createdAt' | 'updatedAt'>,
  ): Promise<ModuleEntity> {
    try {
      return await this.modules.insert(input);
    } catch (error) {
      throw mappedUnique(error, 'A module with that id already exists.');
    }
  }

  private async insertPhase(
    input: Omit<PhaseEntity, 'createdAt' | 'updatedAt'>,
  ): Promise<PhaseEntity> {
    try {
      return await this.phases.insert(input);
    } catch (error) {
      throw mappedUnique(error, 'A phase with that number already exists.');
    }
  }

  private writeAudit(
    actor: Actor,
    kind: CurriculumKind,
    verb: CurriculumVerb,
    id: string,
  ): Promise<void> {
    return this.audit.record({
      action: curriculumAuditAction(kind, verb),
      actorUserId: actor.userId,
      ip: actor.ip,
      requestId: actor.requestId,
      subjectType: kind,
      subjectId: id,
    });
  }
}

function mappedUnique(error: unknown, message: string): unknown {
  if (postgresCode(error) === '23505') {
    return new ApiError('validation', 'Check the highlighted fields.', { id: message });
  }
  return error;
}

function statusOr(value: string | undefined, fallback: PublicationStatus): PublicationStatus {
  if (value && isPublicationStatus(value)) return value;
  return fallback;
}

function listingOr(value: string | undefined, fallback: Listing): Listing {
  if (value && isListing(value)) return value;
  return fallback;
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function toTrack(row: TrackEntity): TrackRecord {
  return {
    id: row.id,
    name: row.name,
    summary: row.summary,
    sortOrder: row.sortOrder,
    publicationStatus: row.publicationStatus,
    listing: row.listing,
    updatedAt: isoTimestamp(row.updatedAt),
  };
}

function toPublicTrack(row: TrackEntity): PublicTrack {
  return { id: row.id, name: row.name, summary: row.summary };
}

function toModule(row: ModuleEntity): ModuleRecord {
  return {
    id: row.id,
    name: row.name,
    short: row.short,
    icon: row.icon,
    summary: row.summary,
    sortOrder: row.sortOrder,
    publicationStatus: row.publicationStatus,
    listing: row.listing,
    updatedAt: isoTimestamp(row.updatedAt),
  };
}

function toPublicModule(row: ModuleEntity): PublicModule {
  return {
    id: row.id,
    name: row.name,
    short: row.short,
    icon: row.icon,
    summary: row.summary,
  };
}

function toPhase(row: PhaseEntity, modules: ModuleEntity[]): PhaseRecord {
  return {
    id: row.id,
    name: row.name,
    months: row.months,
    summary: row.summary,
    moduleIds: [...row.moduleIds],
    modules: namesFor(row.moduleIds, modules, false),
    publicationStatus: row.publicationStatus,
    listing: row.listing,
    updatedAt: isoTimestamp(row.updatedAt),
  };
}

function toPublicPhase(row: PhaseEntity, modules: ModuleEntity[]): PublicPhase {
  return {
    id: row.id,
    name: row.name,
    months: row.months,
    summary: row.summary,
    modules: namesFor(row.moduleIds, modules, true),
  };
}

function namesFor(ids: string[], modules: ModuleEntity[], publicly: boolean): string[] {
  const byId = new Map(modules.map((module) => [module.id, module]));
  const names: string[] = [];
  for (const id of ids) {
    const module = byId.get(id);
    if (!module) continue;
    if (publicly && !isPublicRecord(module)) continue;
    names.push(module.name);
  }
  return names;
}
