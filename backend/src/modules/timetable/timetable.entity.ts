import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ParseWarning, SessionType, TrainerRole, TrainerStatus } from './model.js';
import type { TrainerKind } from './names.js';

@Entity({ name: 'programmes' })
export class ProgrammeEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ name: 'starts_on', type: 'varchar', length: 10 })
  startsOn!: string;

  @Column({ name: 'ends_on', type: 'varchar', length: 10 })
  endsOn!: string;

  @Column({ type: 'jsonb' })
  rules!: string[];

  @Column({ name: 'source_note', type: 'text' })
  sourceNote!: string;

  @Column({ name: 'import_warnings', type: 'jsonb' })
  importWarnings!: ParseWarning[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'curriculum_blocks' })
export class BlockEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'programme_id', type: 'varchar', length: 64 })
  programmeId!: string;

  @Column({ name: 'sort_order', type: 'integer' })
  sortOrder!: number;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ name: 'professionalism_theme', type: 'varchar', length: 200 })
  professionalismTheme!: string;

  @Column({ name: 'cybersecurity_theme', type: 'varchar', length: 200 })
  cybersecurityTheme!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'curriculum_weeks' })
export class WeekEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'programme_id', type: 'varchar', length: 64 })
  programmeId!: string;

  @Column({ name: 'block_id', type: 'varchar', length: 64 })
  blockId!: string;

  @Column({ type: 'smallint' })
  number!: number;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ name: 'starts_on', type: 'varchar', length: 10 })
  startsOn!: string;

  @Column({ type: 'text' })
  professionalism!: string;

  @Column({ type: 'text' })
  cybersecurity!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'week_deliverables' })
export class DeliverableEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'week_id', type: 'varchar', length: 64 })
  weekId!: string;

  @Column({ name: 'sort_order', type: 'integer' })
  sortOrder!: number;

  @Column({ type: 'text' })
  title!: string;
}

@Entity({ name: 'trainers' })
export class TrainerEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 160 })
  displayName!: string;

  @Column({ name: 'normalized_name', type: 'varchar', length: 160 })
  normalizedName!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: TrainerKind;

  @Column({ type: 'boolean' })
  proposed!: boolean;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'week_trainers' })
export class WeekTrainerEntity {
  @PrimaryColumn({ name: 'week_id', type: 'varchar', length: 64 })
  weekId!: string;

  @PrimaryColumn({ name: 'trainer_id', type: 'varchar', length: 64 })
  trainerId!: string;

  @PrimaryColumn({ type: 'varchar', length: 32 })
  role!: TrainerRole;

  @Column({ name: 'sort_order', type: 'integer' })
  sortOrder!: number;
}

@Entity({ name: 'class_sessions' })
export class SessionEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'programme_id', type: 'varchar', length: 64 })
  programmeId!: string;

  @Column({ name: 'week_id', type: 'varchar', length: 64 })
  weekId!: string;

  @Column({ name: 'import_key', type: 'varchar', length: 40, nullable: true })
  importKey!: string | null;

  @Column({ name: 'session_date', type: 'varchar', length: 10 })
  sessionDate!: string;

  @Column({ name: 'day_name', type: 'varchar', length: 16 })
  dayName!: string;

  @Column({ name: 'sort_order', type: 'integer' })
  sortOrder!: number;

  @Column({ name: 'session_type', type: 'varchar', length: 16 })
  sessionType!: SessionType;

  @Column({ type: 'varchar', length: 200 })
  activity!: string;

  @Column({ type: 'text' })
  topic!: string;

  @Column({ type: 'text' })
  notes!: string;

  @Column({ name: 'start_time', type: 'varchar', length: 5, nullable: true })
  startTime!: string | null;

  @Column({ name: 'end_time', type: 'varchar', length: 5, nullable: true })
  endTime!: string | null;

  @Column({ name: 'raw_time', type: 'varchar', length: 80 })
  rawTime!: string;

  @Column({ name: 'trainer_status', type: 'varchar', length: 16 })
  trainerStatus!: TrainerStatus;

  @Column({ type: 'varchar', length: 16 })
  origin!: 'import' | 'admin';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'session_trainers' })
export class SessionTrainerEntity {
  @PrimaryColumn({ name: 'session_id', type: 'varchar', length: 64 })
  sessionId!: string;

  @PrimaryColumn({ name: 'trainer_id', type: 'varchar', length: 64 })
  trainerId!: string;

  @Column({ name: 'sort_order', type: 'integer' })
  sortOrder!: number;
}
