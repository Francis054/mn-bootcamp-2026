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

  @Column({ type: 'varchar', length: 500, nullable: true })
  linkedin!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  portfolio!: string | null;

  /** Short public line, for example "Aspiring SOC analyst". Empty until someone writes it. */
  @Column({ type: 'varchar', length: 160, default: '' })
  headline!: string;

  /** City or country. Empty until someone writes it. */
  @Column({ type: 'varchar', length: 120, default: '' })
  location!: string;

  @Column({ name: 'github_url', type: 'varchar', length: 500, nullable: true })
  githubUrl!: string | null;

  /** The trainee agreed the profile photo may be public. An administrator's photo sets this too. */
  @Column({ name: 'photo_consent', type: 'boolean', default: false })
  photoConsent!: boolean;

  /** The trainee agreed employers may contact them through the site. The address stays hidden. */
  @Column({ name: 'contact_consent', type: 'boolean', default: false })
  contactConsent!: boolean;

  /** Approved trainee links may appear on the public profile. Administrator links stay off it. */
  @Column({ name: 'public_links', type: 'boolean', default: false })
  publicLinks!: boolean;

  @Column({ name: 'profile_review_status', type: 'varchar', length: 16, default: 'draft' })
  profileReviewStatus!: string;

  @Column({ name: 'profile_rejection_reason', type: 'varchar', length: 500, default: '' })
  profileRejectionReason!: string;

  @Column({ name: 'profile_submitted_at', type: 'timestamptz', nullable: true })
  profileSubmittedAt!: Date | null;

  @Column({ name: 'profile_reviewed_at', type: 'timestamptz', nullable: true })
  profileReviewedAt!: Date | null;

  @Column({ name: 'profile_reviewed_by', type: 'uuid', nullable: true })
  profileReviewedBy!: string | null;

  @Column({ name: 'pending_display_name', type: 'varchar', length: 120, nullable: true })
  pendingDisplayName!: string | null;

  @Column({ name: 'pending_headline', type: 'varchar', length: 160, nullable: true })
  pendingHeadline!: string | null;

  @Column({ name: 'pending_bio', type: 'text', nullable: true })
  pendingBio!: string | null;

  @Column({ name: 'pending_location', type: 'varchar', length: 120, nullable: true })
  pendingLocation!: string | null;

  @Column({ name: 'pending_linkedin', type: 'varchar', length: 500, nullable: true })
  pendingLinkedin!: string | null;

  @Column({ name: 'pending_github_url', type: 'varchar', length: 500, nullable: true })
  pendingGithubUrl!: string | null;

  @Column({ name: 'pending_portfolio', type: 'varchar', length: 500, nullable: true })
  pendingPortfolio!: string | null;

  @Column({ name: 'pending_photo_url', type: 'varchar', length: 1000, nullable: true })
  pendingPhotoUrl!: string | null;

  @Column({ name: 'pending_photo_storage_key', type: 'varchar', length: 200, nullable: true })
  pendingPhotoStorageKey!: string | null;

  /** Public address of the profile photo. Null until an editor uploads one. */
  @Column({ name: 'photo_url', type: 'varchar', length: 1000, nullable: true })
  photoUrl!: string | null;

  /** Provider key for the photo, so replace and remove can delete the previous object. */
  @Column({ name: 'photo_storage_key', type: 'varchar', length: 200, nullable: true })
  photoStorageKey!: string | null;

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

  /** Shareable profile address. Empty until a later publish step sets it. */
  @Column({ type: 'varchar', length: 80, unique: true, nullable: true })
  slug!: string | null;

  @Column({ name: 'cohort_year', type: 'smallint', default: 2026 })
  cohortYear!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
