import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { ReviewStatus } from '../trainees/profile-review.js';
import type { SkillLevel } from './progress-rules.js';

@Entity({ name: 'trainee_skills' })
export class TraineeSkillEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trainee_id', type: 'varchar', length: 64 })
  traineeId!: string;

  @Column({ type: 'varchar', length: 60 })
  slug!: string;

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

  @Column({ type: 'varchar', length: 60, default: '' })
  name!: string;

  @Column({ type: 'smallint', default: 1 })
  level!: SkillLevel;

  @Column({ name: 'evidence_item_id', type: 'uuid', nullable: true })
  evidenceItemId!: string | null;

  @Column({ name: 'has_pending', type: 'boolean', default: false })
  hasPending!: boolean;

  @Column({ name: 'pending_name', type: 'varchar', length: 60, nullable: true })
  pendingName!: string | null;

  @Column({ name: 'pending_level', type: 'smallint', nullable: true })
  pendingLevel!: SkillLevel | null;

  @Column({ name: 'pending_evidence_item_id', type: 'uuid', nullable: true })
  pendingEvidenceItemId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
