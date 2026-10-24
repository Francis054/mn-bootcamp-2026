import { randomUUID } from 'node:crypto';
import type { AuditRepository } from '../auth/audit.repository.js';
import { curriculumAuditAction, type CurriculumVerb } from '../auth/audit-event.entity.js';
import type { Actor } from '../curriculum/actor.js';
import { isoTimestamp } from '../curriculum/actor.js';
import { pageOf, type Page } from '../curriculum/page.js';
import {
  isListing,
  isPublicationStatus,
  isPublicRecord,
  type Listing,
  type PublicationStatus,
} from '../curriculum/publication.js';
import type { ModuleRepository } from '../curriculum/repositories.js';
import { slugify } from '../curriculum/slug.js';
import { ApiError } from '../../shared/errors/api-error.js';
import { postgresCode } from '../../shared/persistence/postgres-error.js';
import type { TraineeRepository } from '../trainees/trainee.repository.js';
import type { ProjectListQuery, ProjectSort } from './list-query.js';
import { isGithubRepositoryUrl, type RepositoryVisibility } from './project-url.js';
import type { ProjectCreateDto, ProjectPatchDto } from './project.dto.js';
import type { ProjectEntity } from './project.entity.js';
import type { ProjectRepository } from './project.repository.js';
import { isProjectType } from './project-types.js';
import { toPublicProject, type ProjectRecord, type PublicProject } from './records.js';
import { linksArePublic, visibleProjectLinks } from './visibility.js';

export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly modules: ModuleRepository,
    private readonly trainees: TraineeRepository,
    private readonly audit: AuditRepository,
    private readonly repositories: RepositoryVisibility,
  ) {}

  async listPublic(): Promise<PublicProject[]> {
    const rows = (await this.projects.findAll()).filter(isPublicRecord);
    const links = await this.projects.traineeIdsByProject(rows.map((row) => row.id));
    const consent = await this.trainees.consentFlags(unique(flatten(links)));
    const visible: PublicProject[] = [];
    for (const row of rows) {
      const traineeIds = links.get(row.id) ?? [];
      visible.push(await this.publicRow(row, traineeIds, consent));
    }
    return visible;
  }

  async getPublic(id: string): Promise<PublicProject> {
    const row = await this.projects.findById(id);
    if (!row || !isPublicRecord(row)) {
      throw new ApiError('not_found', 'That page is not available.');
    }
    const links = await this.projects.traineeIdsByProject([row.id]);
    const traineeIds = links.get(row.id) ?? [];
    const consent = await this.trainees.consentFlags(traineeIds);
    return this.publicRow(row, traineeIds, consent);
  }

  async listAdmin(query: ProjectListQuery): Promise<Page<ProjectRecord>> {
    const stored = await this.projects.findAll();
    const links = await this.projects.traineeIdsByProject(stored.map((row) => row.id));
    let rows = stored.map((row) => this.toRecord(row, links.get(row.id) ?? [], null));
    const needle = query.q.toLowerCase();
    if (needle) {
      rows = rows.filter((project) =>
        `${project.title} ${project.type}`.toLowerCase().includes(needle),
      );
    }
    if (query.filters.type) {
      const type = query.filters.type;
      rows = rows.filter((project) => project.type === type);
    }
    const sort = query.sort ?? 'title';
    const factor = query.dir === 'desc' ? -1 : 1;
    rows.sort((left, right) => compareProjects(left, right, sort) * factor);
    return pageOf(rows, query.page, query.pageSize);
  }

  async getAdmin(id: string): Promise<ProjectRecord> {
    const row = await this.requireProject(id, 'Project not found.');
    const traineeIds = (await this.projects.traineeIdsByProject([row.id])).get(row.id) ?? [];
    const consent = await this.trainees.consentFlags(traineeIds);
    const note = await this.repositoryNote(row, traineeIds, consent);
    return this.toRecord(row, traineeIds, note);
  }

  async create(dto: ProjectCreateDto, actor: Actor): Promise<ProjectRecord> {
    const title = dto.title.trim();
    const slug = this.slugFor(dto.slug, title);
    if (!slug) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        slug: 'Use a title that can become a link.',
      });
    }
    const moduleId = dto.moduleId.trim();
    const type = dto.type.trim();
    if (!isProjectType(type)) {
      throw new ApiError('validation', 'Check the highlighted fields.', { type: 'Choose a type.' });
    }
    await this.assertModule(moduleId);
    const traineeIds = unique(dto.traineeIds ?? []);
    await this.assertTrainees(traineeIds);
    const saved = await this.insert({
      id: randomUUID(),
      title,
      slug,
      type,
      moduleId,
      cover: dto.cover?.trim() || 'terminal',
      image: dto.image?.trim() || 'electronics-lab',
      abstract: dto.abstract.trim(),
      tools: dto.tools?.trim() ?? '',
      steps: dto.steps ?? [],
      team: dto.team ?? [],
      repositoryUrl: dto.repositoryUrl?.trim() ?? '',
      demoUrl: dto.demoUrl?.trim() ?? '',
      labOnlyConfirmed: dto.labOnlyConfirmed ?? false,
      shareAgreed: dto.shareAgreed ?? false,
      publicationStatus: statusOr(dto.publicationStatus, 'draft'),
      listing: listingOr(dto.listing, 'hidden'),
      internalNotes: dto.internalNotes ?? '',
    });
    await this.projects.replaceTrainees(saved.id, traineeIds);
    await this.writeAudit(actor, 'created', saved.id);
    return this.getAdmin(saved.id);
  }

  async update(id: string, patch: ProjectPatchDto, actor: Actor): Promise<ProjectRecord> {
    const current = await this.requireProject(id, 'Project not found.');
    const title = patch.title?.trim() ?? current.title;
    const slug = patch.slug !== undefined ? this.slugFor(patch.slug, title) : current.slug;
    if (!slug) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        slug: 'Use a title that can become a link.',
      });
    }
    const moduleId = patch.moduleId?.trim() ?? current.moduleId;
    const type = patch.type?.trim() ?? current.type;
    if (!isProjectType(type)) {
      throw new ApiError('validation', 'Check the highlighted fields.', { type: 'Choose a type.' });
    }
    await this.assertModule(moduleId);
    const traineeIds =
      patch.traineeIds !== undefined
        ? unique(patch.traineeIds)
        : ((await this.projects.traineeIdsByProject([id])).get(id) ?? []);
    await this.assertTrainees(traineeIds);
    current.title = title;
    current.slug = slug;
    current.type = type;
    current.moduleId = moduleId;
    current.abstract = patch.abstract?.trim() ?? current.abstract;
    if (patch.cover !== undefined) current.cover = patch.cover.trim() || 'terminal';
    if (patch.image !== undefined) current.image = patch.image.trim() || 'electronics-lab';
    if (patch.tools !== undefined) current.tools = patch.tools.trim();
    if (patch.steps !== undefined) current.steps = patch.steps;
    if (patch.team !== undefined) current.team = patch.team;
    if (patch.repositoryUrl !== undefined) current.repositoryUrl = patch.repositoryUrl.trim();
    if (patch.demoUrl !== undefined) current.demoUrl = patch.demoUrl.trim();
    if (patch.labOnlyConfirmed !== undefined) current.labOnlyConfirmed = patch.labOnlyConfirmed;
    if (patch.shareAgreed !== undefined) current.shareAgreed = patch.shareAgreed;
    if (patch.internalNotes !== undefined) current.internalNotes = patch.internalNotes;
    if (patch.publicationStatus !== undefined) {
      current.publicationStatus = statusOr(patch.publicationStatus, current.publicationStatus);
    }
    if (patch.listing !== undefined) current.listing = listingOr(patch.listing, current.listing);
    const saved = await this.save(current);
    if (patch.traineeIds !== undefined) await this.projects.replaceTrainees(saved.id, traineeIds);
    await this.writeAudit(actor, 'updated', saved.id);
    return this.getAdmin(saved.id);
  }

  async publish(id: string, actor: Actor): Promise<ProjectRecord> {
    const current = await this.requireProject(id, 'Project not found.');
    if (current.publicationStatus !== 'published') {
      current.publicationStatus = 'published';
      await this.save(current);
      await this.writeAudit(actor, 'published', current.id);
    }
    return this.getAdmin(current.id);
  }

  async unpublish(id: string, actor: Actor): Promise<ProjectRecord> {
    const current = await this.requireProject(id, 'Project not found.');
    if (current.publicationStatus !== 'draft') {
      current.publicationStatus = 'draft';
      await this.save(current);
      await this.writeAudit(actor, 'unpublished', current.id);
    }
    return this.getAdmin(current.id);
  }

  async remove(id: string, actor: Actor): Promise<{ deleted: true; id: string }> {
    const current = await this.requireProject(id, 'Record not found.');
    await this.projects.remove(current);
    await this.writeAudit(actor, 'deleted', id);
    return { deleted: true, id };
  }

  private async publicRow(
    row: ProjectEntity,
    traineeIds: string[],
    consent: Map<string, boolean>,
  ): Promise<PublicProject> {
    const allowed = linksArePublic({
      publicationStatus: row.publicationStatus,
      listing: row.listing,
      traineeConsents: traineeIds.map((traineeId) => consent.get(traineeId) === true),
    });
    const repositoryIsPublic = await this.repositoryIsPublic(row.repositoryUrl, allowed);
    const links = visibleProjectLinks({
      allowed,
      repositoryUrl: row.repositoryUrl,
      demoUrl: row.demoUrl,
      repositoryIsPublic,
    });
    return toPublicProject(this.toRecord(row, traineeIds, null), links);
  }

  private async repositoryNote(
    row: ProjectEntity,
    traineeIds: string[],
    consent: Map<string, boolean>,
  ): Promise<string | null> {
    const allowed = linksArePublic({
      publicationStatus: row.publicationStatus,
      listing: row.listing,
      traineeConsents: traineeIds.map((traineeId) => consent.get(traineeId) === true),
    });
    const repositoryIsPublic = await this.repositoryIsPublic(row.repositoryUrl, true);
    return visibleProjectLinks({
      allowed: allowed || row.repositoryUrl !== '',
      repositoryUrl: row.repositoryUrl,
      demoUrl: row.demoUrl,
      repositoryIsPublic,
    }).repositoryLinkNote;
  }

  private async repositoryIsPublic(url: string, check: boolean): Promise<boolean> {
    if (!check || url === '' || !isGithubRepositoryUrl(url)) return true;
    return this.repositories.isPublic(url);
  }

  private async assertModule(moduleId: string): Promise<void> {
    if (!(await this.modules.findById(moduleId))) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        moduleId: 'Choose a module.',
      });
    }
  }

  private async assertTrainees(traineeIds: readonly string[]): Promise<void> {
    for (const traineeId of traineeIds) {
      if (!(await this.trainees.findById(traineeId))) {
        throw new ApiError('validation', 'Check the highlighted fields.', {
          traineeIds: 'Choose a trainee.',
        });
      }
    }
  }

  private slugFor(slug: string | undefined, title: string): string {
    return slugify(slug?.trim() || title);
  }

  private async insert(
    project: Omit<ProjectEntity, 'createdAt' | 'updatedAt'>,
  ): Promise<ProjectEntity> {
    try {
      return await this.projects.insert(project);
    } catch (error) {
      throw mappedWrite(error);
    }
  }

  private async save(project: ProjectEntity): Promise<ProjectEntity> {
    try {
      return await this.projects.save(project);
    } catch (error) {
      throw mappedWrite(error);
    }
  }

  private async requireProject(id: string, message: string): Promise<ProjectEntity> {
    const row = await this.projects.findById(id);
    if (!row) throw new ApiError('not_found', message);
    return row;
  }

  private toRecord(
    row: ProjectEntity,
    traineeIds: string[],
    repositoryLinkNote: string | null,
  ): ProjectRecord {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      type: row.type,
      moduleId: row.moduleId,
      cover: row.cover,
      image: row.image,
      abstract: row.abstract,
      tools: row.tools,
      steps: row.steps,
      team: row.team,
      traineeIds,
      repositoryUrl: row.repositoryUrl,
      demoUrl: row.demoUrl,
      labOnlyConfirmed: row.labOnlyConfirmed,
      shareAgreed: row.shareAgreed,
      publicationStatus: row.publicationStatus,
      listing: row.listing,
      internalNotes: row.internalNotes,
      repositoryLinkNote,
      updatedAt: isoTimestamp(row.updatedAt),
    };
  }

  private writeAudit(actor: Actor, verb: CurriculumVerb, id: string): Promise<void> {
    return this.audit.record({
      action: curriculumAuditAction('project', verb),
      actorUserId: actor.userId,
      ip: actor.ip,
      requestId: actor.requestId,
      subjectType: 'project',
      subjectId: id,
    });
  }
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function flatten(links: Map<string, string[]>): string[] {
  return [...links.values()].flat();
}

function compareProjects(left: ProjectRecord, right: ProjectRecord, sort: ProjectSort): number {
  return left[sort].localeCompare(right[sort]);
}

function statusOr(value: string | undefined, fallback: PublicationStatus): PublicationStatus {
  if (value && isPublicationStatus(value)) return value;
  return fallback;
}

function listingOr(value: string | undefined, fallback: Listing): Listing {
  if (value && isListing(value)) return value;
  return fallback;
}

function mappedWrite(error: unknown): unknown {
  if (postgresCode(error) === '23503') {
    return new ApiError('validation', 'Check the highlighted fields.', {
      moduleId: 'Choose a module.',
    });
  }
  return error;
}
