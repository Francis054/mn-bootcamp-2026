import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { MilestoneVisibility } from './journey-rules.js';

@Entity({ name: 'trainee_milestones' })
export class TraineeMilestoneEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trainee_id', type: 'varchar', length: 64 })
  traineeId!: string;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'varchar', length: 2000, default: '' })
  summary!: string;

  @Column({ name: 'occurred_on', type: 'varchar', length: 10 })
  occurredOn!: string;

  @Column({ type: 'varchar', length: 16, default: 'private' })
  visibility!: MilestoneVisibility;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
