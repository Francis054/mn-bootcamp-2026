import { BaseRepository } from '../../shared/persistence/base-repository.js';
import type { ContentSingletonEntity } from './content.entity.js';

export class ContentRepository extends BaseRepository<ContentSingletonEntity> {
  insert(row: Omit<ContentSingletonEntity, 'updatedAt'>): Promise<ContentSingletonEntity> {
    return this.repository.save(this.repository.create(row));
  }
}
