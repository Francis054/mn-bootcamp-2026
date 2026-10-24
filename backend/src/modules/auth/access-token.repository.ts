import { BaseRepository } from '../../shared/persistence/base-repository.js';
import type { AccessTokenEntity, TokenPurpose } from './access-token.entity.js';

export class AccessTokenRepository extends BaseRepository<AccessTokenEntity> {
  findByHash(tokenHash: string): Promise<AccessTokenEntity | null> {
    return this.repository.findOne({ where: { tokenHash } });
  }

  insert(row: Omit<AccessTokenEntity, 'id' | 'createdAt'>): Promise<AccessTokenEntity> {
    return this.repository.save(this.repository.create(row));
  }

  async deleteById(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  async deleteForUser(userId: string, purpose: TokenPurpose): Promise<void> {
    await this.repository.delete({ userId, purpose });
  }
}
