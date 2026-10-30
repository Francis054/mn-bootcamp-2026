import type { AuditRepository } from '../auth/audit.repository.js';
import type { AuditAction } from '../auth/audit-event.entity.js';
import type { Actor } from '../curriculum/actor.js';
import { isoTimestamp } from '../curriculum/actor.js';
import type { PortfolioRepository } from '../portfolio/portfolio.repository.js';
import { ApiError } from '../../shared/errors/api-error.js';
import { storeProfilePhoto } from '../trainees/profile-photo.js';
import { isReviewStatus, statusAfterEdit, type ReviewStatus } from '../trainees/profile-review.js';
import type { TraineeEntity } from '../trainees/trainee.entity.js';
import type { TraineeRepository } from '../trainees/trainee.repository.js';
import { isPublicTrainee } from '../trainees/visibility.js';
import type { TimetableRepository } from '../timetable/timetable.repository.js';
import type { StorageProvider } from '../storage/storage-provider.js';
import type { UserRepository } from '../users/user.repository.js';
import {
  MAX_EVENTS,
  MAX_SKILLS,
  approveOwned,
  emptyEvent,
  emptySkill,
  readEventWrite,
  readSkillWrite,
  rejectOwned,
  skillSlug,
  submitOwned,
  type EventContent,
  type SkillContent,
  type SkillLevel,
} from './progress-rules.js';
import type { ProgressRepository } from './progress.repository.js';
import type { TraineeEventEntity } from './trainee-event.entity.js';
import type { TraineeSkillEntity } from './trainee-skill.entity.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MISSING_SKILL = 'That skill is not available.';
const MISSING_EVENT = 'That event is not available.';
const NOT_WAITING_SKILL = 'That skill is not waiting for review.';
const NOT_WAITING_EVENT = 'That event is not waiting for review.';
const UNLINKED = 'Your login is not linked to a trainer on the timetable.';

export interface SkillView {
  id: string;
  sortOrder: number;
  status: ReviewStatus;
  rejectionReason: string;
  submittedAt: string | null;
  draft: SkillContent;
  live: SkillContent;
}

export interface EventView {
  id: string;
  sortOrder: number;
  status: ReviewStatus;
  rejectionReason: string;
  submittedAt: string | null;
  draft: EventContent & { certificateUrl: string | null };
  live: EventContent & { certificateUrl: string | null };
}

export interface PublicSkill {
  id: string;
  name: string;
  level: SkillLevel;
  evidence: { id: string; title: string; kind: string } | null;
}

export interface PublicEvent {
  id: string;
  title: string;
  eventDate: string | null;
  organiser: string;
  link: string | null;
  certificateUrl: string | null;
}

export interface SkillReviewItem extends SkillView {
  traineeId: string;
  email: string;
  traineeName: string;
  consents: { publicProfile: boolean; publicPhoto: boolean };
}

export interface EventReviewItem extends EventView {
  traineeId: string;
  email: string;
  traineeName: string;
  consents: { publicProfile: boolean; publicPhoto: boolean };
}

export interface TrainerTraineeView {
  id: string;
  displayName: string;
  skills: SkillView[];
  events: EventView[];
}

/**
 * Skills and events for the signed-in trainee.
 * The trainee id comes from the session. A body cannot name another trainee.
 * The live columns stay public until an administrator approves a newer draft.
 */
export class ProgressService {
  constructor(
    private readonly progress: ProgressRepository,
    private readonly users: UserRepository,
    private readonly trainees: TraineeRepository,
    private readonly portfolio: PortfolioRepository,
    private readonly timetable: TimetableRepository,
    private readonly auditLog: AuditRepository,
    private readonly storage: StorageProvider,
    private readonly maxImageBytes: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listOwnSkills(userId: string): Promise<SkillView[]> {
    const trainee = await this.ownTrainee(userId);
    return (await this.progress.listSkills(trainee.id)).map((row) => this.skillView(row));
  }

  async createOwnSkill(userId: string, body: unknown): Promise<SkillView> {
    const trainee = await this.ownTrainee(userId);
    const content = await this.readSkill(trainee.id, body, 'create', emptySkill());
    const existing = await this.progress.listSkills(trainee.id);
    if (existing.length >= MAX_SKILLS) throw new ApiError('validation', 'You can keep at most 20 skills.');
    const sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
    const row = this.progress.createSkill({
      traineeId: trainee.id,
      slug: await this.uniqueSlug(trainee.id, skillSlug(content.name)),
      sortOrder,
      reviewStatus: 'draft',
      rejectionReason: '',
      submittedAt: null,
      reviewedAt: null,
      reviewedBy: null,
      name: '',
      level: 1,
      evidenceItemId: null,
      hasPending: true,
    });
    this.writeSkillPending(row, content);
    return this.skillView(await this.progress.saveSkill(row));
  }

  async updateOwnSkill(userId: string, skillId: string, body: unknown): Promise<SkillView> {
    const { row } = await this.ownSkill(userId, skillId);
    this.ensureSkillPending(row);
    const content = await this.readSkill(row.traineeId, body, 'patch', this.skillPending(row));
    this.writeSkillPending(row, content);
    row.reviewStatus = statusAfterEdit(statusOf(row));
    return this.skillView(await this.progress.saveSkill(row));
  }

  async deleteOwnSkill(userId: string, skillId: string): Promise<{ id: string }> {
    const { row } = await this.ownSkill(userId, skillId);
    await this.progress.deleteSkill(row.id);
    await this.syncCardSkills(row.traineeId, true);
    return { id: row.id };
  }

  async submitSkill(userId: string, skillId: string): Promise<SkillView> {
    const { trainee, row } = await this.ownSkill(userId, skillId);
    if (!row.hasPending) this.writeSkillPending(row, this.skillLive(row));
    if (!this.skillPending(row).name) {
      throw new ApiError('validation', 'Check the highlighted fields.', { name: 'Enter the skill.' });
    }
    const decision = submitOwned(statusOf(row), trainee.consentReceived, 'skill');
    if (!decision.ok) throw new ApiError('validation', decision.message);
    row.reviewStatus = decision.status;
    row.submittedAt = this.now();
    row.rejectionReason = '';
    return this.skillView(await this.progress.saveSkill(row));
  }

  async listOwnEvents(userId: string): Promise<EventView[]> {
    const trainee = await this.ownTrainee(userId);
    return (await this.progress.listEvents(trainee.id)).map((row) => this.eventView(row));
  }

  async createOwnEvent(userId: string, body: unknown): Promise<EventView> {
    const trainee = await this.ownTrainee(userId);
    const content = this.readEvent(body, 'create', emptyEvent());
    const existing = await this.progress.listEvents(trainee.id);
    if (existing.length >= MAX_EVENTS) throw new ApiError('validation', 'You can keep at most 30 events.');
    const sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
    const row = this.progress.createEvent({
      traineeId: trainee.id,
      sortOrder,
      reviewStatus: 'draft',
      rejectionReason: '',
      submittedAt: null,
      reviewedAt: null,
      reviewedBy: null,
      title: '',
      eventDate: null,
      organiser: '',
      link: null,
      certificateUrl: null,
      certificateStorageKey: null,
      hasPending: true,
      pendingCertificateUrl: null,
      pendingCertificateStorageKey: null,
    });
    this.writeEventPending(row, content);
    return this.eventView(await this.progress.saveEvent(row));
  }

  async updateOwnEvent(userId: string, eventId: string, body: unknown): Promise<EventView> {
    const { row } = await this.ownEvent(userId, eventId);
    this.ensureEventPending(row);
    const content = this.readEvent(body, 'patch', this.eventPending(row));
    this.writeEventPending(row, content);
    row.reviewStatus = statusAfterEdit(statusOf(row));
    return this.eventView(await this.progress.saveEvent(row));
  }

  async deleteOwnEvent(userId: string, eventId: string): Promise<{ id: string }> {
    const { row } = await this.ownEvent(userId, eventId);
    const keys = certificateKeys(row);
    await this.progress.deleteEvent(row.id);
    await this.deleteStored(keys);
    return { id: row.id };
  }

  async submitEvent(userId: string, eventId: string): Promise<EventView> {
    const { trainee, row } = await this.ownEvent(userId, eventId);
    if (!row.hasPending) this.writeEventPending(row, this.eventLive(row));
    if (!this.eventPending(row).title) {
      throw new ApiError('validation', 'Check the highlighted fields.', { title: 'Enter the event title.' });
    }
    const decision = submitOwned(statusOf(row), trainee.consentReceived, 'event');
    if (!decision.ok) throw new ApiError('validation', decision.message);
    row.reviewStatus = decision.status;
    row.submittedAt = this.now();
    row.rejectionReason = '';
    return this.eventView(await this.progress.saveEvent(row));
  }

  async addOwnCertificate(userId: string, eventId: string, bytes: Buffer): Promise<EventView> {
    const { row } = await this.ownEvent(userId, eventId);
    this.ensureEventPending(row);
    const stored = await this.storeCertificate(bytes);
    const previous = row.pendingCertificateStorageKey;
    row.pendingCertificateUrl = stored.photoUrl;
    row.pendingCertificateStorageKey = stored.storageKey;
    row.reviewStatus = statusAfterEdit(statusOf(row));
    const saved = await this.progress.saveEvent(row);
    if (previous && previous !== stored.storageKey && previous !== row.certificateStorageKey) {
      await this.deleteStored([previous]);
    }
    return this.eventView(saved);
  }

  async removeOwnCertificate(userId: string, eventId: string): Promise<EventView> {
    const { row } = await this.ownEvent(userId, eventId);
    this.ensureEventPending(row);
    const previous = row.pendingCertificateStorageKey;
    row.pendingCertificateUrl = null;
    row.pendingCertificateStorageKey = null;
    row.reviewStatus = statusAfterEdit(statusOf(row));
    const saved = await this.progress.saveEvent(row);
    if (previous && previous !== row.certificateStorageKey) await this.deleteStored([previous]);
    return this.eventView(saved);
  }

  async listSkillQueue(): Promise<SkillReviewItem[]> {
    const rows = await this.progress.listPendingSkills();
    const result: SkillReviewItem[] = [];
    for (const row of rows) {
      const trainee = await this.trainees.findById(row.traineeId);
      if (!trainee) continue;
      result.push({ ...this.skillView(row), ...this.reviewHead(trainee), status: 'pending' });
    }
    return result;
  }

  async listEventQueue(): Promise<EventReviewItem[]> {
    const rows = await this.progress.listPendingEvents();
    const result: EventReviewItem[] = [];
    for (const row of rows) {
      const trainee = await this.trainees.findById(row.traineeId);
      if (!trainee) continue;
      result.push({ ...this.eventView(row), ...this.reviewHead(trainee), status: 'pending' });
    }
    return result;
  }

  async editPendingSkill(skillId: string, body: unknown, actor: Actor): Promise<SkillReviewItem> {
    const row = await this.requirePendingSkill(skillId);
    const content = await this.readSkill(row.traineeId, body, 'patch', this.skillPending(row));
    this.writeSkillPending(row, content);
    await this.progress.saveSkill(row);
    await this.audit(actor, 'portal.skill.admin_updated', row.id, 'trainee_skill');
    return this.skillReview(row);
  }

  async approveSkill(skillId: string, actor: Actor): Promise<SkillReviewItem> {
    const row = await this.requirePendingSkill(skillId);
    const decision = approveOwned(statusOf(row), 'skill');
    if (!decision.ok) throw new ApiError('validation', decision.message);
    const next = this.skillPending(row);
    await this.ownEvidence(row.traineeId, next.evidenceItemId);
    row.name = next.name;
    row.level = next.level;
    row.evidenceItemId = next.evidenceItemId;
    row.slug = await this.uniqueSlug(row.traineeId, skillSlug(next.name), row.id);
    this.clearSkillPending(row);
    row.reviewStatus = 'approved';
    row.rejectionReason = '';
    row.reviewedAt = this.now();
    row.reviewedBy = actor.userId;
    await this.progress.saveSkill(row);
    await this.syncCardSkills(row.traineeId);
    await this.audit(actor, 'portal.skill.approved', row.id, 'trainee_skill');
    return this.skillReview(row);
  }

  async rejectSkill(skillId: string, body: unknown, actor: Actor): Promise<SkillReviewItem> {
    const row = await this.requirePendingSkill(skillId);
    const reason = isRecord(body) && typeof body.reason === 'string' ? body.reason : '';
    const decision = rejectOwned(statusOf(row), reason, 'skill');
    if (!decision.ok) throw new ApiError('validation', decision.message, { reason: decision.message });
    row.reviewStatus = 'rejected';
    row.rejectionReason = decision.reason;
    row.reviewedAt = this.now();
    row.reviewedBy = actor.userId;
    await this.progress.saveSkill(row);
    await this.audit(actor, 'portal.skill.rejected', row.id, 'trainee_skill');
    return this.skillReview(row);
  }

  async editPendingEvent(eventId: string, body: unknown, actor: Actor): Promise<EventReviewItem> {
    const row = await this.requirePendingEvent(eventId);
    const content = this.readEvent(body, 'patch', this.eventPending(row));
    this.writeEventPending(row, content);
    await this.progress.saveEvent(row);
    await this.audit(actor, 'portal.event.admin_updated', row.id, 'trainee_event');
    return this.eventReview(row);
  }

  async approveEvent(eventId: string, actor: Actor): Promise<EventReviewItem> {
    const row = await this.requirePendingEvent(eventId);
    const decision = approveOwned(statusOf(row), 'event');
    if (!decision.ok) throw new ApiError('validation', decision.message);
    const next = this.eventPending(row);
    const previous = row.certificateStorageKey;
    row.title = next.title;
    row.eventDate = next.eventDate;
    row.organiser = next.organiser;
    row.link = next.link;
    row.certificateUrl = row.pendingCertificateUrl;
    row.certificateStorageKey = row.pendingCertificateStorageKey;
    this.clearEventPending(row);
    row.reviewStatus = 'approved';
    row.rejectionReason = '';
    row.reviewedAt = this.now();
    row.reviewedBy = actor.userId;
    await this.progress.saveEvent(row);
    if (previous && previous !== row.certificateStorageKey) await this.deleteStored([previous]);
    await this.audit(actor, 'portal.event.approved', row.id, 'trainee_event');
    return this.eventReview(row);
  }

  async rejectEvent(eventId: string, body: unknown, actor: Actor): Promise<EventReviewItem> {
    const row = await this.requirePendingEvent(eventId);
    const reason = isRecord(body) && typeof body.reason === 'string' ? body.reason : '';
    const decision = rejectOwned(statusOf(row), reason, 'event');
    if (!decision.ok) throw new ApiError('validation', decision.message, { reason: decision.message });
    row.reviewStatus = 'rejected';
    row.rejectionReason = decision.reason;
    row.reviewedAt = this.now();
    row.reviewedBy = actor.userId;
    await this.progress.saveEvent(row);
    await this.audit(actor, 'portal.event.rejected', row.id, 'trainee_event');
    return this.eventReview(row);
  }

  async listSkillsForTrainee(traineeId: string): Promise<SkillView[]> {
    await this.requireTrainee(traineeId);
    return (await this.progress.listSkills(traineeId)).map((row) => this.skillView(row));
  }

  async createSkillForTrainee(traineeId: string, body: unknown, actor: Actor): Promise<SkillView> {
    const trainee = await this.requireTrainee(traineeId);
    const content = await this.readSkill(trainee.id, body, 'create', emptySkill());
    const existing = await this.progress.listSkills(trainee.id);
    if (existing.length >= MAX_SKILLS) throw new ApiError('validation', 'A trainee can keep at most 20 skills.');
    const sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
    const row = this.progress.createSkill({
      traineeId: trainee.id,
      slug: await this.uniqueSlug(trainee.id, skillSlug(content.name)),
      sortOrder,
      reviewStatus: 'approved',
      rejectionReason: '',
      submittedAt: null,
      reviewedAt: this.now(),
      reviewedBy: actor.userId,
      name: content.name,
      level: content.level,
      evidenceItemId: content.evidenceItemId,
      hasPending: false,
      pendingName: null,
      pendingLevel: null,
      pendingEvidenceItemId: null,
    });
    const saved = await this.progress.saveSkill(row);
    await this.syncCardSkills(trainee.id);
    await this.audit(actor, 'portal.skill.admin_updated', saved.id, 'trainee_skill');
    return this.skillView(saved);
  }

  async editSkillForTrainee(traineeId: string, skillId: string, body: unknown, actor: Actor): Promise<SkillView> {
    const row = await this.skillForTrainee(traineeId, skillId);
    const content = await this.readSkill(row.traineeId, body, 'patch', this.skillLive(row));
    row.name = content.name;
    row.level = content.level;
    row.evidenceItemId = content.evidenceItemId;
    row.slug = await this.uniqueSlug(row.traineeId, skillSlug(content.name), row.id);
    this.clearSkillPending(row);
    row.reviewStatus = 'approved';
    row.rejectionReason = '';
    row.reviewedAt = this.now();
    row.reviewedBy = actor.userId;
    await this.progress.saveSkill(row);
    await this.syncCardSkills(row.traineeId);
    await this.audit(actor, 'portal.skill.admin_updated', row.id, 'trainee_skill');
    return this.skillView(row);
  }

  async deleteSkillForTrainee(traineeId: string, skillId: string, actor: Actor): Promise<{ id: string }> {
    const row = await this.skillForTrainee(traineeId, skillId);
    await this.progress.deleteSkill(row.id);
    await this.syncCardSkills(row.traineeId, true);
    await this.audit(actor, 'portal.skill.deleted', row.id, 'trainee_skill');
    return { id: row.id };
  }

  async deleteSkillByAdmin(skillId: string, actor: Actor): Promise<{ id: string }> {
    if (!UUID.test(skillId)) throw new ApiError('not_found', MISSING_SKILL);
    const row = await this.progress.findSkill(skillId);
    if (!row) throw new ApiError('not_found', MISSING_SKILL);
    return this.deleteSkillForTrainee(row.traineeId, row.id, actor);
  }

  async listEventsForTrainee(traineeId: string): Promise<EventView[]> {
    await this.requireTrainee(traineeId);
    return (await this.progress.listEvents(traineeId)).map((row) => this.eventView(row));
  }

  async createEventForTrainee(traineeId: string, body: unknown, actor: Actor): Promise<EventView> {
    const trainee = await this.requireTrainee(traineeId);
    const content = this.readEvent(body, 'create', emptyEvent());
    const existing = await this.progress.listEvents(trainee.id);
    if (existing.length >= MAX_EVENTS) throw new ApiError('validation', 'A trainee can keep at most 30 events.');
    const sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
    const row = this.progress.createEvent({
      traineeId: trainee.id,
      sortOrder,
      reviewStatus: 'approved',
      rejectionReason: '',
      submittedAt: null,
      reviewedAt: this.now(),
      reviewedBy: actor.userId,
      title: content.title,
      eventDate: content.eventDate,
      organiser: content.organiser,
      link: content.link,
      certificateUrl: null,
      certificateStorageKey: null,
      hasPending: false,
      pendingTitle: null,
      pendingEventDate: null,
      pendingOrganiser: null,
      pendingLink: null,
      pendingCertificateUrl: null,
      pendingCertificateStorageKey: null,
    });
    const saved = await this.progress.saveEvent(row);
    await this.audit(actor, 'portal.event.admin_updated', saved.id, 'trainee_event');
    return this.eventView(saved);
  }

  async editEventForTrainee(traineeId: string, eventId: string, body: unknown, actor: Actor): Promise<EventView> {
    const row = await this.eventForTrainee(traineeId, eventId);
    const content = this.readEvent(body, 'patch', this.eventLive(row));
    const orphan = row.pendingCertificateStorageKey;
    row.title = content.title;
    row.eventDate = content.eventDate;
    row.organiser = content.organiser;
    row.link = content.link;
    this.clearEventPending(row);
    if (orphan && orphan !== row.certificateStorageKey) await this.deleteStored([orphan]);
    row.reviewStatus = 'approved';
    row.rejectionReason = '';
    row.reviewedAt = this.now();
    row.reviewedBy = actor.userId;
    await this.progress.saveEvent(row);
    await this.audit(actor, 'portal.event.admin_updated', row.id, 'trainee_event');
    return this.eventView(row);
  }

  async deleteEventForTrainee(traineeId: string, eventId: string, actor: Actor): Promise<{ id: string }> {
    const row = await this.eventForTrainee(traineeId, eventId);
    const keys = certificateKeys(row);
    await this.progress.deleteEvent(row.id);
    await this.deleteStored(keys);
    await this.audit(actor, 'portal.event.deleted', row.id, 'trainee_event');
    return { id: row.id };
  }

  async deleteEventByAdmin(eventId: string, actor: Actor): Promise<{ id: string }> {
    if (!UUID.test(eventId)) throw new ApiError('not_found', MISSING_EVENT);
    const row = await this.progress.findEvent(eventId);
    if (!row) throw new ApiError('not_found', MISSING_EVENT);
    return this.deleteEventForTrainee(row.traineeId, row.id, actor);
  }

  async addCertificateForTrainee(traineeId: string, eventId: string, bytes: Buffer, actor: Actor): Promise<EventView> {
    const row = await this.eventForTrainee(traineeId, eventId);
    const stored = await this.storeCertificate(bytes);
    const previous = [...new Set([row.certificateStorageKey, row.pendingCertificateStorageKey].filter((key): key is string => Boolean(key)))];
    row.certificateUrl = stored.photoUrl;
    row.certificateStorageKey = stored.storageKey;
    row.pendingCertificateUrl = row.hasPending ? stored.photoUrl : row.pendingCertificateUrl;
    row.pendingCertificateStorageKey = row.hasPending ? stored.storageKey : row.pendingCertificateStorageKey;
    await this.progress.saveEvent(row);
    await this.deleteStored(previous.filter((key) => key !== stored.storageKey));
    await this.audit(actor, 'portal.event.admin_updated', row.id, 'trainee_event');
    return this.eventView(row);
  }

  async listForTrainer(userId: string): Promise<TrainerTraineeView[]> {
    const trainer = await this.timetable.findTrainerByUserId(userId);
    if (!trainer) throw new ApiError('forbidden', UNLINKED);
    const skills = await this.progress.listAllSkills();
    const events = await this.progress.listAllEvents();
    const ids = [...new Set([...skills.map((row) => row.traineeId), ...events.map((row) => row.traineeId)])];
    const result: TrainerTraineeView[] = [];
    for (const id of ids) {
      const trainee = await this.trainees.findById(id);
      if (!trainee) continue;
      result.push({
        id: trainee.id,
        displayName: trainee.displayName,
        skills: skills.filter((row) => row.traineeId === id).map((row) => this.skillView(row)),
        events: events.filter((row) => row.traineeId === id).map((row) => this.eventView(row)),
      });
    }
    result.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return result;
  }

  async listPublicSkills(traineeId: string): Promise<PublicSkill[]> {
    const trainee = await this.publicTrainee(traineeId);
    const rows = (await this.progress.listSkills(trainee.id)).filter((row) => row.name.trim().length > 0);
    const result: PublicSkill[] = [];
    for (const row of rows) {
      result.push({
        id: row.id,
        name: row.name,
        level: row.level,
        evidence: await this.publicEvidence(row.evidenceItemId, trainee.id),
      });
    }
    return result;
  }

  async listPublicEvents(traineeId: string): Promise<PublicEvent[]> {
    const trainee = await this.publicTrainee(traineeId);
    const showCertificate = trainee.consentReceived && trainee.photoConsent;
    return (await this.progress.listEvents(trainee.id))
      .filter((row) => row.title.trim().length > 0)
      .map((row) => ({
        id: row.id,
        title: row.title,
        eventDate: row.eventDate,
        organiser: row.organiser,
        link: row.link,
        certificateUrl: showCertificate ? row.certificateUrl : null,
      }));
  }

  private async publicEvidence(
    itemId: string | null,
    traineeId: string,
  ): Promise<PublicSkill['evidence']> {
    if (!itemId) return null;
    const item = await this.portfolio.findItem(itemId);
    if (!item || item.traineeId !== traineeId || !item.title.trim()) return null;
    return { id: item.id, title: item.title, kind: item.kind };
  }

  private async readSkill(
    traineeId: string,
    body: unknown,
    mode: 'create' | 'patch',
    current: SkillContent,
  ): Promise<SkillContent> {
    const parsed = readSkillWrite(body, mode, current);
    if (Object.keys(parsed.errors).length) {
      throw new ApiError('validation', 'Check the highlighted fields.', parsed.errors);
    }
    await this.ownEvidence(traineeId, parsed.value.evidenceItemId);
    return parsed.value;
  }

  private readEvent(body: unknown, mode: 'create' | 'patch', current: EventContent): EventContent {
    const parsed = readEventWrite(body, mode, current);
    if (Object.keys(parsed.errors).length) {
      throw new ApiError('validation', 'Check the highlighted fields.', parsed.errors);
    }
    return parsed.value;
  }

  private async ownEvidence(traineeId: string, itemId: string | null): Promise<void> {
    if (!itemId) return;
    const item = await this.portfolio.findItem(itemId);
    if (!item || item.traineeId !== traineeId) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        evidenceItemId: 'Choose one of your portfolio items.',
      });
    }
  }

  private async ownTrainee(userId: string): Promise<TraineeEntity> {
    const user = await this.users.findById(userId);
    if (!user?.traineeId) throw new ApiError('not_found', 'Your login is not linked to a trainee record yet.');
    const trainee = await this.trainees.findById(user.traineeId);
    if (!trainee) throw new ApiError('not_found', 'Your login is not linked to a trainee record yet.');
    return trainee;
  }

  private async requireTrainee(traineeId: string): Promise<TraineeEntity> {
    const trainee = await this.trainees.findById(traineeId);
    if (!trainee) throw new ApiError('not_found', 'That trainee was not found.');
    return trainee;
  }

  private async publicTrainee(traineeId: string): Promise<TraineeEntity> {
    const trainee = await this.trainees.findById(traineeId);
    if (!trainee || !isPublicTrainee(trainee)) throw new ApiError('not_found', 'That page is not available.');
    return trainee;
  }

  private async ownSkill(userId: string, skillId: string): Promise<{ trainee: TraineeEntity; row: TraineeSkillEntity }> {
    const trainee = await this.ownTrainee(userId);
    const row = await this.findOwnSkill(trainee.id, skillId);
    return { trainee, row };
  }

  private async ownEvent(userId: string, eventId: string): Promise<{ trainee: TraineeEntity; row: TraineeEventEntity }> {
    const trainee = await this.ownTrainee(userId);
    const row = await this.findOwnEvent(trainee.id, eventId);
    return { trainee, row };
  }

  private async findOwnSkill(traineeId: string, skillId: string): Promise<TraineeSkillEntity> {
    if (!UUID.test(skillId)) throw new ApiError('not_found', MISSING_SKILL);
    const row = await this.progress.findSkill(skillId);
    if (!row || row.traineeId !== traineeId) throw new ApiError('not_found', MISSING_SKILL);
    return row;
  }

  private async findOwnEvent(traineeId: string, eventId: string): Promise<TraineeEventEntity> {
    if (!UUID.test(eventId)) throw new ApiError('not_found', MISSING_EVENT);
    const row = await this.progress.findEvent(eventId);
    if (!row || row.traineeId !== traineeId) throw new ApiError('not_found', MISSING_EVENT);
    return row;
  }

  private async skillForTrainee(traineeId: string, skillId: string): Promise<TraineeSkillEntity> {
    await this.requireTrainee(traineeId);
    return this.findOwnSkill(traineeId, skillId);
  }

  private async eventForTrainee(traineeId: string, eventId: string): Promise<TraineeEventEntity> {
    await this.requireTrainee(traineeId);
    return this.findOwnEvent(traineeId, eventId);
  }

  private async requirePendingSkill(skillId: string): Promise<TraineeSkillEntity> {
    if (!UUID.test(skillId)) throw new ApiError('not_found', NOT_WAITING_SKILL);
    const row = await this.progress.findSkill(skillId);
    if (!row || statusOf(row) !== 'pending' || !row.hasPending) throw new ApiError('not_found', NOT_WAITING_SKILL);
    return row;
  }

  private async requirePendingEvent(eventId: string): Promise<TraineeEventEntity> {
    if (!UUID.test(eventId)) throw new ApiError('not_found', NOT_WAITING_EVENT);
    const row = await this.progress.findEvent(eventId);
    if (!row || statusOf(row) !== 'pending' || !row.hasPending) throw new ApiError('not_found', NOT_WAITING_EVENT);
    return row;
  }

  private async uniqueSlug(traineeId: string, base: string, exceptId?: string): Promise<string> {
    const taken = new Set(
      (await this.progress.listSkills(traineeId)).filter((row) => row.id !== exceptId).map((row) => row.slug),
    );
    if (!taken.has(base)) return base;
    for (let index = 2; index < 100; index += 1) {
      const suffix = `-${index}`;
      const next = `${base.slice(0, 60 - suffix.length)}${suffix}`;
      if (!taken.has(next)) return next;
    }
    throw new ApiError('validation', 'Check the highlighted fields.', { name: 'Choose a different skill name.' });
  }

  private async syncCardSkills(traineeId: string, allowEmpty = false): Promise<void> {
    const rows = await this.progress.listSkills(traineeId);
    if (rows.length === 0 && !allowEmpty) return;
    const trainee = await this.trainees.findById(traineeId);
    if (!trainee) return;
    trainee.skills = rows
      .filter((row) => row.reviewStatus === 'approved' && row.name.trim())
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((row) => row.name.trim())
      .slice(0, 20);
    await this.trainees.save(trainee);
  }

  private skillLive(row: TraineeSkillEntity): SkillContent {
    return { name: row.name, level: row.level, evidenceItemId: row.evidenceItemId };
  }

  private skillPending(row: TraineeSkillEntity): SkillContent {
    if (!row.hasPending) return this.skillLive(row);
    return {
      name: row.pendingName ?? '',
      level: row.pendingLevel ?? 1,
      evidenceItemId: row.pendingEvidenceItemId,
    };
  }

  private writeSkillPending(row: TraineeSkillEntity, content: SkillContent): void {
    row.hasPending = true;
    row.pendingName = content.name;
    row.pendingLevel = content.level;
    row.pendingEvidenceItemId = content.evidenceItemId;
  }

  private ensureSkillPending(row: TraineeSkillEntity): void {
    if (row.hasPending) return;
    this.writeSkillPending(row, this.skillLive(row));
  }

  private clearSkillPending(row: TraineeSkillEntity): void {
    row.hasPending = false;
    row.pendingName = null;
    row.pendingLevel = null;
    row.pendingEvidenceItemId = null;
  }

  private eventLive(row: TraineeEventEntity): EventContent {
    return { title: row.title, eventDate: row.eventDate, organiser: row.organiser, link: row.link };
  }

  private eventPending(row: TraineeEventEntity): EventContent {
    if (!row.hasPending) return this.eventLive(row);
    return {
      title: row.pendingTitle ?? '',
      eventDate: row.pendingEventDate,
      organiser: row.pendingOrganiser ?? '',
      link: row.pendingLink,
    };
  }

  private writeEventPending(row: TraineeEventEntity, content: EventContent): void {
    row.hasPending = true;
    row.pendingTitle = content.title;
    row.pendingEventDate = content.eventDate;
    row.pendingOrganiser = content.organiser;
    row.pendingLink = content.link;
  }

  private ensureEventPending(row: TraineeEventEntity): void {
    if (row.hasPending) return;
    this.writeEventPending(row, this.eventLive(row));
    row.pendingCertificateUrl = row.certificateUrl;
    row.pendingCertificateStorageKey = row.certificateStorageKey;
  }

  private clearEventPending(row: TraineeEventEntity): void {
    this.clearEventTextPending(row);
    row.pendingCertificateUrl = null;
    row.pendingCertificateStorageKey = null;
  }

  private clearEventTextPending(row: TraineeEventEntity): void {
    row.hasPending = false;
    row.pendingTitle = null;
    row.pendingEventDate = null;
    row.pendingOrganiser = null;
    row.pendingLink = null;
  }

  private skillView(row: TraineeSkillEntity): SkillView {
    return {
      id: row.id,
      sortOrder: row.sortOrder,
      status: statusOf(row),
      rejectionReason: row.rejectionReason,
      submittedAt: row.submittedAt ? isoTimestamp(row.submittedAt) : null,
      draft: this.skillPending(row),
      live: this.skillLive(row),
    };
  }

  private eventView(row: TraineeEventEntity): EventView {
    const draft = this.eventPending(row);
    const live = this.eventLive(row);
    return {
      id: row.id,
      sortOrder: row.sortOrder,
      status: statusOf(row),
      rejectionReason: row.rejectionReason,
      submittedAt: row.submittedAt ? isoTimestamp(row.submittedAt) : null,
      draft: { ...draft, certificateUrl: row.hasPending ? row.pendingCertificateUrl : row.certificateUrl },
      live: { ...live, certificateUrl: row.certificateUrl },
    };
  }

  private reviewHead(trainee: TraineeEntity): Pick<SkillReviewItem, 'traineeId' | 'email' | 'traineeName' | 'consents'> {
    return {
      traineeId: trainee.id,
      email: trainee.email,
      traineeName: trainee.displayName,
      consents: { publicProfile: trainee.consentReceived, publicPhoto: trainee.photoConsent },
    };
  }

  private async skillReview(row: TraineeSkillEntity): Promise<SkillReviewItem> {
    const trainee = await this.requireTrainee(row.traineeId);
    return { ...this.skillView(row), ...this.reviewHead(trainee) };
  }

  private async eventReview(row: TraineeEventEntity): Promise<EventReviewItem> {
    const trainee = await this.requireTrainee(row.traineeId);
    return { ...this.eventView(row), ...this.reviewHead(trainee) };
  }

  private async storeCertificate(bytes: Buffer): Promise<{ photoUrl: string; storageKey: string }> {
    try {
      return await storeProfilePhoto(bytes, this.storage, this.maxImageBytes);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors?.photoUrl) {
        const { photoUrl, ...rest } = error.fieldErrors;
        throw new ApiError(error.code, error.message, { ...rest, certificate: photoUrl });
      }
      throw error;
    }
  }

  private async deleteStored(keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        await this.storage.delete(key);
      } catch {
        // A missing object should not block the trainee from removing the event.
      }
    }
  }

  private audit(actor: Actor, action: AuditAction, subjectId: string, subjectType: string): Promise<void> {
    return this.auditLog.record({
      action,
      actorUserId: actor.userId,
      ip: actor.ip,
      requestId: actor.requestId,
      subjectType,
      subjectId,
    });
  }
}

function statusOf(row: { reviewStatus: string }): ReviewStatus {
  return isReviewStatus(row.reviewStatus) ? row.reviewStatus : 'draft';
}

function certificateKeys(row: TraineeEventEntity): string[] {
  return [...new Set([row.certificateStorageKey, row.pendingCertificateStorageKey].filter((key): key is string => Boolean(key)))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
