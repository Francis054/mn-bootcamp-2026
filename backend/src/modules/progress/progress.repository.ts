import type { DataSource } from 'typeorm';
import { TraineeEventEntity } from './trainee-event.entity.js';
import { TraineeSkillEntity } from './trainee-skill.entity.js';

export class ProgressRepository {
  constructor(private readonly dataSource: DataSource) {}

  listSkills(traineeId: string): Promise<TraineeSkillEntity[]> {
    return this.skills().find({ where: { traineeId }, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  listAllSkills(): Promise<TraineeSkillEntity[]> {
    return this.skills().find({ order: { traineeId: 'ASC', sortOrder: 'ASC' } });
  }

  listPendingSkills(): Promise<TraineeSkillEntity[]> {
    return this.skills().find({
      where: { reviewStatus: 'pending', hasPending: true },
      order: { submittedAt: 'ASC' },
    });
  }

  findSkill(id: string): Promise<TraineeSkillEntity | null> {
    return this.skills().findOne({ where: { id } });
  }

  createSkill(value: Partial<TraineeSkillEntity>): TraineeSkillEntity {
    return this.skills().create(value);
  }

  saveSkill(row: TraineeSkillEntity): Promise<TraineeSkillEntity> {
    return this.skills().save(row);
  }

  async deleteSkill(id: string): Promise<void> {
    await this.skills().delete({ id });
  }

  listEvents(traineeId: string): Promise<TraineeEventEntity[]> {
    return this.events().find({ where: { traineeId }, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  listAllEvents(): Promise<TraineeEventEntity[]> {
    return this.events().find({ order: { traineeId: 'ASC', sortOrder: 'ASC' } });
  }

  listPendingEvents(): Promise<TraineeEventEntity[]> {
    return this.events().find({
      where: { reviewStatus: 'pending', hasPending: true },
      order: { submittedAt: 'ASC' },
    });
  }

  findEvent(id: string): Promise<TraineeEventEntity | null> {
    return this.events().findOne({ where: { id } });
  }

  createEvent(value: Partial<TraineeEventEntity>): TraineeEventEntity {
    return this.events().create(value);
  }

  saveEvent(row: TraineeEventEntity): Promise<TraineeEventEntity> {
    return this.events().save(row);
  }

  async deleteEvent(id: string): Promise<void> {
    await this.events().delete({ id });
  }

  private skills() {
    return this.dataSource.getRepository(TraineeSkillEntity);
  }

  private events() {
    return this.dataSource.getRepository(TraineeEventEntity);
  }
}
