import { BaseRepository } from '../../shared/persistence/base-repository.js';
import type { AboutPersonEntity, AboutPersonGroup } from './about-person.entity.js';

export class AboutPersonRepository extends BaseRepository<AboutPersonEntity> {
  findAll(): Promise<AboutPersonEntity[]> {
    return this.repository.find({
      order: { displayOrder: 'ASC', name: 'ASC', id: 'ASC' },
    });
  }

  findByGroup(group: AboutPersonGroup): Promise<AboutPersonEntity[]> {
    return this.repository.find({
      where: { group },
      order: { displayOrder: 'ASC', name: 'ASC', id: 'ASC' },
    });
  }

  insert(person: Omit<AboutPersonEntity, 'createdAt' | 'updatedAt'>): Promise<AboutPersonEntity> {
    return this.repository.save(this.repository.create(person));
  }

  async remove(person: AboutPersonEntity): Promise<void> {
    await this.repository.remove(person);
  }
}
