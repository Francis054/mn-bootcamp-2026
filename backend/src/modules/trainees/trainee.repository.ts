import { BaseRepository } from '../../shared/persistence/base-repository.js';
import type { TraineeEntity } from './trainee.entity.js';

export class TraineeRepository extends BaseRepository<TraineeEntity> {
  findAll(): Promise<TraineeEntity[]> {
    return this.repository.find({ order: { displayName: 'ASC', id: 'ASC' } });
  }

  findByEmail(email: string): Promise<TraineeEntity | null> {
    return this.repository.findOne({ where: { email } });
  }

  countByModule(focus: string): Promise<number> {
    return this.repository.count({ where: { focus } });
  }

  insert(trainee: Omit<TraineeEntity, 'createdAt' | 'updatedAt'>): Promise<TraineeEntity> {
    return this.repository.save(this.repository.create(trainee));
  }

  async remove(trainee: TraineeEntity): Promise<void> {
    await this.repository.remove(trainee);
  }
}
