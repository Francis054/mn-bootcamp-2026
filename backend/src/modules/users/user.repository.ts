import { BaseRepository } from '../../shared/persistence/base-repository.js';
import type { Role } from './role.js';
import type { UserEntity } from './user.entity.js';

export class UserRepository extends BaseRepository<UserEntity> {
  findByEmail(email: string): Promise<UserEntity | null> {
    return this.repository.findOne({ where: { email } });
  }

  list(): Promise<UserEntity[]> {
    return this.repository.find({ order: { createdAt: 'ASC' } });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.repository.update({ id }, { passwordHash });
  }

  async updateRole(id: string, role: Role): Promise<void> {
    await this.repository.update({ id }, { role });
  }

  insert(user: Omit<UserEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserEntity> {
    return this.repository.save(this.repository.create(user));
  }
}
