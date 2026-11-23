import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { StorageLabel } from '../gallery/media.entity.js';

export const ABOUT_PERSON_GROUPS = ['founder', 'team', 'partner'] as const;
export type AboutPersonGroup = (typeof ABOUT_PERSON_GROUPS)[number];

/**
 * A person shown on the public About page. An editor or administrator
 * writes the row. It stays off the public site until published is true.
 */
@Entity({ name: 'about_people' })
export class AboutPersonEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'person_group', type: 'varchar', length: 16 })
  group!: AboutPersonGroup;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 160, default: '' })
  title!: string;

  @Column({ type: 'varchar', length: 2000, default: '' })
  description!: string;

  @Column({ name: 'photo_url', type: 'varchar', length: 1000, default: '' })
  photoUrl!: string;

  @Column({ name: 'photo_storage_key', type: 'varchar', length: 500, default: '' })
  photoStorageKey!: string;

  @Column({ name: 'storage_provider', type: 'varchar', length: 32, default: 'memory' })
  storageProvider!: StorageLabel;

  @Column({ type: 'int', default: 0 })
  width!: number;

  @Column({ type: 'int', default: 0 })
  height!: number;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder!: number;

  @Column({ type: 'boolean', default: false })
  published!: boolean;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
