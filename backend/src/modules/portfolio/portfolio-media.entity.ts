import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const MEDIA_SLOTS = ['live', 'pending'] as const;
export type MediaSlot = (typeof MEDIA_SLOTS)[number];

export const MEDIA_KINDS = ['image', 'video_file', 'video_link'] as const;
export type PortfolioMediaKind = (typeof MEDIA_KINDS)[number];

@Entity({ name: 'portfolio_media' })
export class PortfolioMediaEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId!: string;

  @Column({ name: 'trainee_id', type: 'varchar', length: 64 })
  traineeId!: string;

  @Column({ type: 'varchar', length: 8 })
  slot!: MediaSlot;

  @Column({ type: 'varchar', length: 16 })
  kind!: PortfolioMediaKind;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'varchar', length: 200, default: '' })
  alt!: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 300, nullable: true })
  storageKey!: string | null;

  @Column({ name: 'public_url', type: 'varchar', length: 1000, nullable: true })
  publicUrl!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mime!: string | null;

  @Column({ name: 'byte_size', type: 'int', nullable: true })
  byteSize!: number | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  provider!: string | null;

  @Column({ name: 'external_id', type: 'varchar', length: 64, nullable: true })
  externalId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
