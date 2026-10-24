import type { MigrationInterface, QueryRunner } from 'typeorm';
import { AUDIT_ACTIONS } from '../../modules/auth/audit-event.entity.js';
import { EVENT_KINDS } from '../../modules/events/event-types.js';

const WORKFLOW = `'draft', 'in_review', 'scheduled', 'published'`;
const LISTING = `'hidden', 'sample', 'public'`;
const KINDS = EVENT_KINDS.map((kind) => `'${kind}'`).join(', ');

/** Actions allowed before this migration. Down() restores this list. */
const AUDIT_BEFORE_EVENTS = [
  'auth.login.succeeded',
  'auth.login.failed',
  'auth.logout',
  ...['track', 'module', 'phase', 'lesson', 'trainee', 'project'].flatMap((kind) =>
    ['created', 'updated', 'published', 'unpublished', 'deleted'].map(
      (verb) => `curriculum.${kind}.${verb}`,
    ),
  ),
];

/**
 * Events. A scheduled row stays off the public routes until its Accra start.
 * Ghana does not use daylight saving, so that clock is UTC.
 */
export class Events1793145600000 implements MigrationInterface {
  name = 'Events1793145600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "events" (
        "id" varchar(64) PRIMARY KEY,
        "title" varchar(200) NOT NULL,
        "date" varchar(10) NOT NULL DEFAULT '',
        "date_tbc" boolean NOT NULL DEFAULT false,
        "when_label" varchar(200) NOT NULL DEFAULT '',
        "place" varchar(200) NOT NULL,
        "kind" varchar(40) NOT NULL,
        "verified" boolean NOT NULL DEFAULT false,
        "sample" boolean NOT NULL DEFAULT false,
        "summary" text NOT NULL,
        "body" jsonb NOT NULL,
        "source" varchar(500) NOT NULL DEFAULT '',
        "source_url" varchar(500) NOT NULL DEFAULT '',
        "image" varchar(200) NOT NULL DEFAULT 'guests-seated',
        "show_on_anniversary" boolean NOT NULL DEFAULT false,
        "calendar_download" boolean NOT NULL DEFAULT false,
        "start_time" varchar(5) NOT NULL DEFAULT '',
        "end_time" varchar(5) NOT NULL DEFAULT '',
        "publication_status" varchar(32) NOT NULL,
        "listing" varchar(16) NOT NULL,
        "internal_notes" text NOT NULL DEFAULT '',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "events_kind_check" CHECK ("kind" IN (${KINDS})),
        CONSTRAINT "events_publication_status_check" CHECK ("publication_status" IN (${WORKFLOW})),
        CONSTRAINT "events_listing_check" CHECK ("listing" IN (${LISTING}))
      )
    `);
    await queryRunner.query(`CREATE INDEX "events_date_idx" ON "events" ("date")`);
    await queryRunner.query(
      `CREATE INDEX "events_publication_status_idx" ON "events" ("publication_status")`,
    );

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
      DELETE FROM "audit_events" WHERE "action" LIKE 'curriculum.event.%'
    `);
    const allowed = AUDIT_BEFORE_EVENTS.map((action) => `'${action}'`).join(', ');
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("action" IN (${allowed}))`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "events"`);
  }
}
