import type { AuditRepository } from '../auth/audit.repository.js';
import { curriculumAuditAction, type CurriculumVerb } from '../auth/audit-event.entity.js';
import type { CurriculumKind } from '../auth/audit-event.entity.js';
import type { Actor } from '../curriculum/actor.js';
import type { PublicationStatus } from '../curriculum/publication.js';
import { ApiError } from '../../shared/errors/api-error.js';
import type { ContentId, ContentSingletonEntity } from './content.entity.js';
import {
  mergeAbout,
  mergeHomepage,
  mergeMilestones,
  mergeSettings,
  readAbout,
  readHomepage,
  readMilestones,
  readSettings,
} from './content.rules.js';
import type { ContentRepository } from './content.repository.js';
import { buildSampleContent } from './sample-content.js';
import type {
  AboutContent,
  AdminAbout,
  AdminHomepage,
  AdminSettings,
  FoundationStat,
  HomepageContent,
  Milestone,
  SiteSettings,
} from './content.types.js';

const MISSING = 'That page is not available.';
const UNREADABLE = 'Content could not be read.';

export class ContentService {
  constructor(
    private readonly content: ContentRepository,
    private readonly audit: AuditRepository,
  ) {}

  async getPublicHome(): Promise<HomepageContent> {
    return this.publishedHomepage(await this.require('homepage'));
  }

  async getPublicAbout(): Promise<AboutContent> {
    return this.publishedAbout(await this.require('about'));
  }

  async listPublicMilestones(): Promise<Milestone[]> {
    const row = await this.content.findById('milestones');
    if (!row || !isLive(row)) return [];
    return readMilestones(row.publishedDocument)?.milestones ?? [];
  }

  async listPublicFoundationStats(): Promise<FoundationStat[]> {
    const row = await this.content.findById('settings');
    if (!row || !isLive(row)) return [];
    return readSettings(row.publishedDocument)?.foundationStats ?? [];
  }

  async getAdminHome(): Promise<AdminHomepage> {
    const row = await this.ensure('homepage');
    return { ...requireHomepage(row.draft), publicationStatus: row.publicationStatus };
  }

  async updateHome(body: unknown, actor: Actor): Promise<AdminHomepage> {
    const row = await this.ensure('homepage');
    const next = mergeHomepage(requireHomepage(row.draft), body);
    return this.saveDocument(row, next, actor, 'homepage');
  }

  async publishHome(actor: Actor): Promise<AdminHomepage> {
    const row = await this.publishRow('homepage', actor);
    return { ...requireHomepage(row.draft), publicationStatus: row.publicationStatus };
  }

  async unpublishHome(actor: Actor): Promise<AdminHomepage> {
    const row = await this.unpublishRow('homepage', actor);
    return { ...requireHomepage(row.draft), publicationStatus: row.publicationStatus };
  }

  async getAdminAbout(): Promise<AdminAbout> {
    const row = await this.ensure('about');
    return { ...requireAbout(row.draft), publicationStatus: row.publicationStatus };
  }

  async updateAbout(body: unknown, actor: Actor): Promise<AdminAbout> {
    const row = await this.ensure('about');
    const next = mergeAbout(requireAbout(row.draft), body);
    return this.saveDocument(row, next, actor, 'about');
  }

  async publishAbout(actor: Actor): Promise<AdminAbout> {
    const row = await this.publishRow('about', actor);
    return { ...requireAbout(row.draft), publicationStatus: row.publicationStatus };
  }

  async unpublishAbout(actor: Actor): Promise<AdminAbout> {
    const row = await this.unpublishRow('about', actor);
    return { ...requireAbout(row.draft), publicationStatus: row.publicationStatus };
  }

  async listAdminMilestones(): Promise<{
    milestones: Milestone[];
    publicationStatus: PublicationStatus;
  }> {
    const row = await this.ensure('milestones');
    return { milestones: requireMilestones(row.draft), publicationStatus: row.publicationStatus };
  }

  async updateMilestones(body: unknown, actor: Actor): Promise<Milestone[]> {
    const row = await this.ensure('milestones');
    const next = mergeMilestones(requireMilestones(row.draft), body);
    row.draft = { milestones: next };
    await this.content.save(row);
    await this.writeAudit(actor, 'updated', 'milestone', 'milestones');
    return next;
  }

  async publishMilestones(actor: Actor): Promise<Milestone[]> {
    const row = await this.publishRow('milestones', actor);
    return requireMilestones(row.draft);
  }

  async unpublishMilestones(actor: Actor): Promise<Milestone[]> {
    const row = await this.unpublishRow('milestones', actor);
    return requireMilestones(row.draft);
  }

  async getAdminSettings(): Promise<AdminSettings> {
    const row = await this.ensure('settings');
    return { ...requireSettings(row.draft), publicationStatus: row.publicationStatus };
  }

  async updateSettings(body: unknown, actor: Actor): Promise<AdminSettings> {
    const row = await this.ensure('settings');
    const next = mergeSettings(requireSettings(row.draft), body);
    return this.saveDocument(row, next, actor, 'settings');
  }

  async publishSettings(actor: Actor): Promise<AdminSettings> {
    const row = await this.publishRow('settings', actor);
    return { ...requireSettings(row.draft), publicationStatus: row.publicationStatus };
  }

  async unpublishSettings(actor: Actor): Promise<AdminSettings> {
    const row = await this.unpublishRow('settings', actor);
    return { ...requireSettings(row.draft), publicationStatus: row.publicationStatus };
  }

  private publishedHomepage(row: ContentSingletonEntity): HomepageContent {
    if (!isLive(row)) throw new ApiError('not_found', MISSING);
    const published = readHomepage(row.publishedDocument);
    if (!published) throw new ApiError('not_found', MISSING);
    return published;
  }

  private publishedAbout(row: ContentSingletonEntity): AboutContent {
    if (!isLive(row)) throw new ApiError('not_found', MISSING);
    const published = readAbout(row.publishedDocument);
    if (!published) throw new ApiError('not_found', MISSING);
    return published;
  }

  private async saveDocument<T extends object>(
    row: ContentSingletonEntity,
    next: T,
    actor: Actor,
    kind: CurriculumKind,
  ): Promise<T & { publicationStatus: PublicationStatus }> {
    row.draft = next;
    await this.content.save(row);
    await this.writeAudit(actor, 'updated', kind, row.id);
    return { ...next, publicationStatus: row.publicationStatus };
  }

  private async publishRow(id: ContentId, actor: Actor): Promise<ContentSingletonEntity> {
    const row = await this.ensure(id);
    const same =
      row.publicationStatus === 'published' &&
      JSON.stringify(row.publishedDocument) === JSON.stringify(row.draft);
    if (!same) {
      row.publishedDocument = structuredClone(row.draft);
      row.publicationStatus = 'published';
      await this.content.save(row);
      await this.writeAudit(actor, 'published', kindFor(id), id);
    }
    return row;
  }

  private async unpublishRow(id: ContentId, actor: Actor): Promise<ContentSingletonEntity> {
    const row = await this.ensure(id);
    if (row.publicationStatus !== 'draft' || row.publishedDocument !== null) {
      row.publishedDocument = null;
      row.publicationStatus = 'draft';
      await this.content.save(row);
      await this.writeAudit(actor, 'unpublished', kindFor(id), id);
    }
    return row;
  }

  private async require(id: ContentId): Promise<ContentSingletonEntity> {
    const row = await this.content.findById(id);
    if (!row) throw new ApiError('not_found', 'Content not found.');
    return row;
  }

  /** Admin reads and writes create the labelled draft when the row was never seeded. */
  private async ensure(id: ContentId): Promise<ContentSingletonEntity> {
    const existing = await this.content.findById(id);
    if (existing) return existing;
    const sample = buildSampleContent().find((row) => row.id === id);
    if (!sample) throw new ApiError('not_found', 'Content not found.');
    return this.content.insert({
      id: sample.id,
      draft: sample.draft,
      publishedDocument: sample.publishedDocument,
      publicationStatus: sample.publicationStatus,
    });
  }

  private writeAudit(
    actor: Actor,
    verb: CurriculumVerb,
    kind: CurriculumKind,
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

function isLive(row: ContentSingletonEntity): boolean {
  return row.publicationStatus === 'published' && row.publishedDocument !== null;
}

function requireHomepage(value: object): HomepageContent {
  const parsed = readHomepage(value);
  if (!parsed) throw new ApiError('server', UNREADABLE);
  return parsed;
}

function requireAbout(value: object): AboutContent {
  const parsed = readAbout(value);
  if (!parsed) throw new ApiError('server', UNREADABLE);
  return parsed;
}

function requireMilestones(value: object): Milestone[] {
  const parsed = readMilestones(value);
  if (!parsed) throw new ApiError('server', UNREADABLE);
  return parsed.milestones;
}

function requireSettings(value: object): SiteSettings {
  const parsed = readSettings(value);
  if (!parsed) throw new ApiError('server', UNREADABLE);
  return parsed;
}

function kindFor(id: ContentId): CurriculumKind {
  if (id === 'milestones') return 'milestone';
  return id;
}
