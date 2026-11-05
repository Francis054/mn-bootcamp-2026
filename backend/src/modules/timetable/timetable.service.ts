import { randomBytes } from 'node:crypto';
import type { AuditRepository } from '../auth/audit.repository.js';
import type { UserRepository } from '../users/user.repository.js';
import { curriculumAuditAction } from '../auth/audit-event.entity.js';
import type { Actor } from '../curriculum/actor.js';
import { accraToday } from '../curriculum/schedule.js';
import { ApiError } from '../../shared/errors/api-error.js';
import { postgresCode } from '../../shared/persistence/postgres-error.js';
import { trainerId, trainerKey, trainerKind } from './names.js';
import type {
  PublicTimetable,
  SessionType,
  TrainerRef,
  TrainerRole,
  TrainerStatus,
} from './model.js';
import { parseWorkbook, weekdayName } from './parse-workbook.js';
import type { BlockWriteDto, SessionWriteDto, TrainerPatchDto, WeekPatchDto, WeekWriteDto } from './timetable.dto.js';
import {
  BlockEntity,
  SessionEntity,
  TrainerEntity,
  WeekEntity,
  type ProgrammeEntity,
} from './timetable.entity.js';
import { TimetableRepository, type ImportReport, type TimetableBundle } from './timetable.repository.js';

export interface SessionQuery {
  weekId?: string;
  blockId?: string;
  date?: string;
  trainerId?: string;
  type?: string;
  q?: string;
}

export interface AdminSession {
  id: string;
  weekId: string;
  importKey: string | null;
  date: string;
  day: string;
  sortOrder: number;
  type: SessionType;
  activity: string;
  topic: string;
  notes: string;
  startTime: string | null;
  endTime: string | null;
  rawTime: string;
  trainerStatus: TrainerStatus;
  origin: 'import' | 'admin';
  trainers: TrainerRef[];
}

export interface AdminTimetable extends PublicTimetable {
  sourceNote: string;
  warnings: ProgrammeEntity['importWarnings'];
  sessions: AdminSession[];
  trainers: Array<TrainerRef & { userId: string | null; normalizedName: string }>;
}

export class TimetableService {
  constructor(
    private readonly repository: TimetableRepository,
    private readonly audit: AuditRepository,
    private readonly users: UserRepository,
    private readonly today: () => string = accraToday,
  ) {}

  async publicTimetable(): Promise<PublicTimetable> {
    const bundle = await this.repository.load();
    return toPublic(bundle, this.today());
  }

  async adminTimetable(): Promise<AdminTimetable> {
    const bundle = await this.repository.load();
    const today = this.today();
    const publicBody = toPublic(bundle, today);
    return {
      ...publicBody,
      sourceNote: bundle.programme?.sourceNote ?? '',
      warnings: bundle.programme?.importWarnings ?? [],
      sessions: bundle.sessions.map((session) => toAdminSession(session, bundle)),
      trainers: bundle.trainers.map((trainer) => ({
        ...trainerRef(trainer),
        userId: trainer.userId,
        normalizedName: trainer.normalizedName,
      })),
    };
  }

  async listSessions(query: SessionQuery): Promise<AdminSession[]> {
    const bundle = await this.repository.load();
    const weekIds = new Set(
      bundle.weeks
        .filter((week) => !query.blockId || week.blockId === query.blockId)
        .filter((week) => !query.weekId || week.id === query.weekId)
        .map((week) => week.id),
    );
    const needle = query.q?.trim().toLowerCase() ?? '';
    return bundle.sessions
      .filter((session) => weekIds.has(session.weekId))
      .filter((session) => !query.date || session.sessionDate === query.date)
      .filter((session) => !query.type || session.sessionType === query.type)
      .filter((session) => {
        if (!query.trainerId) return true;
        return bundle.sessionTrainers.some(
          (link) => link.sessionId === session.id && link.trainerId === query.trainerId,
        );
      })
      .filter((session) => {
        if (!needle) return true;
        const names = trainerNames(session.id, bundle);
        return `${session.activity} ${session.topic} ${names.join(' ')}`.toLowerCase().includes(needle);
      })
      .map((session) => toAdminSession(session, bundle));
  }

  async importBuffer(buffer: Buffer, actor: Actor): Promise<ImportReport & { warnings: ProgrammeEntity['importWarnings'] }> {
    let parsed;
    try {
      parsed = parseWorkbook(buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The workbook could not be read.';
      throw new ApiError('validation', message);
    }
    if (parsed.weeks.length === 0 || parsed.sessions.length === 0) {
      throw new ApiError('validation', 'The workbook did not contain weeks and sessions.');
    }
    const report = await this.repository.importParsed(parsed);
    await this.audit.record({
      action: curriculumAuditAction('timetable', 'updated'),
      actorUserId: actor.userId,
      ip: actor.ip,
      requestId: actor.requestId,
      subjectType: 'timetable',
      subjectId: parsed.id,
    });
    return { ...report, warnings: parsed.warnings };
  }

  async createBlock(dto: BlockWriteDto, actor: Actor): Promise<BlockEntity> {
    const programme = await this.requireProgramme();
    const id = `block-${randomBytes(4).toString('hex')}`;
    const saved = await this.repository.saveBlock(
      Object.assign(new BlockEntity(), {
        id,
        programmeId: programme.id,
        sortOrder: dto.sortOrder ?? 0,
        name: dto.name.trim(),
        professionalismTheme: dto.professionalismTheme?.trim() ?? '',
        cybersecurityTheme: dto.cybersecurityTheme?.trim() ?? '',
      }),
    );
    await this.touch(actor, 'created', id);
    return saved;
  }

  async updateBlock(id: string, dto: BlockWriteDto, actor: Actor): Promise<BlockEntity> {
    const block = await this.requireBlock(id);
    block.name = dto.name.trim();
    if (dto.sortOrder !== undefined) block.sortOrder = dto.sortOrder;
    if (dto.professionalismTheme !== undefined) block.professionalismTheme = dto.professionalismTheme.trim();
    if (dto.cybersecurityTheme !== undefined) block.cybersecurityTheme = dto.cybersecurityTheme.trim();
    const saved = await this.repository.saveBlock(block);
    await this.touch(actor, 'updated', id);
    return saved;
  }

  async deleteBlock(id: string, actor: Actor): Promise<{ ok: true }> {
    const block = await this.requireBlock(id);
    try {
      await this.repository.deleteBlock(block);
    } catch (error) {
      if (postgresCode(error) === '23503') {
        throw new ApiError('validation', 'Move or delete the weeks in this block first.');
      }
      throw error;
    }
    await this.touch(actor, 'deleted', id);
    return { ok: true };
  }

  async createWeek(dto: WeekWriteDto, actor: Actor): Promise<WeekEntity> {
    const programme = await this.requireProgramme();
    await this.requireBlock(dto.blockId);
    const id = `week-${randomBytes(4).toString('hex')}`;
    try {
      const saved = await this.repository.saveWeek(
        Object.assign(new WeekEntity(), {
          id,
          programmeId: programme.id,
          blockId: dto.blockId,
          number: dto.number,
          title: dto.title.trim(),
          startsOn: dto.startsOn,
          professionalism: dto.professionalism?.trim() ?? '',
          cybersecurity: dto.cybersecurity?.trim() ?? '',
        }),
      );
      await this.touch(actor, 'created', id);
      return saved;
    } catch (error) {
      if (postgresCode(error) === '23505') {
        throw new ApiError('validation', 'That week number is already in the programme.', {
          number: 'That week number is already in the programme.',
        });
      }
      throw error;
    }
  }

  async updateWeek(id: string, dto: WeekPatchDto, actor: Actor): Promise<WeekEntity> {
    const week = await this.requireWeek(id);
    if (dto.blockId !== undefined) {
      await this.requireBlock(dto.blockId);
      week.blockId = dto.blockId;
    }
    if (dto.title !== undefined) week.title = dto.title.trim();
    if (dto.startsOn !== undefined) week.startsOn = dto.startsOn;
    if (dto.professionalism !== undefined) week.professionalism = dto.professionalism.trim();
    if (dto.cybersecurity !== undefined) week.cybersecurity = dto.cybersecurity.trim();
    const saved = await this.repository.saveWeek(week);
    if (dto.deliverables !== undefined) {
      await this.repository.replaceDeliverables(
        id,
        dto.deliverables.map((title) => title.trim()).filter((title) => title.length > 0),
      );
    }
    if (dto.professionalismTrainerIds !== undefined) {
      await this.assertTrainers(dto.professionalismTrainerIds);
      await this.repository.replaceRoleTrainers(id, 'professionalism', unique(dto.professionalismTrainerIds));
    }
    if (dto.cybersecurityTrainerIds !== undefined) {
      await this.assertTrainers(dto.cybersecurityTrainerIds);
      await this.repository.replaceRoleTrainers(id, 'cybersecurity', unique(dto.cybersecurityTrainerIds));
    }
    await this.touch(actor, 'updated', id);
    return saved;
  }

  async deleteWeek(id: string, actor: Actor): Promise<{ ok: true }> {
    const week = await this.requireWeek(id);
    await this.repository.deleteWeek(week);
    await this.touch(actor, 'deleted', id);
    return { ok: true };
  }

  async createSession(dto: SessionWriteDto, actor: Actor): Promise<AdminSession> {
    const programme = await this.requireProgramme();
    const week = await this.requireWeek(dto.weekId);
    assertTimes(dto.startTime, dto.endTime);
    await this.assertTrainers(dto.trainerIds);
    const day = weekdayName(dto.date);
    const siblings = await this.repository.sessionsOnDate(dto.date);
    const sortOrder = siblings.reduce((max, session) => Math.max(max, session.sortOrder), 0) + 1;
    const saved = await this.repository.saveSession(
      Object.assign(new SessionEntity(), {
        id: `sess-${randomBytes(6).toString('hex')}`,
        programmeId: programme.id,
        weekId: week.id,
        importKey: null,
        sessionDate: dto.date,
        dayName: day,
        sortOrder,
        sessionType: dto.type,
        activity: dto.activity.trim(),
        topic: dto.topic.trim(),
        notes: dto.notes?.trim() ?? '',
        startTime: dto.startTime ?? null,
        endTime: dto.endTime ?? null,
        rawTime: dto.startTime && dto.endTime ? `${dto.startTime}–${dto.endTime}` : '',
        trainerStatus: dto.trainerStatus ?? (dto.trainerIds.length > 0 ? 'assigned' : 'unspecified'),
        origin: 'admin' as const,
      }),
    );
    await this.repository.replaceSessionTrainers(saved.id, unique(dto.trainerIds));
    await this.touch(actor, 'created', saved.id);
    return this.requireAdminSession(saved.id);
  }

  async updateSession(id: string, dto: SessionWriteDto, actor: Actor): Promise<AdminSession> {
    const session = await this.requireSession(id);
    await this.requireWeek(dto.weekId);
    assertTimes(dto.startTime, dto.endTime);
    await this.assertTrainers(dto.trainerIds);
    session.weekId = dto.weekId;
    session.sessionDate = dto.date;
    session.dayName = weekdayName(dto.date);
    session.sessionType = dto.type;
    session.activity = dto.activity.trim();
    session.topic = dto.topic.trim();
    session.notes = dto.notes?.trim() ?? '';
    session.startTime = dto.startTime ?? null;
    session.endTime = dto.endTime ?? null;
    session.rawTime = dto.startTime && dto.endTime ? `${dto.startTime}–${dto.endTime}` : session.rawTime;
    session.trainerStatus = dto.trainerStatus ?? (dto.trainerIds.length > 0 ? 'assigned' : 'unspecified');
    await this.repository.saveSession(session);
    await this.repository.replaceSessionTrainers(id, unique(dto.trainerIds));
    await this.touch(actor, 'updated', id);
    return this.requireAdminSession(id);
  }

  async deleteSession(id: string, actor: Actor): Promise<{ ok: true }> {
    const session = await this.requireSession(id);
    await this.repository.deleteSession(session);
    await this.touch(actor, 'deleted', id);
    return { ok: true };
  }

  async reorderSession(id: string, direction: 'up' | 'down', actor: Actor): Promise<AdminSession> {
    const session = await this.requireSession(id);
    const siblings = await this.repository.sessionsOnDate(session.sessionDate);
    const index = siblings.findIndex((item) => item.id === id);
    const swapWith = siblings[direction === 'up' ? index - 1 : index + 1];
    if (!swapWith) {
      throw new ApiError('validation', 'That session is already at the end of the day.');
    }
    const current = session.sortOrder;
    session.sortOrder = swapWith.sortOrder;
    swapWith.sortOrder = current;
    await this.repository.saveSession(swapWith);
    await this.repository.saveSession(session);
    await this.touch(actor, 'updated', id);
    return this.requireAdminSession(id);
  }

  async updateTrainer(id: string, dto: TrainerPatchDto, actor: Actor): Promise<TrainerEntity> {
    const trainer = await this.requireTrainer(id);
    if (dto.displayName !== undefined) {
      const displayName = dto.displayName.trim();
      if (!displayName) {
        throw new ApiError('validation', 'Check the highlighted fields.', {
          displayName: 'Enter the trainer name.',
        });
      }
      trainer.displayName = displayName;
      trainer.normalizedName = trainerKey(displayName);
      trainer.kind = trainerKind(displayName);
    }
    if (dto.proposed !== undefined) trainer.proposed = dto.proposed;
    if (dto.loginEmail !== undefined) {
      const email = (dto.loginEmail ?? '').trim().toLowerCase();
      if (!email) {
        trainer.userId = null;
      } else {
        const user = await this.users.findByEmail(email);
        if (!user || user.role !== 'trainer') {
          throw new ApiError('validation', 'Check the highlighted fields.', {
            loginEmail: 'Enter the email of a trainer login.',
          });
        }
        const taken = await this.repository.findTrainerByUserId(user.id);
        if (taken && taken.id !== trainer.id) {
          throw new ApiError('validation', 'Check the highlighted fields.', {
            loginEmail: 'That login is already linked to another trainer.',
          });
        }
        trainer.userId = user.id;
      }
    }
    try {
      const saved = await this.repository.saveTrainer(trainer);
      await this.touch(actor, 'updated', id);
      return saved;
    } catch (error) {
      if (postgresCode(error) === '23505') {
        throw new ApiError('validation', 'Another trainer already uses that name.', {
          displayName: 'Another trainer already uses that name.',
        });
      }
      throw error;
    }
  }

  async deleteTrainer(id: string, actor: Actor): Promise<{ ok: true }> {
    const trainer = await this.requireTrainer(id);
    if (await this.repository.trainerInUse(id)) {
      throw new ApiError('validation', 'Remove this trainer from weeks and sessions first.');
    }
    await this.repository.deleteTrainer(trainer);
    await this.touch(actor, 'deleted', id);
    return { ok: true };
  }

  private async requireProgramme(): Promise<ProgrammeEntity> {
    const programme = await this.repository.programme();
    if (!programme) {
      throw new ApiError('validation', 'Import the timetable workbook before adding rows.');
    }
    return programme;
  }

  private async requireBlock(id: string): Promise<BlockEntity> {
    const block = await this.repository.findBlock(id);
    if (!block) throw new ApiError('not_found', 'That block was not found.');
    return block;
  }

  private async requireWeek(id: string): Promise<WeekEntity> {
    const week = await this.repository.findWeek(id);
    if (!week) throw new ApiError('not_found', 'That week was not found.');
    return week;
  }

  private async requireSession(id: string): Promise<SessionEntity> {
    const session = await this.repository.findSession(id);
    if (!session) throw new ApiError('not_found', 'That session was not found.');
    return session;
  }

  private async requireTrainer(id: string): Promise<TrainerEntity> {
    const trainer = await this.repository.findTrainer(id);
    if (!trainer) throw new ApiError('not_found', 'That trainer was not found.');
    return trainer;
  }

  private async requireAdminSession(id: string): Promise<AdminSession> {
    const bundle = await this.repository.load();
    const session = bundle.sessions.find((item) => item.id === id);
    if (!session) throw new ApiError('not_found', 'That session was not found.');
    return toAdminSession(session, bundle);
  }

  private async assertTrainers(ids: string[]): Promise<void> {
    for (const id of unique(ids)) {
      const trainer = await this.repository.findTrainer(id);
      if (!trainer) {
        throw new ApiError('validation', 'Choose a trainer from the list.', {
          trainerIds: 'Choose a trainer from the list.',
        });
      }
    }
  }

  private async touch(actor: Actor, verb: 'created' | 'updated' | 'deleted', id: string): Promise<void> {
    await this.audit.record({
      action: curriculumAuditAction('timetable', verb),
      actorUserId: actor.userId,
      ip: actor.ip,
      requestId: actor.requestId,
      subjectType: 'timetable',
      subjectId: id,
    });
  }
}

function assertTimes(start: string | undefined, end: string | undefined): void {
  if ((start === undefined) !== (end === undefined)) {
    throw new ApiError('validation', 'Enter both a start and an end time.', {
      startTime: 'Enter both a start and an end time.',
    });
  }
  if (start && end && end <= start) {
    throw new ApiError('validation', 'The end time has to be after the start.', {
      endTime: 'The end time has to be after the start.',
    });
  }
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

function trainerRef(trainer: TrainerEntity): TrainerRef {
  return {
    id: trainer.id,
    displayName: trainer.displayName,
    proposed: trainer.proposed,
    kind: trainer.kind,
  };
}

function linksFor(
  bundle: TimetableBundle,
  sessionId: string,
): TrainerRef[] {
  return bundle.sessionTrainers
    .filter((link) => link.sessionId === sessionId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .flatMap((link) => {
      const trainer = bundle.trainers.find((item) => item.id === link.trainerId);
      return trainer ? [trainerRef(trainer)] : [];
    });
}

function trainerNames(sessionId: string, bundle: TimetableBundle): string[] {
  return linksFor(bundle, sessionId).map((trainer) => trainer.displayName);
}

function toAdminSession(session: SessionEntity, bundle: TimetableBundle): AdminSession {
  return {
    id: session.id,
    weekId: session.weekId,
    importKey: session.importKey,
    date: session.sessionDate,
    day: session.dayName,
    sortOrder: session.sortOrder,
    type: session.sessionType,
    activity: session.activity,
    topic: session.topic,
    notes: session.notes,
    startTime: session.startTime,
    endTime: session.endTime,
    rawTime: session.rawTime,
    trainerStatus: session.trainerStatus,
    origin: session.origin,
    trainers: linksFor(bundle, session.id),
  };
}

export function toPublic(bundle: TimetableBundle, today: string): PublicTimetable {
  const trainerById = new Map(bundle.trainers.map((trainer) => [trainer.id, trainer]));
  const roleRefs = (weekId: string, role: TrainerRole): TrainerRef[] =>
    bundle.weekTrainers
      .filter((link) => link.weekId === weekId && link.role === role)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .flatMap((link) => {
        const trainer = trainerById.get(link.trainerId);
        return trainer ? [trainerRef(trainer)] : [];
      });
  const blocks = bundle.blocks.map((block) => ({
    id: block.id,
    sortOrder: block.sortOrder,
    name: block.name,
    professionalismTheme: block.professionalismTheme,
    cybersecurityTheme: block.cybersecurityTheme,
    weeks: bundle.weeks
      .filter((week) => week.blockId === block.id)
      .map((week) => ({
        id: week.id,
        number: week.number,
        title: week.title,
        startsOn: week.startsOn,
        professionalism: week.professionalism,
        cybersecurity: week.cybersecurity,
        deliverables: bundle.deliverables
          .filter((item) => item.weekId === week.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((item) => ({ id: item.id, sortOrder: item.sortOrder, title: item.title })),
        professionalismTrainers: roleRefs(week.id, 'professionalism'),
        cybersecurityTrainers: roleRefs(week.id, 'cybersecurity'),
        sessions: bundle.sessions
          .filter((session) => session.weekId === week.id)
          .map((session) => ({
            id: session.id,
            date: session.sessionDate,
            day: session.dayName,
            sortOrder: session.sortOrder,
            type: session.sessionType,
            activity: session.activity,
            topic: session.topic,
            notes: session.notes,
            startTime: session.startTime,
            endTime: session.endTime,
            trainerStatus: session.trainerStatus,
            trainers: linksFor(bundle, session.id),
          })),
      })),
  }));
  return {
    programme: bundle.programme
      ? {
          id: bundle.programme.id,
          name: bundle.programme.name,
          startsOn: bundle.programme.startsOn,
          endsOn: bundle.programme.endsOn,
          rules: bundle.programme.rules,
        }
      : null,
    today,
    currentWeek: currentWeekNumber(bundle.weeks, today),
    blocks,
    trainers: bundle.trainers.map((trainer) => trainerRef(trainer)),
  };
}

function currentWeekNumber(weeks: WeekEntity[], today: string): number {
  const sorted = [...weeks].sort((a, b) => a.number - b.number);
  const first = sorted[0];
  if (!first) return 1;
  const active = [...sorted].reverse().find((week) => week.startsOn <= today);
  return active?.number ?? first.number;
}

export { trainerId };
