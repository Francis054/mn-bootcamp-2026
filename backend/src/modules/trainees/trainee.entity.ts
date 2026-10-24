import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { Listing, PublicationStatus } from '../curriculum/publication.js';

@Entity({ name: 'trainees' })
export class TraineeEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 120 })
  displayName!: string;

  @Column({ type: 'varchar', length: 8 })
  initials!: string;

  @Column({ type: 'smallint' })
  hue!: number;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'varchar', length: 40 })
  track!: string;

  @Column({ type: 'varchar', length: 40 })
  focus!: string;

  @Column({ type: 'text', array: true })
  skills!: string[];

  @Column({ type: 'text' })
  bio!: string;

  @Column({ type: 'text' })
  quote!: string;

  @Column({ type: 'varchar', length: 500 })
  linkedin!: string;

  @Column({ type: 'varchar', length: 500 })
  portfolio!: string;

  @Column({ name: 'consent_received', type: 'boolean' })
  consentReceived!: boolean;

  @Column({ name: 'consent_received_at', type: 'timestamptz', nullable: true })
  consentReceivedAt!: Date | null;

  @Column({ name: 'consent_recorded_by', type: 'uuid', nullable: true })
  consentRecordedBy!: string | null;

  @Column({ name: 'consent_withdrawn_at', type: 'timestamptz', nullable: true })
  consentWithdrawnAt!: Date | null;

  /** Agreement to show repository and demo links on a published project. */
  @Column({ name: 'links_share_consent', type: 'boolean', default: false })
  linksShareConsent!: boolean;

  @Column({ name: 'links_share_consent_at', type: 'timestamptz', nullable: true })
  linksShareConsentAt!: Date | null;

  @Column({ name: 'links_share_consent_recorded_by', type: 'uuid', nullable: true })
  linksShareConsentRecordedBy!: string | null;

  @Column({ name: 'links_share_consent_withdrawn_at', type: 'timestamptz', nullable: true })
  linksShareConsentWithdrawnAt!: Date | null;

  @Column({ type: 'varchar', length: 16 })
  listing!: Listing;

  @Column({ name: 'publication_status', type: 'varchar', length: 32 })
  publicationStatus!: PublicationStatus;

  @Column({ name: 'status_label', type: 'varchar', length: 80 })
  statusLabel!: string;

  @Column({ name: 'internal_notes', type: 'text' })
  internalNotes!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
