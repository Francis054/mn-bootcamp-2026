import { describe, expect, it } from 'vitest';
import type { Repository } from 'typeorm';
import { BaseRepository } from '../../src/shared/persistence/base-repository.js';

interface Row {
  id: string;
  name: string;
}

class MemoryRepository extends BaseRepository<Row> {}

describe('BaseRepository', () => {
  it('saves and finds a row by id through the repository it was given', async () => {
    const rows = new Map<string, Row>();
    const repository = {
      findOne: ({ where }: { where: { id?: string } }) => {
        const id = where.id;
        return Promise.resolve(id ? (rows.get(id) ?? null) : null);
      },
      save: (entity: Row) => {
        rows.set(entity.id, entity);
        return Promise.resolve(entity);
      },
    } as unknown as Repository<Row>;

    const store = new MemoryRepository(repository);
    await store.save({ id: 'row-1', name: 'Ada' });
    await expect(store.findById('row-1')).resolves.toEqual({ id: 'row-1', name: 'Ada' });
    await expect(store.findById('missing')).resolves.toBeNull();
  });
});
