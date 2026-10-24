import type { MigrationInterface, QueryRunner } from 'typeorm';
import { AUDIT_ACTIONS } from '../../modules/auth/audit-event.entity.js';

const WORKFLOW = `'draft', 'in_review', 'scheduled', 'published'`;
const LISTING = `'hidden', 'sample', 'public'`;

/**
 * Tracks, modules, phases, and lessons. Public reads still require a published
 * row that is not hidden. The audit table gains a subject id and the new actions.
 */
export class Curriculum1792886400000 implements MigrationInterface {
  name = 'Curriculum1792886400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tracks" (
        "id" varchar(40) PRIMARY KEY,
        "name" varchar(80) NOT NULL,
        "summary" text NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "publication_status" varchar(32) NOT NULL,
        "listing" varchar(16) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "tracks_name_unique" UNIQUE ("name"),
        CONSTRAINT "tracks_id_check" CHECK ("id" ~ '^[a-z][a-z0-9-]{0,39}$'),
        CONSTRAINT "tracks_publication_status_check" CHECK ("publication_status" IN (${WORKFLOW})),
        CONSTRAINT "tracks_listing_check" CHECK ("listing" IN (${LISTING})),
        CONSTRAINT "tracks_sort_order_check" CHECK ("sort_order" >= 0 AND "sort_order" <= 999)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "modules" (
        "id" varchar(40) PRIMARY KEY,
        "name" varchar(120) NOT NULL,
        "short" varchar(40) NOT NULL,
        "icon" varchar(40) NOT NULL,
        "summary" text NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "publication_status" varchar(32) NOT NULL,
        "listing" varchar(16) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "modules_name_unique" UNIQUE ("name"),
        CONSTRAINT "modules_id_check" CHECK ("id" ~ '^[a-z][a-z0-9-]{0,39}$'),
        CONSTRAINT "modules_publication_status_check" CHECK ("publication_status" IN (${WORKFLOW})),
        CONSTRAINT "modules_listing_check" CHECK ("listing" IN (${LISTING})),
        CONSTRAINT "modules_sort_order_check" CHECK ("sort_order" >= 0 AND "sort_order" <= 999)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "phases" (
        "id" smallint PRIMARY KEY,
        "name" varchar(80) NOT NULL,
        "months" varchar(80) NOT NULL,
        "summary" text NOT NULL,
        "module_ids" text[] NOT NULL DEFAULT '{}',
        "publication_status" varchar(32) NOT NULL,
        "listing" varchar(16) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "phases_id_check" CHECK ("id" >= 1 AND "id" <= 9),
        CONSTRAINT "phases_publication_status_check" CHECK ("publication_status" IN (${WORKFLOW})),
        CONSTRAINT "phases_listing_check" CHECK ("listing" IN (${LISTING}))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "lessons" (
        "id" varchar(64) PRIMARY KEY,
        "week" smallint NOT NULL,
        "module_id" varchar(40) NOT NULL REFERENCES "modules" ("id") ON DELETE RESTRICT,
        "title" varchar(200) NOT NULL,
        "slug" varchar(200) NOT NULL,
        "class_date" varchar(10) NOT NULL,
        "format" varchar(80) NOT NULL,
        "phase" smallint NOT NULL REFERENCES "phases" ("id") ON DELETE RESTRICT,
        "publication_status" varchar(32) NOT NULL,
        "listing" varchar(16) NOT NULL,
        "room" varchar(200) NOT NULL DEFAULT '',
        "summary" text NOT NULL,
        "objectives" text[] NOT NULL DEFAULT '{}',
        "lab" text NOT NULL DEFAULT '',
        "code_sample" text NOT NULL DEFAULT '',
        "cover" varchar(200) NOT NULL DEFAULT 'electronics-lab',
        "internal_notes" text NOT NULL DEFAULT '',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "lessons_week_check" CHECK ("week" >= 1 AND "week" <= 18),
        CONSTRAINT "lessons_phase_check" CHECK ("phase" >= 1 AND "phase" <= 3),
        CONSTRAINT "lessons_date_check" CHECK ("class_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
        CONSTRAINT "lessons_publication_status_check" CHECK ("publication_status" IN (${WORKFLOW})),
        CONSTRAINT "lessons_listing_check" CHECK ("listing" IN (${LISTING}))
      )
    `);
    await queryRunner.query(`CREATE INDEX "lessons_module_id_idx" ON "lessons" ("module_id")`);
    await queryRunner.query(`CREATE INDEX "lessons_week_idx" ON "lessons" ("week")`);
    await queryRunner.query(
      `CREATE INDEX "lessons_publication_status_idx" ON "lessons" ("publication_status")`,
    );

    const allowed = AUDIT_ACTIONS.map((action) => `'${action}'`).join(', ');
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_action_check"`,
    );
    await queryRunner.query(`ALTER TABLE "audit_events" ADD COLUMN "subject_type" varchar(32)`);
    await queryRunner.query(`ALTER TABLE "audit_events" ADD COLUMN "subject_id" varchar(64)`);
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
      WHERE "action" NOT IN ('auth.login.succeeded', 'auth.login.failed', 'auth.logout')
    `);
    await queryRunner.query(`ALTER TABLE "audit_events" DROP COLUMN "subject_id"`);
    await queryRunner.query(`ALTER TABLE "audit_events" DROP COLUMN "subject_type"`);
    await queryRunner.query(`
      ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK (
        "action" IN ('auth.login.succeeded', 'auth.login.failed', 'auth.logout')
      )
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "lessons"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "phases"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "modules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tracks"`);
  }
}
