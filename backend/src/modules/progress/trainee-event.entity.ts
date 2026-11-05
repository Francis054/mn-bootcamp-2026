import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { ReviewStatus } from '../trainees/profile-review.js';

@Entity({ name: 'trainee_events' })
export class TraineeEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trainee_id', type: 'varchar', length: 64 })
  traineeId!: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'review_status', type: 'varchar', length: 16, default: 'draft' })
  reviewStatus!: ReviewStatus;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 500, default: '' })
  rejectionReason!: string;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy!: string | null;

  @Column({ type: 'varchar', length: 200, default: '' })
  title!: string;

  @Column({ name: 'event_date', type: 'varchar', length: 10, nullable: true })
  eventDate!: string | null;

  @Column({ type: 'varchar', length: 160, default: '' })
  organiser!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  link!: string | null;

  @Column({ name: 'certificate_url', type: 'varchar', length: 1000, nullable: true })
  certificateUrl!: string | null;

  @Column({ name: 'certificate_storage_key', type: 'varchar', length: 300, nullable: true })
  certificateStorageKey!: string | null;

  @Column({ name: 'has_pending', type: 'boolean', default: false })
  hasPending!: boolean;

  @Column({ name: 'pending_title', type: 'varchar', length: 200, nullable: true })
  pendingTitle!: string | null;

  @Column({ name: 'pending_event_date', type: 'varchar', length: 10, nullable: true })
  pendingEventDate!: string | null;

  @Column({ name: 'pending_organiser', type: 'varchar', length: 160, nullable: true })
  pendingOrganiser!: string | null;

  @Column({ name: 'pending_link', type: 'varchar', length: 500, nullable: true })
  pendingLink!: string | null;

  @Column({ name: 'pending_certificate_url', type: 'varchar', length: 1000, nullable: true })
  pendingCertificateUrl!: string | null;

  @Column({ name: 'pending_certificate_storage_key', type: 'varchar', length: 300, nullable: true })
  pendingCertificateStorageKey!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
