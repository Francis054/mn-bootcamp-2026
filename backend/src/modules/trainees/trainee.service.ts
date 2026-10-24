import { randomUUID } from 'node:crypto';
import type { AuditRepository } from '../auth/audit.repository.js';
import { curriculumAuditAction, type CurriculumVerb } from '../auth/audit-event.entity.js';
import type { Actor } from '../curriculum/actor.js';
import { isoTimestamp } from '../curriculum/actor.js';
import { pageOf, type Page } from '../curriculum/page.js';
import {
  isListing,
  isPublicationStatus,
  type Listing,
  type PublicationStatus,
} from '../curriculum/publication.js';
import type { ModuleRepository } from '../curriculum/repositories.js';
import { ApiError } from '../../shared/errors/api-error.js';
import { postgresCode } from '../../shared/persistence/postgres-error.js';
import { hueFromEmail, initialsFrom } from '../users/profile.js';
import type { TraineeListQuery, TraineeSort } from './list-query.js';
import { toPublicTrainee, type PublicTrainee, type TraineeRecord } from './records.js';
import type { TraineeCreateDto, TraineePatchDto } from './trainee.dto.js';
import type { TraineeEntity } from './trainee.entity.js';
import type { TraineeRepository } from './trainee.repository.js';
import { normalizeEmail } from './trainee.rules.js';
import { isTraineeTrack } from './tracks.js';
import { CONSENT_REQUIRED, consentWrite, isPublicTrainee } from './visibility.js';

export class TraineeService {
  constructor(
    private readonly trainees: TraineeRepository,
    private readonly modules: ModuleRepository,
    private readonly audit: AuditRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listPublic(): Promise<PublicTrainee[]> {
    const rows = await this.trainees.findAll();
    return rows
      .map((row) => this.toRecord(row))
      .filter(isPublicTrainee)
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
      .map(toPublicTrainee);
  }

  async getPublic(id: string): Promise<PublicTrainee> {
    const row = await this.trainees.findById(id);
    if (!row) throw new ApiError('not_found', 'That page is not available.');
    const trainee = this.toRecord(row);
    if (!isPublicTrainee(trainee)) throw new ApiError('not_found', 'That page is not available.');
    return toPublicTrainee(trainee);
  }

  async listAdmin(query: TraineeListQuery): Promise<Page<TraineeRecord>> {
    let rows = (await this.trainees.findAll()).map((row) => this.toRecord(row));
    const needle = query.q.toLowerCase();
    if (needle) {
      rows = rows.filter((trainee) => haystack(trainee).includes(needle));
    }
    if (query.filters.track) {
      const track = query.filters.track;
      rows = rows.filter((trainee) => trainee.track === track);
    }
    if (query.filters.focus) {
      const focus = query.filters.focus;
      rows = rows.filter((trainee) => trainee.focus === focus);
    }
    const sort = query.sort ?? 'displayName';
    const factor = query.dir === 'desc' ? -1 : 1;
    rows.sort((left, right) => compareTrainees(left, right, sort) * factor);
    return pageOf(rows, query.page, query.pageSize);
  }

  async getAdmin(id: string): Promise<TraineeRecord> {
    return this.toRecord(await this.requireTrainee(id, 'Trainee not found.'));
  }

  async create(dto: TraineeCreateDto, actor: Actor): Promise<TraineeRecord> {
    const displayName = dto.displayName.trim();
    const email = normalizeEmail(dto.email);
    const track = dto.track.trim();
    const focus = dto.focus.trim();
    if (!isTraineeTrack(track)) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        track: 'Choose Blue team, Red team, or GRC & Awareness.',
      });
    }
    await this.assertFocus(focus);
    await this.assertEmailFree(email);
    const consentReceived = dto.consentReceived ?? false;
    const requestedStatus = statusOr(dto.publicationStatus, 'draft');
    const decision = consentWrite({
      currentConsent: false,
      requestedConsent: consentReceived,
      requestedStatus,
    });
    if (decision === 'refused') throw consentRefusal();
    const saved = await this.insert({
      id: randomUUID(),
      displayName,
      initials: dto.initials?.trim() || initialsFrom(displayName),
      hue: dto.hue ?? hueFromEmail(email),
      email,
      track,
      focus,
      skills: dto.skills ?? [],
      bio: dto.bio ?? '',
      quote: dto.quote ?? '',
      linkedin: dto.linkedin?.trim() ?? '',
      portfolio: dto.portfolio?.trim() ?? '',
      consentReceived,
      consentReceivedAt: consentReceived ? this.now() : null,
      consentRecordedBy: consentReceived ? actor.userId : null,
      consentWithdrawnAt: null,
      listing: listingOr(dto.listing, 'hidden'),
      publicationStatus: decision.publicationStatus,
      statusLabel: dto.statusLabel?.trim() || 'In training',
      internalNotes: dto.internalNotes ?? '',
    });
    await this.writeAudit(actor, 'created', saved.id);
    return this.toRecord(saved);
  }

  async update(id: string, patch: TraineePatchDto, actor: Actor): Promise<TraineeRecord> {
    const current = await this.requireTrainee(id, 'Trainee not found.');
    const displayName = patch.displayName?.trim() ?? current.displayName;
    const email = patch.email !== undefined ? normalizeEmail(patch.email) : current.email;
    const track = patch.track?.trim() ?? current.track;
    const focus = patch.focus?.trim() ?? current.focus;
    if (!isTraineeTrack(track)) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        track: 'Choose Blue team, Red team, or GRC & Awareness.',
      });
    }
    await this.assertFocus(focus);
    if (email !== current.email) await this.assertEmailFree(email);
    const requestedConsent = patch.consentReceived ?? current.consentReceived;
    const decision = consentWrite({
      currentConsent: current.consentReceived,
      requestedConsent,
      requestedStatus: statusOr(patch.publicationStatus, current.publicationStatus),
    });
    if (decision === 'refused') throw consentRefusal();

    const wasPublished = current.publicationStatus === 'published';
    const previousEmail = current.email;
    current.displayName = displayName;
    if (patch.initials !== undefined) {
      current.initials = patch.initials.trim() || initialsFrom(displayName);
    }
    if (patch.hue !== undefined) current.hue = patch.hue;
    else if (email !== previousEmail) current.hue = hueFromEmail(email);
    current.email = email;
    current.track = track;
    current.focus = focus;
    if (patch.skills !== undefined) current.skills = patch.skills;
    if (patch.bio !== undefined) current.bio = patch.bio;
    if (patch.quote !== undefined) current.quote = patch.quote;
    if (patch.linkedin !== undefined) current.linkedin = patch.linkedin.trim();
    if (patch.portfolio !== undefined) current.portfolio = patch.portfolio.trim();
    if (patch.statusLabel !== undefined) {
      current.statusLabel = patch.statusLabel.trim() || 'In training';
    }
    if (patch.internalNotes !== undefined) current.internalNotes = patch.internalNotes;
    if (patch.listing !== undefined) current.listing = listingOr(patch.listing, current.listing);
    if (requestedConsent && !current.consentReceived) {
      current.consentReceivedAt = this.now();
      current.consentRecordedBy = actor.userId;
      current.consentWithdrawnAt = null;
    }
    if (decision.withdrawing) current.consentWithdrawnAt = this.now();
    current.consentReceived = requestedConsent;
    current.publicationStatus = decision.publicationStatus;
    const saved = await this.save(current);
    const verb: CurriculumVerb = decision.withdrawing && wasPublished ? 'unpublished' : 'updated';
    await this.writeAudit(actor, verb, saved.id);
    return this.toRecord(saved);
  }

  async publish(id: string, actor: Actor): Promise<TraineeRecord> {
    const current = await this.requireTrainee(id, 'Trainee not found.');
    if (!current.consentReceived) throw consentRefusal();
    if (current.publicationStatus !== 'published') {
      current.publicationStatus = 'published';
      await this.save(current);
      await this.writeAudit(actor, 'published', current.id);
    }
    return this.toRecord(current);
  }

  async unpublish(id: string, actor: Actor): Promise<TraineeRecord> {
    const current = await this.requireTrainee(id, 'Trainee not found.');
    if (current.publicationStatus !== 'draft') {
      current.publicationStatus = 'draft';
      await this.save(current);
      await this.writeAudit(actor, 'unpublished', current.id);
    }
    return this.toRecord(current);
  }

  async remove(id: string, actor: Actor): Promise<{ deleted: true; id: string }> {
    const current = await this.requireTrainee(id, 'Record not found.');
    await this.trainees.remove(current);
    await this.writeAudit(actor, 'deleted', id);
    return { deleted: true, id };
  }

  private async assertFocus(focus: string): Promise<void> {
    const module = await this.modules.findById(focus);
    if (!module) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        focus: 'Choose a module.',
      });
    }
  }

  private async assertEmailFree(email: string): Promise<void> {
    const existing = await this.trainees.findByEmail(email);
    if (existing) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        email: 'A trainee with that email already exists.',
      });
    }
  }

  private async insert(
    trainee: Omit<TraineeEntity, 'createdAt' | 'updatedAt'>,
  ): Promise<TraineeEntity> {
    try {
      return await this.trainees.insert(trainee);
    } catch (error) {
      throw mappedWrite(error);
    }
  }

  private async save(trainee: TraineeEntity): Promise<TraineeEntity> {
    try {
      return await this.trainees.save(trainee);
    } catch (error) {
      throw mappedWrite(error);
    }
  }

  private async requireTrainee(id: string, message: string): Promise<TraineeEntity> {
    const row = await this.trainees.findById(id);
    if (!row) throw new ApiError('not_found', message);
    return row;
  }

  private toRecord(row: TraineeEntity): TraineeRecord {
    return {
      id: row.id,
      displayName: row.displayName,
      initials: row.initials,
      hue: row.hue,
      email: row.email,
      track: row.track,
      focus: row.focus,
      skills: row.skills,
      bio: row.bio,
      quote: row.quote,
      linkedin: row.linkedin,
      portfolio: row.portfolio,
      consentReceived: row.consentReceived,
      consentReceivedAt: stamp(row.consentReceivedAt),
      consentRecordedBy: row.consentRecordedBy,
      consentWithdrawnAt: stamp(row.consentWithdrawnAt),
      listing: row.listing,
      publicationStatus: row.publicationStatus,
      statusLabel: row.statusLabel,
      internalNotes: row.internalNotes,
      updatedAt: isoTimestamp(row.updatedAt),
    };
  }

  private writeAudit(actor: Actor, verb: CurriculumVerb, id: string): Promise<void> {
    return this.audit.record({
      action: curriculumAuditAction('trainee', verb),
      actorUserId: actor.userId,
      ip: actor.ip,
      requestId: actor.requestId,
      subjectType: 'trainee',
      subjectId: id,
    });
  }
}

function haystack(trainee: TraineeRecord): string {
  return `${trainee.displayName} ${trainee.track} ${trainee.skills.join(' ')}`.toLowerCase();
}

function compareTrainees(left: TraineeRecord, right: TraineeRecord, sort: TraineeSort): number {
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

function stamp(value: Date | null): string | null {
  if (!value) return null;
  return isoTimestamp(value);
}

function consentRefusal(): ApiError {
  return new ApiError('validation', CONSENT_REQUIRED, {
    publicationStatus: CONSENT_REQUIRED,
  });
}

function mappedWrite(error: unknown): unknown {
  if (postgresCode(error) === '23505') {
    return new ApiError('validation', 'Check the highlighted fields.', {
      email: 'A trainee with that email already exists.',
    });
  }
  if (postgresCode(error) === '23503') {
    return new ApiError('validation', 'Check the highlighted fields.', {
      focus: 'Choose a module.',
    });
  }
  return error;
}
