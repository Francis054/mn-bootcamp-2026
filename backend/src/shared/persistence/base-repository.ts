import type { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm';

/**
 * Shared database access for later modules. A service receives a repository
 * from the composition root. It does not construct TypeORM itself.
 */
export abstract class BaseRepository<T extends ObjectLiteral & { id: string }> {
  constructor(protected readonly repository: Repository<T>) {}

  findById(id: string): Promise<T | null> {
    return this.repository.findOne({ where: { id } as FindOptionsWhere<T> });
  }

  save(entity: T): Promise<T> {
    return this.repository.save(entity);
  }
}
