import { randomUUID } from 'node:crypto';
import type { AuditRepository } from '../auth/audit.repository.js';
import type { AuditAction } from '../auth/audit-event.entity.js';
import { accraToday } from '../curriculum/schedule.js';
import { ApiError } from '../../shared/errors/api-error.js';
import type { PortfolioRepository } from '../portfolio/portfolio.repository.js';
import type { ProgressRepository } from '../progress/progress.repository.js';
import type { ProjectRepository } from '../projects/project.repository.js';
import type { TimetableRepository } from '../timetable/timetable.repository.js';
import type { TraineeRepository } from '../trainees/trainee.repository.js';
import { isPublicTrainee } from '../trainees/visibility.js';
import type { UserRepository } from '../users/user.repository.js';
import {
  buildJourney,
  type AccountSource,
  type JourneyBody,
  type CatalogueProjectSource,
} from './journey-build.js';
import type { JourneyRepository } from './journey.repository.js';
import { MAX_MILESTONES, readMilestoneWrite, type MilestoneInput } from './journey-rules.js';
import type { TraineeMilestoneEntity } from './trainee-milestone.entity.js';

const MISSING = 'That page is not available.';
const UNLINKED = 'Your login is not linked to a trainee record yet.';
const MILESTONE_MISSING = 'That milestone was not found.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MilestoneActor {
  loginId: string;
  ip: string | null;
  requestId: string | null;
}

export interface MilestoneRecord {
  id: string;
  title: string;
  summary: string;
  occurredOn: string;
  visibility: TraineeMilestoneEntity['visibility'];
}

export class JourneyService {
  constructor(
    private readonly milestones: JourneyRepository,
    private readonly trainees: TraineeRepository,
    private readonly logins: UserRepository,
    private readonly portfolio: PortfolioRepository,
    private readonly progress: ProgressRepository,
    private readonly projects: ProjectRepository,
    private readonly timetable: TimetableRepository,
    private readonly audit: AuditRepository,
    private readonly today: () => string = accraToday,
  ) {}

  async publicJourney(slugOrId: string): Promise<JourneyBody> {
    const trainee = await this.publicTrainee(slugOrId);
    return this.assemble(trainee.id, 'public');
  }

  async ownJourney(loginId: string): Promise<JourneyBody> {
    const trainee = await this.ownTrainee(loginId);
    return this.assemble(trainee.id, 'portal');
  }

  async createMilestone(actor: MilestoneActor, body: unknown): Promise<MilestoneRecord> {
    const trainee = await this.ownTrainee(actor.loginId);
    const input = this.read(body, 'create');
    const existing = await this.milestones.listForTrainee(trainee.id);
    if (existing.length >= MAX_MILESTONES) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        title: 'You can keep up to 40 milestones. Delete one to add another.',
      });
    }
    const saved = await this.milestones.save(this.milestones.create({
      id: randomUUID(),
      traineeId: trainee.id,
      title: input.title,
      summary: input.summary,
      occurredOn: input.occurredOn,
      visibility: input.visibility,
    }));
    await this.record(actor, 'portal.milestone.created', saved.id);
    return present(saved);
  }

  async updateMilestone(actor: MilestoneActor, id: string, body: unknown): Promise<MilestoneRecord> {
    const row = await this.ownMilestone(actor.loginId, id);
    const patch = readMilestoneWrite(body, 'patch');
    if (Object.keys(patch.errors).length) {
      throw new ApiError('validation', 'Check the highlighted fields.', patch.errors);
    }
    if (patch.value.title !== undefined) row.title = patch.value.title;
    if (patch.value.summary !== undefined) row.summary = patch.value.summary;
    if (patch.value.occurredOn !== undefined) row.occurredOn = patch.value.occurredOn;
    if (patch.value.visibility !== undefined) row.visibility = patch.value.visibility;
    const saved = await this.milestones.save(row);
    await this.record(actor, 'portal.milestone.updated', saved.id);
    return present(saved);
  }

  async deleteMilestone(actor: MilestoneActor, id: string): Promise<{ id: string }> {
    const row = await this.ownMilestone(actor.loginId, id);
    await this.milestones.remove(row.id);
    await this.record(actor, 'portal.milestone.deleted', row.id);
    return { id: row.id };
  }

  private async assemble(traineeId: string, audience: 'public' | 'portal'): Promise<JourneyBody> {
    const trainee = await this.trainees.findById(traineeId);
    if (!trainee) throw new ApiError('not_found', MISSING);
    const login = await this.logins.findByTraineeId(trainee.id);
    const bundle = await this.timetable.load();
    const portfolio = await this.portfolio.listForTrainee(trainee.id);
    const skills = await this.progress.listSkills(trainee.id);
    const events = await this.progress.listEvents(trainee.id);
    const projects = await this.projectsFor(trainee.id);
    const milestones = await this.milestones.listForTrainee(trainee.id);
    const account: AccountSource = {
      createdAt: login?.createdAt ?? null,
      emailVerifiedAt: login?.emailVerifiedAt ?? null,
      profileReviewStatus: trainee.profileReviewStatus,
      profileReviewedAt: trainee.profileReviewedAt,
      consentReceived: trainee.consentReceived,
      publicationStatus: trainee.publicationStatus,
      listing: trainee.listing,
      consentReceivedAt: trainee.consentReceivedAt,
    };
    return buildJourney({
      displayName: trainee.displayName,
      slug: trainee.slug ?? trainee.id,
      today: this.today(),
      audience,
      curriculum: {
        programme: bundle.programme
          ? { name: bundle.programme.name, startsOn: bundle.programme.startsOn, endsOn: bundle.programme.endsOn }
          : null,
        blocks: bundle.blocks,
        weeks: bundle.weeks,
        deliverables: bundle.deliverables,
      },
      portfolio,
      skills,
      events,
      projects,
      account,
      milestones,
    });
  }

  private async projectsFor(traineeId: string): Promise<CatalogueProjectSource[]> {
    const ids = await this.projects.idsForTrainee(traineeId);
    const rows: CatalogueProjectSource[] = [];
    for (const id of ids) {
      const project = await this.projects.findById(id);
      if (!project) continue;
      rows.push({
        id: project.id,
        title: project.title,
        type: project.type,
        abstract: project.abstract,
        publicationStatus: project.publicationStatus,
        listing: project.listing,
        createdAt: project.createdAt,
      });
    }
    return rows;
  }

  private read(body: unknown, mode: 'create'): MilestoneInput {
    const parsed = readMilestoneWrite(body, mode);
    if (Object.keys(parsed.errors).length || !parsed.value.title || !parsed.value.occurredOn || !parsed.value.visibility) {
      throw new ApiError('validation', 'Check the highlighted fields.', parsed.errors);
    }
    return {
      title: parsed.value.title,
      summary: parsed.value.summary ?? '',
      occurredOn: parsed.value.occurredOn,
      visibility: parsed.value.visibility,
    };
  }

  private async ownTrainee(loginId: string) {
    const login = await this.logins.findById(loginId);
    if (!login?.traineeId) throw new ApiError('not_found', UNLINKED);
    const trainee = await this.trainees.findById(login.traineeId);
    if (!trainee) throw new ApiError('not_found', UNLINKED);
    return trainee;
  }

  private async publicTrainee(slugOrId: string) {
    const direct = slugOrId ? await this.trainees.findById(slugOrId) : null;
    const trainee = direct ?? (slugOrId ? await this.trainees.findBySlug(slugOrId) : null);
    if (!trainee || !isPublicTrainee(trainee)) throw new ApiError('not_found', MISSING);
    return trainee;
  }

  private async ownMilestone(loginId: string, id: string): Promise<TraineeMilestoneEntity> {
    if (!UUID.test(id)) throw new ApiError('not_found', MILESTONE_MISSING);
    const trainee = await this.ownTrainee(loginId);
    const row = await this.milestones.findOne(id);
    if (!row || row.traineeId !== trainee.id) throw new ApiError('not_found', MILESTONE_MISSING);
    return row;
  }

  private record(actor: MilestoneActor, action: AuditAction, id: string): Promise<void> {
    return this.audit.record({
      action,
      actorUserId: actor.loginId,
      ip: actor.ip,
      requestId: actor.requestId,
      subjectType: 'trainee_milestone',
      subjectId: id,
    });
  }
}

function present(row: TraineeMilestoneEntity): MilestoneRecord {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    occurredOn: row.occurredOn,
    visibility: row.visibility,
  };
}
