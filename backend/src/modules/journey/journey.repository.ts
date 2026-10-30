import type { DataSource } from 'typeorm';
import { TraineeMilestoneEntity } from './trainee-milestone.entity.js';

export class JourneyRepository {
  constructor(private readonly dataSource: DataSource) {}

  listForTrainee(traineeId: string): Promise<TraineeMilestoneEntity[]> {
    return this.rows().find({
      where: { traineeId },
      order: { occurredOn: 'ASC', createdAt: 'ASC' },
    });
  }

  findOne(id: string): Promise<TraineeMilestoneEntity | null> {
    return this.rows().findOne({ where: { id } });
  }

  create(value: Partial<TraineeMilestoneEntity>): TraineeMilestoneEntity {
    return this.rows().create(value);
  }

  save(row: TraineeMilestoneEntity): Promise<TraineeMilestoneEntity> {
    return this.rows().save(row);
  }

  async remove(id: string): Promise<void> {
    await this.rows().delete({ id });
  }

  private rows() {
    return this.dataSource.getRepository(TraineeMilestoneEntity);
  }
}
