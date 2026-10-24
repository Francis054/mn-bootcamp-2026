import { BaseRepository } from '../../shared/persistence/base-repository.js';
import type { EnquiryEntity } from './enquiry.entity.js';

export class EnquiryRepository extends BaseRepository<EnquiryEntity> {
  listNewest(): Promise<EnquiryEntity[]> {
    return this.repository.find({ order: { createdAt: 'DESC' } });
  }

  insert(row: Omit<EnquiryEntity, 'id' | 'createdAt'>): Promise<EnquiryEntity> {
    return this.repository.save(this.repository.create(row));
  }

  async setHandled(id: string, handled: boolean): Promise<void> {
    await this.repository.update({ id }, { handled });
  }

  async setNotified(id: string, notified: boolean): Promise<void> {
    await this.repository.update({ id }, { notified });
  }

  async deleteById(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
