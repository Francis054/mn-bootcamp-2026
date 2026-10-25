import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { Listing, PublicationStatus } from '../curriculum/publication.js';
import type { StorageLabel } from '../gallery/media.entity.js';

/**
 * A photo of a trainee working. An administrator uploads it. It stays off the
 * public site until that administrator publishes it.
 */
@Entity({ name: 'work_photos' })
export class WorkPhotoEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'trainee_id', type: 'varchar', length: 64 })
  traineeId!: string;

  @Column({ name: 'project_id', type: 'varchar', length: 64, nullable: true })
  projectId!: string | null;

  @Column({ type: 'varchar', length: 1000, default: '' })
  src!: string;

  @Column({ type: 'int' })
  width!: number;

  @Column({ type: 'int' })
  height!: number;

  @Column({ type: 'varchar', length: 300 })
  alt!: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  caption!: string;

  @Column({ name: 'publication_status', type: 'varchar', length: 32 })
  publicationStatus!: PublicationStatus;

  @Column({ type: 'varchar', length: 16 })
  listing!: Listing;

  @Column({ name: 'storage_provider', type: 'varchar', length: 32 })
  storageProvider!: StorageLabel;

  @Column({ name: 'storage_key', type: 'varchar', length: 500, default: '' })
  storageKey!: string;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
