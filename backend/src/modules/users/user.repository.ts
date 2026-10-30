import { BaseRepository } from '../../shared/persistence/base-repository.js';
import type { Role } from './role.js';
import type { UserEntity } from './user.entity.js';

type NewUser = Omit<
  UserEntity,
  'id' | 'createdAt' | 'updatedAt' | 'emailVerifiedAt' | 'traineeId' | 'disabledAt' | 'lastLoginAt'
> &
  Partial<Pick<UserEntity, 'emailVerifiedAt' | 'traineeId' | 'disabledAt' | 'lastLoginAt'>>;

export class UserRepository extends BaseRepository<UserEntity> {
  findByEmail(email: string): Promise<UserEntity | null> {
    return this.repository.findOne({ where: { email } });
  }

  findByTraineeId(traineeId: string): Promise<UserEntity | null> {
    return this.repository.findOne({ where: { traineeId } });
  }

  list(): Promise<UserEntity[]> {
    return this.repository.find({ order: { createdAt: 'ASC' } });
  }

  listByRole(role: Role): Promise<UserEntity[]> {
    return this.repository.find({ where: { role }, order: { displayName: 'ASC' } });
  }

  async rename(id: string, displayName: string, initials: string): Promise<void> {
    await this.repository.update({ id }, { displayName, initials });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.repository.update({ id }, { passwordHash });
  }

  async updateRole(id: string, role: Role): Promise<void> {
    await this.repository.update({ id }, { role });
  }

  async markEmailVerified(id: string, at: Date): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update()
      .set({ emailVerifiedAt: at })
      .where('id = :id AND email_verified_at IS NULL', { id })
      .execute();
  }

  async setTraineeLink(id: string, traineeId: string | null): Promise<void> {
    await this.repository.update({ id }, { traineeId });
  }

  async setDisabledAt(id: string, disabledAt: Date | null): Promise<void> {
    await this.repository.update({ id }, { disabledAt });
  }

  async setLastLogin(id: string, lastLoginAt: Date): Promise<void> {
    await this.repository.update({ id }, { lastLoginAt });
  }

  async replaceUnverifiedLogin(
    id: string,
    patch: { passwordHash: string; displayName: string; initials: string; hue: number; traineeId: string | null },
  ): Promise<void> {
    await this.repository.update({ id }, patch);
  }

  insert(user: NewUser): Promise<UserEntity> {
    return this.repository.save(
      this.repository.create({
        emailVerifiedAt: null,
        traineeId: null,
        disabledAt: null,
        lastLoginAt: null,
        ...user,
      }),
    );
  }
}
