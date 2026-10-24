import { randomUUID } from 'node:crypto';
import type { AuditRepository } from '../auth/audit.repository.js';
import { curriculumAuditAction, type CurriculumVerb } from '../auth/audit-event.entity.js';
import { ApiError } from '../../shared/errors/api-error.js';
import type { Actor } from './actor.js';
import { isoTimestamp } from './actor.js';
import type { BulkClassesDto } from './catalogue.dto.js';
import type { LessonEntity } from './lesson.entity.js';
import type { LessonCreateDto, LessonPatchDto } from './lesson.dto.js';
import { lessonFieldErrors } from './lesson.rules.js';
import type { LessonListQuery, LessonSort } from './list-query.js';
import { pageOf, type Page } from './page.js';
import {
  isListing,
  isPublicationStatus,
  isPublicRecord,
  type Listing,
  type PublicationStatus,
} from './publication.js';
import type { LessonRepository, ModuleRepository, PhaseRepository } from './repositories.js';
import { toPublicLesson, type LessonRecord, type PublicLesson } from './records.js';
import { phaseForWeek, scheduleFor } from './schedule.js';
import { slugify } from './slug.js';

export class LessonService {
  constructor(
    private readonly lessons: LessonRepository,
    private readonly modules: ModuleRepository,
    private readonly phases: PhaseRepository,
    private readonly audit: AuditRepository,
    private readonly today: () => string,
  ) {}

  async listPublic(): Promise<PublicLesson[]> {
    const rows = await this.lessons.findAll();
    return rows
      .map((row) => this.toRecord(row))
      .filter(isPublicRecord)
      .map(toPublicLesson);
  }

  async getPublic(id: string): Promise<PublicLesson> {
    const row = await this.lessons.findById(id);
    if (!row) throw new ApiError('not_found', 'That page is not available.');
    const lesson = this.toRecord(row);
    if (!isPublicRecord(lesson)) throw new ApiError('not_found', 'That page is not available.');
    return toPublicLesson(lesson);
  }

  async listAdmin(query: LessonListQuery): Promise<Page<LessonRecord>> {
    let rows = (await this.lessons.findAll()).map((row) => this.toRecord(row));
    const needle = query.q.toLowerCase();
    if (needle) {
      rows = rows.filter((lesson) =>
        `${lesson.title} ${lesson.moduleId} ${lesson.summary}`.toLowerCase().includes(needle),
      );
    }
    if (query.filters.moduleId) {
      const moduleId = query.filters.moduleId;
      rows = rows.filter((lesson) => lesson.moduleId === moduleId);
    }
    if (query.filters.scheduleStatus) {
      const scheduleStatus = query.filters.scheduleStatus;
      rows = rows.filter((lesson) => lesson.scheduleStatus === scheduleStatus);
    }
    if (query.filters.publicationStatus) {
      const publicationStatus = query.filters.publicationStatus;
      rows = rows.filter((lesson) => lesson.publicationStatus === publicationStatus);
    }
    const sort = query.sort ?? 'week';
    const factor = query.dir === 'desc' ? -1 : 1;
    rows.sort((left, right) => compareLessons(left, right, sort) * factor);
    return pageOf(rows, query.page, query.pageSize);
  }

  async getAdmin(id: string): Promise<LessonRecord> {
    return this.toRecord(await this.requireLesson(id, 'Class not found.'));
  }

  async create(dto: LessonCreateDto, actor: Actor): Promise<LessonRecord> {
    const title = dto.title.trim();
    const moduleId = dto.moduleId.trim();
    const date = dto.date.trim();
    const summary = dto.summary.trim();
    const slug = this.slugFor(dto.slug, title);
    if (!slug) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        slug: 'Use a title that can become a link.',
      });
    }
    const phase = phaseForWeek(dto.week);
    await this.assertModule(moduleId);
    await this.assertPhase(phase);
    const saved = await this.lessons.insert({
      id: randomUUID(),
      week: dto.week,
      moduleId,
      title,
      slug,
      classDate: date,
      format: dto.format?.trim() || 'Lecture + lab',
      phase,
      publicationStatus: statusOr(dto.publicationStatus, 'draft'),
      listing: listingOr(dto.listing, 'hidden'),
      room: dto.room?.trim() ?? '',
      summary,
      objectives: dto.objectives ?? [],
      lab: dto.lab ?? '',
      codeSample: dto.codeSample ?? '',
      cover: dto.cover?.trim() || 'electronics-lab',
      internalNotes: dto.internalNotes ?? '',
    });
    await this.writeAudit(actor, 'created', saved.id);
    return this.toRecord(saved);
  }

  async update(id: string, patch: LessonPatchDto, actor: Actor): Promise<LessonRecord> {
    const current = await this.requireLesson(id, 'Class not found.');
    const title = patch.title?.trim() ?? current.title;
    const moduleId = patch.moduleId?.trim() ?? current.moduleId;
    const week = patch.week ?? current.week;
    const date = patch.date?.trim() ?? current.classDate;
    const summary = patch.summary?.trim() ?? current.summary;
    const slug = patch.slug !== undefined ? this.slugFor(patch.slug, title) : current.slug;
    const errors = lessonFieldErrors({
      title,
      moduleId,
      week,
      date,
      summary,
      slug,
      format: patch.format ?? current.format,
      room: patch.room ?? current.room,
      objectives: patch.objectives ?? current.objectives,
      lab: patch.lab ?? current.lab,
      codeSample: patch.codeSample ?? current.codeSample,
      cover: patch.cover ?? current.cover,
      internalNotes: patch.internalNotes ?? current.internalNotes,
      publicationStatus: patch.publicationStatus ?? current.publicationStatus,
      listing: patch.listing ?? current.listing,
    });
    if (!slug) errors.slug = 'Use a title that can become a link.';
    if (Object.keys(errors).length > 0) {
      throw new ApiError('validation', 'Check the highlighted fields.', errors);
    }
    const phase = phaseForWeek(week);
    await this.assertModule(moduleId);
    await this.assertPhase(phase);
    current.title = title;
    current.moduleId = moduleId;
    current.week = week;
    current.classDate = date;
    current.summary = summary;
    current.slug = slug;
    current.format = (patch.format ?? current.format).trim() || 'Lecture + lab';
    current.room = patch.room ?? current.room;
    current.objectives = patch.objectives ?? current.objectives;
    current.lab = patch.lab ?? current.lab;
    current.codeSample = patch.codeSample ?? current.codeSample;
    current.cover = (patch.cover ?? current.cover).trim() || 'electronics-lab';
    current.internalNotes = patch.internalNotes ?? current.internalNotes;
    current.publicationStatus = statusOr(patch.publicationStatus, current.publicationStatus);
    current.listing = listingOr(patch.listing, current.listing);
    current.phase = phase;
    const saved = await this.lessons.save(current);
    await this.writeAudit(actor, 'updated', saved.id);
    return this.toRecord(saved);
  }

  async publish(id: string, actor: Actor): Promise<LessonRecord> {
    const current = await this.requireLesson(id, 'Class not found.');
    if (current.publicationStatus !== 'published') {
      current.publicationStatus = 'published';
      await this.lessons.save(current);
      await this.writeAudit(actor, 'published', current.id);
    }
    return this.toRecord(current);
  }

  async unpublish(id: string, actor: Actor): Promise<LessonRecord> {
    const current = await this.requireLesson(id, 'Class not found.');
    if (current.publicationStatus !== 'draft') {
      current.publicationStatus = 'draft';
      await this.lessons.save(current);
      await this.writeAudit(actor, 'unpublished', current.id);
    }
    return this.toRecord(current);
  }

  async remove(id: string, actor: Actor): Promise<{ deleted: true; id: string }> {
    const current = await this.requireLesson(id, 'Record not found.');
    await this.lessons.remove(current);
    await this.writeAudit(actor, 'deleted', id);
    return { deleted: true, id };
  }

  async bulk(
    dto: BulkClassesDto,
    actor: Actor,
  ): Promise<{ ok: true; action: 'publish' | 'delete'; count: number; rejected: string[] }> {
    const rejected: string[] = [];
    const seen = new Set<string>();
    let count = 0;
    for (const id of dto.ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const current = await this.lessons.findById(id);
      if (!current) {
        rejected.push(id);
        continue;
      }
      if (dto.action === 'delete') {
        await this.lessons.remove(current);
        await this.writeAudit(actor, 'deleted', id);
      } else if (current.publicationStatus !== 'published') {
        current.publicationStatus = 'published';
        await this.lessons.save(current);
        await this.writeAudit(actor, 'published', id);
      }
      count += 1;
    }
    return { ok: true, action: dto.action, count, rejected };
  }

  private async requireLesson(id: string, message: string): Promise<LessonEntity> {
    const row = await this.lessons.findById(id);
    if (!row) throw new ApiError('not_found', message);
    return row;
  }

  private async assertModule(moduleId: string): Promise<void> {
    const module = await this.modules.findById(moduleId);
    if (!module) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        moduleId: 'Choose a module.',
      });
    }
  }

  private async assertPhase(phase: number): Promise<void> {
    const row = await this.phases.findById(phase);
    if (!row) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        phase: 'That phase is not set up yet.',
      });
    }
  }

  private slugFor(slug: string | undefined, title: string): string {
    return slugify(slug?.trim() ? slug : title);
  }

  private toRecord(entity: LessonEntity): LessonRecord {
    const phase = entity.phase;
    if (phase !== 1 && phase !== 2 && phase !== 3) {
      throw new ApiError('server', 'Something went wrong.');
    }
    return {
      id: entity.id,
      week: entity.week,
      moduleId: entity.moduleId,
      title: entity.title,
      slug: entity.slug,
      date: entity.classDate,
      format: entity.format,
      phase,
      scheduleStatus: scheduleFor(entity.classDate, this.today()),
      publicationStatus: entity.publicationStatus,
      listing: entity.listing,
      room: entity.room,
      summary: entity.summary,
      objectives: [...entity.objectives],
      lab: entity.lab,
      codeSample: entity.codeSample,
      cover: entity.cover,
      internalNotes: entity.internalNotes,
      updatedAt: isoTimestamp(entity.updatedAt),
    };
  }

  private writeAudit(actor: Actor, verb: CurriculumVerb, id: string): Promise<void> {
    return this.audit.record({
      action: curriculumAuditAction('lesson', verb),
      actorUserId: actor.userId,
      ip: actor.ip,
      requestId: actor.requestId,
      subjectType: 'lesson',
      subjectId: id,
    });
  }
}

function statusOr(value: string | undefined, fallback: PublicationStatus): PublicationStatus {
  if (value && isPublicationStatus(value)) return value;
  return fallback;
}

function listingOr(value: string | undefined, fallback: Listing): Listing {
  if (value && isListing(value)) return value;
  return fallback;
}

function compareLessons(left: LessonRecord, right: LessonRecord, sort: LessonSort): number {
  if (sort === 'week') return left.week - right.week;
  const a = left[sort];
  const b = right[sort];
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
  return 0;
}
