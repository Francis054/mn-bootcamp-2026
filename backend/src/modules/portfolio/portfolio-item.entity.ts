import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { PortfolioKind } from './portfolio-rules.js';
import type { ReviewStatus } from '../trainees/profile-review.js';

@Entity({ name: 'portfolio_items' })
export class PortfolioItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trainee_id', type: 'varchar', length: 64 })
  traineeId!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: PortfolioKind;

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

  @Column({ type: 'varchar', length: 160, default: '' })
  title!: string;

  @Column({ type: 'text', default: '' })
  summary!: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  skills!: string[];

  @Column({ name: 'started_on', type: 'varchar', length: 10, nullable: true })
  startedOn!: string | null;

  @Column({ name: 'completed_on', type: 'varchar', length: 10, nullable: true })
  completedOn!: string | null;

  @Column({ name: 'repository_url', type: 'varchar', length: 500, nullable: true })
  repositoryUrl!: string | null;

  @Column({ name: 'demo_url', type: 'varchar', length: 500, nullable: true })
  demoUrl!: string | null;

  @Column({ name: 'has_pending', type: 'boolean', default: false })
  hasPending!: boolean;

  @Column({ name: 'pending_kind', type: 'varchar', length: 16, nullable: true })
  pendingKind!: PortfolioKind | null;

  @Column({ name: 'pending_title', type: 'varchar', length: 160, nullable: true })
  pendingTitle!: string | null;

  @Column({ name: 'pending_summary', type: 'text', nullable: true })
  pendingSummary!: string | null;

  @Column({ name: 'pending_skills', type: 'text', array: true, nullable: true })
  pendingSkills!: string[] | null;

  @Column({ name: 'pending_started_on', type: 'varchar', length: 10, nullable: true })
  pendingStartedOn!: string | null;

  @Column({ name: 'pending_completed_on', type: 'varchar', length: 10, nullable: true })
  pendingCompletedOn!: string | null;

  @Column({ name: 'pending_repository_url', type: 'varchar', length: 500, nullable: true })
  pendingRepositoryUrl!: string | null;

  @Column({ name: 'pending_demo_url', type: 'varchar', length: 500, nullable: true })
  pendingDemoUrl!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
