import type { DataSource, EntityManager } from 'typeorm';
import { UserEntity } from '../users/user.entity.js';
import { trainerKey } from './names.js';
import type { ParsedProgramme, TrainerRole } from './model.js';
import { sameTrainerName } from './parse-workbook.js';
import {
  BlockEntity,
  DeliverableEntity,
  ProgrammeEntity,
  SessionEntity,
  SessionTrainerEntity,
  TrainerEntity,
  WeekEntity,
  WeekTrainerEntity,
} from './timetable.entity.js';

export interface TimetableBundle {
  programme: ProgrammeEntity | null;
  blocks: BlockEntity[];
  weeks: WeekEntity[];
  deliverables: DeliverableEntity[];
  trainers: TrainerEntity[];
  weekTrainers: WeekTrainerEntity[];
  sessions: SessionEntity[];
  sessionTrainers: SessionTrainerEntity[];
}

export interface ImportReport {
  weeks: number;
  sessions: number;
  trainers: number;
  deliverables: number;
  removedSessions: number;
}

const EMPTY: TimetableBundle = {
  programme: null,
  blocks: [],
  weeks: [],
  deliverables: [],
  trainers: [],
  weekTrainers: [],
  sessions: [],
  sessionTrainers: [],
};

export class TimetableRepository {
  constructor(private readonly dataSource: DataSource) {}

  async load(): Promise<TimetableBundle> {
    const programme = await this.dataSource.getRepository(ProgrammeEntity).findOne({
      where: { id: 'bootcamp-2026' },
    });
    if (!programme) return EMPTY;
    const [blocks, weeks, deliverables, trainers, weekTrainers, sessions, sessionTrainers] =
      await Promise.all([
        this.dataSource.getRepository(BlockEntity).find({ order: { sortOrder: 'ASC' } }),
        this.dataSource.getRepository(WeekEntity).find({ order: { number: 'ASC' } }),
        this.dataSource.getRepository(DeliverableEntity).find({ order: { sortOrder: 'ASC' } }),
        this.dataSource.getRepository(TrainerEntity).find({ order: { displayName: 'ASC' } }),
        this.dataSource.getRepository(WeekTrainerEntity).find({ order: { sortOrder: 'ASC' } }),
        this.dataSource.getRepository(SessionEntity).find({
          order: { sessionDate: 'ASC', sortOrder: 'ASC' },
        }),
        this.dataSource.getRepository(SessionTrainerEntity).find({ order: { sortOrder: 'ASC' } }),
      ]);
    return { programme, blocks, weeks, deliverables, trainers, weekTrainers, sessions, sessionTrainers };
  }

  async importParsed(parsed: ParsedProgramme): Promise<ImportReport> {
    return this.dataSource.transaction(async (manager) => {
      const users = await manager.getRepository(UserEntity).find();
      const existingTrainers = await manager.getRepository(TrainerEntity).find();
      const existingById = new Map(existingTrainers.map((trainer) => [trainer.id, trainer]));
      const programmeRepo = manager.getRepository(ProgrammeEntity);
      const current = await programmeRepo.findOne({ where: { id: parsed.id } });
      await programmeRepo.save(
        programmeRepo.create({
          id: parsed.id,
          name: parsed.name,
          startsOn: parsed.startsOn,
          endsOn: parsed.endsOn,
          rules: parsed.rules,
          sourceNote: parsed.sourceNote,
          importWarnings: parsed.warnings,
          createdAt: current?.createdAt ?? new Date(),
          updatedAt: new Date(),
        }),
      );

      const blockRepo = manager.getRepository(BlockEntity);
      for (const block of parsed.blocks) {
        const found = await blockRepo.findOne({ where: { id: block.id } });
        await blockRepo.save(
          blockRepo.create({
            ...block,
            programmeId: parsed.id,
            createdAt: found?.createdAt ?? new Date(),
            updatedAt: new Date(),
          }),
        );
      }

      const weekRepo = manager.getRepository(WeekEntity);
      for (const week of parsed.weeks) {
        const found = await weekRepo.findOne({ where: { id: week.id } });
        await weekRepo.save(
          weekRepo.create({
            ...week,
            programmeId: parsed.id,
            createdAt: found?.createdAt ?? new Date(),
            updatedAt: new Date(),
          }),
        );
      }

      for (const trainer of parsed.trainers) {
        const previous = existingById.get(trainer.id);
        const matched = matchUser(trainer.displayName, users);
        await manager.query(
          `INSERT INTO "trainers" ("id", "display_name", "normalized_name", "kind", "proposed", "user_id")
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT ("id") DO UPDATE SET
             "display_name" = EXCLUDED."display_name",
             "normalized_name" = EXCLUDED."normalized_name",
             "kind" = EXCLUDED."kind",
             "proposed" = "trainers"."proposed" AND EXCLUDED."proposed",
             "user_id" = COALESCE(EXCLUDED."user_id", "trainers"."user_id"),
             "updated_at" = now()`,
          [
            trainer.id,
            trainer.displayName,
            trainer.normalizedName,
            trainer.kind,
            previous?.proposed === false ? false : true,
            matched,
          ],
        );
      }

      await replaceDeliverables(manager, parsed);
      await replaceWeekTrainers(manager, parsed);

      const existingSessions = await manager.getRepository(SessionEntity).find({
        where: { origin: 'import' },
      });
      const nextIds = parsed.sessions.map((session) => session.id);
      const removedSessions = existingSessions.filter((session) => !nextIds.includes(session.id)).length;
      if (nextIds.length > 0) {
        await manager.query(
          `DELETE FROM "class_sessions" WHERE "origin" = 'import' AND NOT ("id" = ANY($1::varchar[]))`,
          [nextIds],
        );
      }
      for (const session of parsed.sessions) {
        await manager.query(
          `INSERT INTO "class_sessions" (
             "id", "programme_id", "week_id", "import_key", "session_date", "day_name", "sort_order",
             "session_type", "activity", "topic", "notes", "start_time", "end_time", "raw_time",
             "trainer_status", "origin"
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'import')
           ON CONFLICT ("id") DO UPDATE SET
             "programme_id" = EXCLUDED."programme_id",
             "week_id" = EXCLUDED."week_id",
             "import_key" = EXCLUDED."import_key",
             "session_date" = EXCLUDED."session_date",
             "day_name" = EXCLUDED."day_name",
             "sort_order" = EXCLUDED."sort_order",
             "session_type" = EXCLUDED."session_type",
             "activity" = EXCLUDED."activity",
             "topic" = EXCLUDED."topic",
             "notes" = EXCLUDED."notes",
             "start_time" = EXCLUDED."start_time",
             "end_time" = EXCLUDED."end_time",
             "raw_time" = EXCLUDED."raw_time",
             "trainer_status" = EXCLUDED."trainer_status",
             "origin" = 'import',
             "updated_at" = now()`,
          [
            session.id,
            parsed.id,
            session.weekId,
            session.importKey,
            session.date,
            session.day,
            session.sortOrder,
            session.type,
            session.activity,
            session.topic,
            session.notes,
            session.startTime,
            session.endTime,
            session.rawTime,
            session.trainerStatus,
          ],
        );
      }
      if (nextIds.length > 0) {
        await manager.query(`DELETE FROM "session_trainers" WHERE "session_id" = ANY($1::varchar[])`, [
          nextIds,
        ]);
      }
      for (const link of parsed.sessionTrainers) {
        await manager.query(
          `INSERT INTO "session_trainers" ("session_id", "trainer_id", "sort_order") VALUES ($1, $2, $3)
           ON CONFLICT ("session_id", "trainer_id") DO UPDATE SET "sort_order" = EXCLUDED."sort_order"`,
          [link.sessionId, link.trainerId, link.sortOrder],
        );
      }

      return {
        weeks: parsed.weeks.length,
        sessions: parsed.sessions.length,
        trainers: parsed.trainers.length,
        deliverables: parsed.deliverables.length,
        removedSessions,
      };
    });
  }

  async saveBlock(block: BlockEntity): Promise<BlockEntity> {
    return this.dataSource.getRepository(BlockEntity).save(block);
  }

  async saveWeek(week: WeekEntity): Promise<WeekEntity> {
    return this.dataSource.getRepository(WeekEntity).save(week);
  }

  async saveSession(session: SessionEntity): Promise<SessionEntity> {
    return this.dataSource.getRepository(SessionEntity).save(session);
  }

  async saveTrainer(trainer: TrainerEntity): Promise<TrainerEntity> {
    return this.dataSource.getRepository(TrainerEntity).save(trainer);
  }

  findBlock(id: string): Promise<BlockEntity | null> {
    return this.dataSource.getRepository(BlockEntity).findOne({ where: { id } });
  }

  findWeek(id: string): Promise<WeekEntity | null> {
    return this.dataSource.getRepository(WeekEntity).findOne({ where: { id } });
  }

  findSession(id: string): Promise<SessionEntity | null> {
    return this.dataSource.getRepository(SessionEntity).findOne({ where: { id } });
  }

  findTrainer(id: string): Promise<TrainerEntity | null> {
    return this.dataSource.getRepository(TrainerEntity).findOne({ where: { id } });
  }

  async deleteBlock(block: BlockEntity): Promise<void> {
    await this.dataSource.getRepository(BlockEntity).remove(block);
  }

  async deleteWeek(week: WeekEntity): Promise<void> {
    await this.dataSource.getRepository(WeekEntity).remove(week);
  }

  async deleteSession(session: SessionEntity): Promise<void> {
    await this.dataSource.getRepository(SessionEntity).remove(session);
  }

  async deleteTrainer(trainer: TrainerEntity): Promise<void> {
    await this.dataSource.getRepository(TrainerEntity).remove(trainer);
  }

  async trainerInUse(id: string): Promise<boolean> {
    const weeks = await this.dataSource.getRepository(WeekTrainerEntity).count({ where: { trainerId: id } });
    const sessions = await this.dataSource.getRepository(SessionTrainerEntity).count({
      where: { trainerId: id },
    });
    return weeks + sessions > 0;
  }

  async sessionsOnDate(date: string): Promise<SessionEntity[]> {
    return this.dataSource.getRepository(SessionEntity).find({
      where: { sessionDate: date },
      order: { sortOrder: 'ASC' },
    });
  }

  async replaceSessionTrainers(sessionId: string, trainerIds: string[]): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`DELETE FROM "session_trainers" WHERE "session_id" = $1`, [sessionId]);
      for (const [index, trainerId] of trainerIds.entries()) {
        await manager.query(
          `INSERT INTO "session_trainers" ("session_id", "trainer_id", "sort_order") VALUES ($1, $2, $3)`,
          [sessionId, trainerId, index + 1],
        );
      }
    });
  }

  async replaceDeliverables(weekId: string, titles: string[]): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`DELETE FROM "week_deliverables" WHERE "week_id" = $1`, [weekId]);
      for (const [index, title] of titles.entries()) {
        const sort = index + 1;
        await manager.query(
          `INSERT INTO "week_deliverables" ("id", "week_id", "sort_order", "title") VALUES ($1, $2, $3, $4)`,
          [`${weekId}-d${String(sort).padStart(2, '0')}`.slice(0, 64), weekId, sort, title],
        );
      }
    });
  }

  async replaceRoleTrainers(weekId: string, role: TrainerRole, trainerIds: string[]): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`DELETE FROM "week_trainers" WHERE "week_id" = $1 AND "role" = $2`, [
        weekId,
        role,
      ]);
      for (const [index, trainerId] of trainerIds.entries()) {
        await manager.query(
          `INSERT INTO "week_trainers" ("week_id", "trainer_id", "role", "sort_order") VALUES ($1, $2, $3, $4)`,
          [weekId, trainerId, role, index + 1],
        );
      }
    });
  }

  async programme(): Promise<ProgrammeEntity | null> {
    return this.dataSource.getRepository(ProgrammeEntity).findOne({ where: { id: 'bootcamp-2026' } });
  }
}

async function replaceDeliverables(manager: EntityManager, parsed: ParsedProgramme): Promise<void> {
  const weekIds = parsed.weeks.map((week) => week.id);
  if (weekIds.length === 0) return;
  await manager.query(`DELETE FROM "week_deliverables" WHERE "week_id" = ANY($1::varchar[])`, [weekIds]);
  for (const item of parsed.deliverables) {
    await manager.query(
      `INSERT INTO "week_deliverables" ("id", "week_id", "sort_order", "title") VALUES ($1, $2, $3, $4)`,
      [item.id, item.weekId, item.sortOrder, item.title],
    );
  }
}

async function replaceWeekTrainers(manager: EntityManager, parsed: ParsedProgramme): Promise<void> {
  const weekIds = parsed.weeks.map((week) => week.id);
  if (weekIds.length === 0) return;
  await manager.query(`DELETE FROM "week_trainers" WHERE "week_id" = ANY($1::varchar[])`, [weekIds]);
  for (const link of parsed.weekTrainers) {
    await manager.query(
      `INSERT INTO "week_trainers" ("week_id", "trainer_id", "role", "sort_order") VALUES ($1, $2, $3, $4)`,
      [link.weekId, link.trainerId, link.role, link.sortOrder],
    );
  }
}

function matchUser(displayName: string, users: UserEntity[]): string | null {
  const key = trainerKey(displayName);
  const matches = users.filter(
    (user) => trainerKey(user.displayName) === key || sameTrainerName(user.displayName, displayName),
  );
  return matches.length === 1 ? (matches[0]?.id ?? null) : null;
}
