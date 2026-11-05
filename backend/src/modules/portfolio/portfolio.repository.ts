import { In, type DataSource } from 'typeorm';
import { PortfolioItemEntity } from './portfolio-item.entity.js';
import { PortfolioMediaEntity, type MediaSlot } from './portfolio-media.entity.js';
import { PortfolioVideoGrantEntity } from './portfolio-grant.entity.js';

export class PortfolioRepository {
  constructor(private readonly dataSource: DataSource) {}

  listForTrainee(traineeId: string): Promise<PortfolioItemEntity[]> {
    return this.items().find({
      where: { traineeId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  listPending(): Promise<PortfolioItemEntity[]> {
    return this.items().find({
      where: { reviewStatus: 'pending', hasPending: true },
      order: { submittedAt: 'ASC' },
    });
  }

  findItem(id: string): Promise<PortfolioItemEntity | null> {
    return this.items().findOne({ where: { id } });
  }

  saveItem(row: PortfolioItemEntity): Promise<PortfolioItemEntity> {
    return this.items().save(row);
  }

  createItem(value: Partial<PortfolioItemEntity>): PortfolioItemEntity {
    return this.items().create(value);
  }

  async deleteItem(id: string): Promise<void> {
    await this.items().delete({ id });
  }

  listMedia(itemId: string): Promise<PortfolioMediaEntity[]> {
    return this.media().find({
      where: { itemId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  listMediaForItems(itemIds: string[]): Promise<PortfolioMediaEntity[]> {
    if (itemIds.length === 0) return Promise.resolve([]);
    return this.media().find({
      where: { itemId: In(itemIds) },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  createMedia(value: Partial<PortfolioMediaEntity>): PortfolioMediaEntity {
    return this.media().create(value);
  }

  saveMedia(row: PortfolioMediaEntity): Promise<PortfolioMediaEntity> {
    return this.media().save(row);
  }

  async deleteMedia(id: string): Promise<void> {
    await this.media().delete({ id });
  }

  createGrant(value: Partial<PortfolioVideoGrantEntity>): PortfolioVideoGrantEntity {
    return this.grants().create(value);
  }

  saveGrant(row: PortfolioVideoGrantEntity): Promise<PortfolioVideoGrantEntity> {
    return this.grants().save(row);
  }

  findGrant(id: string): Promise<PortfolioVideoGrantEntity | null> {
    return this.grants().findOne({ where: { id } });
  }

  mediaInSlot(rows: PortfolioMediaEntity[], slot: MediaSlot): PortfolioMediaEntity[] {
    return rows.filter((row) => row.slot === slot);
  }

  private items() {
    return this.dataSource.getRepository(PortfolioItemEntity);
  }

  private media() {
    return this.dataSource.getRepository(PortfolioMediaEntity);
  }

  private grants() {
    return this.dataSource.getRepository(PortfolioVideoGrantEntity);
  }
}
