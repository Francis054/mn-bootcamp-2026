import { BaseRepository } from '../../shared/persistence/base-repository.js';
import type { SessionEntity } from './session.entity.js';

export class SessionRepository extends BaseRepository<SessionEntity> {
  insert(
    session: Pick<SessionEntity, 'id' | 'userId' | 'expiresAt' | 'lastSeenAt'>,
  ): Promise<SessionEntity> {
    return this.repository.save(this.repository.create(session));
  }

  async touch(id: string, lastSeenAt: Date): Promise<void> {
    await this.repository.update({ id }, { lastSeenAt });
  }

  async deleteById(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  /** `keepId` null removes every session for that account. */
  async deleteOthers(userId: string, keepId: string | null): Promise<void> {
    if (keepId === null) {
      await this.repository.delete({ userId });
      return;
    }
    await this.repository
      .createQueryBuilder()
      .delete()
      .where('user_id = :userId AND id <> :keepId', { userId, keepId })
      .execute();
  }
}
