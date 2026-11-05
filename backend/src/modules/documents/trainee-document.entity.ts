import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { CvReviewStatus, CvVisibility } from './cv-rules.js';

/** The one current CV for a trainee. Replacing it updates this row and deletes the previous file. */
@Entity({ name: 'trainee_documents' })
export class TraineeDocumentEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'trainee_id', type: 'varchar', length: 64 })
  traineeId!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: 'cv';

  @Column({ name: 'file_name', type: 'varchar', length: 200 })
  fileName!: string;

  @Column({ type: 'varchar', length: 100 })
  mime!: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes!: number;

  @Column({ type: 'varchar', length: 64 })
  sha256!: string;

  @Column({ name: 'storage_provider', type: 'varchar', length: 16 })
  storageProvider!: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 300 })
  storageKey!: string;

  @Column({ type: 'varchar', length: 16 })
  visibility!: CvVisibility;

  @Column({ name: 'review_status', type: 'varchar', length: 16 })
  reviewStatus!: CvReviewStatus;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 500 })
  rejectionReason!: string;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy!: string | null;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
