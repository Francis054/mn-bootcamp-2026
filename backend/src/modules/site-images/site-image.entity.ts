import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { StorageLabel } from '../gallery/media.entity.js';
import type { SiteImageFit } from './catalogue.js';

/** One replaceable picture. The key is stable. The url is what the site shows now. */
@Entity({ name: 'site_images' })
export class SiteImageEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key!: string;

  @Column({ type: 'varchar', length: 120 })
  label!: string;

  @Column({ type: 'varchar', length: 400 })
  description!: string;

  @Column({ type: 'varchar', length: 1000 })
  url!: string;

  @Column({ type: 'varchar', length: 300 })
  alt!: string;

  @Column({ type: 'int' })
  width!: number;

  @Column({ type: 'int' })
  height!: number;

  @Column({ type: 'varchar', length: 16 })
  fit!: SiteImageFit;

  @Column({ name: 'default_url', type: 'varchar', length: 1000 })
  defaultUrl!: string;

  @Column({ name: 'default_alt', type: 'varchar', length: 300 })
  defaultAlt!: string;

  @Column({ name: 'default_width', type: 'int' })
  defaultWidth!: number;

  @Column({ name: 'default_height', type: 'int' })
  defaultHeight!: number;

  /** Banner drawn on the original community badge. Empty for other slots. */
  @Column({ type: 'varchar', length: 40, default: '' })
  tagline!: string;

  @Column({ name: 'default_tagline', type: 'varchar', length: 40, default: '' })
  defaultTagline!: string;

  @Column({ name: 'storage_provider', type: 'varchar', length: 32 })
  storageProvider!: StorageLabel;

  @Column({ name: 'storage_key', type: 'varchar', length: 500, default: '' })
  storageKey!: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
