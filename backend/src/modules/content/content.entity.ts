import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { PublicationStatus } from '../curriculum/publication.js';

export const CONTENT_IDS = ['homepage', 'about', 'milestones', 'settings'] as const;
export type ContentId = (typeof CONTENT_IDS)[number];

/**
 * One working copy and, after publish, one public copy.
 * An edit changes the working copy. The public routes keep the last publish.
 */
@Entity({ name: 'content_singletons' })
export class ContentSingletonEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id!: ContentId;

  @Column({ type: 'jsonb' })
  draft!: object;

  @Column({ name: 'published_document', type: 'jsonb', nullable: true })
  publishedDocument!: object | null;

  @Column({ name: 'publication_status', type: 'varchar', length: 32 })
  publicationStatus!: PublicationStatus;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
