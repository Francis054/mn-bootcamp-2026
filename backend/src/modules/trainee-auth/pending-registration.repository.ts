import { BaseRepository } from '../../shared/persistence/base-repository.js';
import type { PendingRegistrationEntity, PendingStatus } from './pending-registration.entity.js';

export class PendingRegistrationRepository extends BaseRepository<PendingRegistrationEntity> {
  findByEmail(email: string): Promise<PendingRegistrationEntity | null> {
    return this.repository.findOne({ where: { email } });
  }

  listByStatus(status: PendingStatus): Promise<PendingRegistrationEntity[]> {
    return this.repository.find({ where: { status }, order: { createdAt: 'ASC' } });
  }

  insert(
    row: Omit<PendingRegistrationEntity, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<PendingRegistrationEntity> {
    return this.repository.save(this.repository.create(row));
  }

  override save(row: PendingRegistrationEntity): Promise<PendingRegistrationEntity> {
    return this.repository.save(row);
  }
}
