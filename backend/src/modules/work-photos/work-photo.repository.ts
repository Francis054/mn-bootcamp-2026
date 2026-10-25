import type { FindOptionsWhere } from 'typeorm';
import { BaseRepository } from '../../shared/persistence/base-repository.js';
import type { WorkPhotoEntity } from './work-photo.entity.js';

export class WorkPhotoRepository extends BaseRepository<WorkPhotoEntity> {
  findFiltered(filter: { traineeId?: string; projectId?: string }): Promise<WorkPhotoEntity[]> {
    const where: FindOptionsWhere<WorkPhotoEntity> = {};
    if (filter.traineeId !== undefined) where.traineeId = filter.traineeId;
    if (filter.projectId !== undefined) where.projectId = filter.projectId;
    return this.repository.find({
      where,
      order: { createdAt: 'DESC', id: 'ASC' },
    });
  }

  insert(photo: Omit<WorkPhotoEntity, 'createdAt' | 'updatedAt'>): Promise<WorkPhotoEntity> {
    return this.repository.save(this.repository.create(photo));
  }

  async remove(photo: WorkPhotoEntity): Promise<void> {
    await this.repository.remove(photo);
  }
}
