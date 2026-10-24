import type { MigrationInterface, QueryRunner } from 'typeorm';
import { AUDIT_ACTIONS } from '../../modules/auth/audit-event.entity.js';

const WORKFLOW = `'draft', 'in_review', 'scheduled', 'published'`;

/** Actions allowed before this migration. Down() restores this list. */
const AUDIT_BEFORE_CONTENT = [
  'auth.login.succeeded',
  'auth.login.failed',
  'auth.logout',
  ...['track', 'module', 'phase', 'lesson', 'trainee', 'project', 'event', 'media'].flatMap(
    (kind) =>
      ['created', 'updated', 'published', 'unpublished', 'deleted'].map(
        (verb) => `curriculum.${kind}.${verb}`,
      ),
  ),
];

/**
 * Homepage, about, the timeline, and settings. Each row keeps a working copy
 * and a published copy. Foundation counters live on the settings row.
 */
export class Content1793318400000 implements MigrationInterface {
  name = 'Content1793318400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "content_singletons" (
        "id" varchar(32) PRIMARY KEY,
        "draft" jsonb NOT NULL,
        "published_document" jsonb,
        "publication_status" varchar(32) NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "content_singletons_id_check" CHECK (
          "id" IN ('homepage', 'about', 'milestones', 'settings')
        ),
        CONSTRAINT "content_singletons_publication_status_check" CHECK (
          "publication_status" IN (${WORKFLOW})
        )
      )
    `);

    const allowed = AUDIT_ACTIONS.map((action) => `'${action}'`).join(', ');
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_action_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("action" IN (${allowed}))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_action_check"`,
    );
    await queryRunner.query(`
      DELETE FROM "audit_events"
      WHERE "action" LIKE 'curriculum.homepage.%'
        OR "action" LIKE 'curriculum.about.%'
        OR "action" LIKE 'curriculum.milestone.%'
        OR "action" LIKE 'curriculum.settings.%'
    `);
    const allowed = AUDIT_BEFORE_CONTENT.map((action) => `'${action}'`).join(', ');
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("action" IN (${allowed}))`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "content_singletons"`);
  }
}
