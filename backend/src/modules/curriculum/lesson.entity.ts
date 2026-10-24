import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { Listing, PublicationStatus } from './publication.js';

@Entity({ name: 'lessons' })
export class LessonEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'smallint' })
  week!: number;

  @Column({ name: 'module_id', type: 'varchar', length: 40 })
  moduleId!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 200 })
  slug!: string;

  @Column({ name: 'class_date', type: 'varchar', length: 10 })
  classDate!: string;

  @Column({ type: 'varchar', length: 80 })
  format!: string;

  @Column({ type: 'smallint' })
  phase!: number;

  @Column({ name: 'publication_status', type: 'varchar', length: 32 })
  publicationStatus!: PublicationStatus;

  @Column({ type: 'varchar', length: 16 })
  listing!: Listing;

  @Column({ type: 'varchar', length: 200 })
  room!: string;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ type: 'text', array: true })
  objectives!: string[];

  @Column({ type: 'text' })
  lab!: string;

  @Column({ name: 'code_sample', type: 'text' })
  codeSample!: string;

  @Column({ type: 'varchar', length: 200 })
  cover!: string;

  @Column({ name: 'internal_notes', type: 'text' })
  internalNotes!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
