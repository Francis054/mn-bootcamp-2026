import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { Listing, PublicationStatus } from '../curriculum/publication.js';
import type { EventBody } from './event-types.js';

@Entity({ name: 'events' })
export class EventEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  /** Calendar day `YYYY-MM-DD`, or blank while `dateTbc` is set. */
  @Column({ type: 'varchar', length: 10 })
  date!: string;

  @Column({ name: 'date_tbc', type: 'boolean', default: false })
  dateTbc!: boolean;

  @Column({ name: 'when_label', type: 'varchar', length: 200, default: '' })
  whenLabel!: string;

  @Column({ type: 'varchar', length: 200 })
  place!: string;

  @Column({ type: 'varchar', length: 40 })
  kind!: string;

  @Column({ type: 'boolean', default: false })
  verified!: boolean;

  @Column({ type: 'boolean', default: false })
  sample!: boolean;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ type: 'jsonb' })
  body!: EventBody;

  @Column({ type: 'varchar', length: 500, default: '' })
  source!: string;

  @Column({ name: 'source_url', type: 'varchar', length: 500, default: '' })
  sourceUrl!: string;

  @Column({ type: 'varchar', length: 200, default: 'guests-seated' })
  image!: string;

  @Column({ name: 'show_on_anniversary', type: 'boolean', default: false })
  showOnAnniversary!: boolean;

  @Column({ name: 'calendar_download', type: 'boolean', default: false })
  calendarDownload!: boolean;

  /** `HH:MM` in Africa/Accra, which is UTC. Blank when the clock is not set. */
  @Column({ name: 'start_time', type: 'varchar', length: 5, default: '' })
  startTime!: string;

  @Column({ name: 'end_time', type: 'varchar', length: 5, default: '' })
  endTime!: string;

  @Column({ name: 'publication_status', type: 'varchar', length: 32 })
  publicationStatus!: PublicationStatus;

  @Column({ type: 'varchar', length: 16 })
  listing!: Listing;

  @Column({ name: 'internal_notes', type: 'text', default: '' })
  internalNotes!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
