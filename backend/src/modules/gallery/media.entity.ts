import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { Listing, PublicationStatus } from '../curriculum/publication.js';

export const MEDIA_CONSENTS = ['pending', 'verified', 'withdrawn'] as const;
export type MediaConsent = (typeof MEDIA_CONSENTS)[number];

export const STORAGE_LABELS = ['static', 'memory', 'cloudinary', 'unconfigured'] as const;
export type StorageLabel = (typeof STORAGE_LABELS)[number];

@Entity({ name: 'media_assets' })
export class MediaEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 80 })
  file!: string;

  @Column({ type: 'varchar', length: 1000, default: '' })
  src!: string;

  @Column({ type: 'int' })
  width!: number;

  @Column({ type: 'int' })
  height!: number;

  @Column({ type: 'varchar', length: 500 })
  caption!: string;

  @Column({ type: 'varchar', length: 300 })
  alt!: string;

  @Column({ type: 'varchar', length: 32 })
  album!: string;

  @Column({ type: 'varchar', length: 16 })
  consent!: MediaConsent;

  @Column({ name: 'consent_verified_at', type: 'timestamptz', nullable: true })
  consentVerifiedAt!: Date | null;

  @Column({ name: 'consent_recorded_by', type: 'uuid', nullable: true })
  consentRecordedBy!: string | null;

  @Column({ name: 'consent_withdrawn_at', type: 'timestamptz', nullable: true })
  consentWithdrawnAt!: Date | null;

  @Column({ name: 'publication_status', type: 'varchar', length: 32 })
  publicationStatus!: PublicationStatus;

  @Column({ type: 'varchar', length: 16 })
  listing!: Listing;

  /** `static` means the bytes stay in the site assets. A request does not delete them. */
  @Column({ name: 'storage_provider', type: 'varchar', length: 32 })
  storageProvider!: StorageLabel;

  @Column({ name: 'storage_key', type: 'varchar', length: 500, default: '' })
  storageKey!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
