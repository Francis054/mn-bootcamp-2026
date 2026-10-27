import type { Repository } from 'typeorm';
import type { SiteImageSeedRow } from './catalogue.js';
import type { SiteImageEntity } from './site-image.entity.js';

export type SiteImageInsert = SiteImageSeedRow & { updatedBy: string | null };

export class SiteImageRepository {
  constructor(private readonly repository: Repository<SiteImageEntity>) {}

  findAll(): Promise<SiteImageEntity[]> {
    return this.repository.find();
  }

  findByKey(key: string): Promise<SiteImageEntity | null> {
    return this.repository.findOne({ where: { key } });
  }

  insert(row: SiteImageInsert): Promise<SiteImageEntity> {
    return this.repository.save(this.repository.create(row));
  }

  save(row: SiteImageEntity): Promise<SiteImageEntity> {
    return this.repository.save(row);
  }

  /** Insert catalogue rows that are not stored yet. An edited row is left alone. */
  async insertMissing(rows: readonly SiteImageSeedRow[]): Promise<void> {
    const existing = new Set((await this.findAll()).map((row) => row.key));
    for (const row of rows) {
      if (existing.has(row.key)) continue;
      await this.insert({ ...row, updatedBy: null });
      existing.add(row.key);
    }
  }
}
