import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { Listing, PublicationStatus } from '../curriculum/publication.js';

@Entity({ name: 'projects' })
export class ProjectEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 200 })
  slug!: string;

  @Column({ type: 'varchar', length: 40 })
  type!: string;

  @Column({ name: 'module_id', type: 'varchar', length: 40 })
  moduleId!: string;

  @Column({ type: 'varchar', length: 200 })
  cover!: string;

  @Column({ type: 'varchar', length: 200 })
  image!: string;

  @Column({ type: 'text' })
  abstract!: string;

  @Column({ type: 'varchar', length: 500 })
  tools!: string;

  @Column({ type: 'text', array: true })
  steps!: string[];

  @Column({ type: 'text', array: true })
  team!: string[];

  @Column({ name: 'repository_url', type: 'varchar', length: 500 })
  repositoryUrl!: string;

  @Column({ name: 'demo_url', type: 'varchar', length: 500 })
  demoUrl!: string;

  @Column({ name: 'lab_only_confirmed', type: 'boolean' })
  labOnlyConfirmed!: boolean;

  /** Stored for the current form. It does not publish the links. */
  @Column({ name: 'share_agreed', type: 'boolean' })
  shareAgreed!: boolean;

  @Column({ name: 'publication_status', type: 'varchar', length: 32 })
  publicationStatus!: PublicationStatus;

  @Column({ type: 'varchar', length: 16 })
  listing!: Listing;

  @Column({ name: 'internal_notes', type: 'text' })
  internalNotes!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
