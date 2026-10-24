import { BaseRepository } from '../../shared/persistence/base-repository.js';
import type { MediaEntity } from './media.entity.js';

export class MediaRepository extends BaseRepository<MediaEntity> {
  findAll(): Promise<MediaEntity[]> {
    return this.repository.find({ order: { file: 'ASC', id: 'ASC' } });
  }

  insert(media: Omit<MediaEntity, 'createdAt' | 'updatedAt'>): Promise<MediaEntity> {
    return this.repository.save(this.repository.create(media));
  }

  async remove(media: MediaEntity): Promise<void> {
    await this.repository.remove(media);
  }
}
