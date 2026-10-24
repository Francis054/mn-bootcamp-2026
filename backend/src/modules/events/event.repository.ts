import { BaseRepository } from '../../shared/persistence/base-repository.js';
import type { EventEntity } from './event.entity.js';

export class EventRepository extends BaseRepository<EventEntity> {
  findAll(): Promise<EventEntity[]> {
    return this.repository.find({ order: { date: 'ASC', id: 'ASC' } });
  }

  insert(event: Omit<EventEntity, 'createdAt' | 'updatedAt'>): Promise<EventEntity> {
    return this.repository.save(this.repository.create(event));
  }

  async remove(event: EventEntity): Promise<void> {
    await this.repository.remove(event);
  }
}
