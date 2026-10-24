import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { Listing, PublicationStatus } from './publication.js';

@Entity({ name: 'modules' })
export class ModuleEntity {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 40 })
  short!: string;

  @Column({ type: 'varchar', length: 40 })
  icon!: string;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ name: 'sort_order', type: 'integer' })
  sortOrder!: number;

  @Column({ name: 'publication_status', type: 'varchar', length: 32 })
  publicationStatus!: PublicationStatus;

  @Column({ type: 'varchar', length: 16 })
  listing!: Listing;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
