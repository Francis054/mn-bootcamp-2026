import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Skills and events a trainee records.
 * Live columns are the last approved public version.
 * Pending columns are the draft an administrator has not approved yet.
 * A skill may point at one of the trainee's portfolio items as evidence.
 * `down` drops only these tables and the partial unique index on trainer logins.
 * It does not delete trainees or portfolio items.
 */
export class TraineeProgress1794441600000 implements MigrationInterface {
  name = 'TraineeProgress1794441600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "trainee_skills" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "trainee_id" varchar(64) NOT NULL,
        "slug" varchar(60) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "review_status" varchar(16) NOT NULL DEFAULT 'draft',
        "rejection_reason" varchar(500) NOT NULL DEFAULT '',
        "submitted_at" timestamptz,
        "reviewed_at" timestamptz,
        "reviewed_by" uuid,
        "name" varchar(60) NOT NULL DEFAULT '',
        "level" smallint NOT NULL DEFAULT 1,
        "evidence_item_id" uuid,
        "has_pending" boolean NOT NULL DEFAULT false,
        "pending_name" varchar(60),
        "pending_level" smallint,
        "pending_evidence_item_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "trainee_skills_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainees" ("id") ON DELETE CASCADE,
        CONSTRAINT "trainee_skills_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "trainee_skills_evidence_item_id_fkey" FOREIGN KEY ("evidence_item_id") REFERENCES "portfolio_items" ("id") ON DELETE SET NULL,
        CONSTRAINT "trainee_skills_pending_evidence_item_id_fkey" FOREIGN KEY ("pending_evidence_item_id") REFERENCES "portfolio_items" ("id") ON DELETE SET NULL,
        CONSTRAINT "trainee_skills_slug_unique" UNIQUE ("trainee_id", "slug"),
        CONSTRAINT "trainee_skills_review_status_check" CHECK ("review_status" IN ('draft', 'pending', 'approved', 'rejected')),
        CONSTRAINT "trainee_skills_level_check" CHECK ("level" BETWEEN 1 AND 4),
        CONSTRAINT "trainee_skills_pending_level_check" CHECK ("pending_level" IS NULL OR "pending_level" BETWEEN 1 AND 4)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "trainee_skills_trainee_idx" ON "trainee_skills" ("trainee_id", "sort_order")`,
    );
    await queryRunner.query(
      `CREATE INDEX "trainee_skills_review_status_idx" ON "trainee_skills" ("review_status")`,
    );
    await queryRunner.query(`
      CREATE TABLE "trainee_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "trainee_id" varchar(64) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "review_status" varchar(16) NOT NULL DEFAULT 'draft',
        "rejection_reason" varchar(500) NOT NULL DEFAULT '',
        "submitted_at" timestamptz,
        "reviewed_at" timestamptz,
        "reviewed_by" uuid,
        "title" varchar(200) NOT NULL DEFAULT '',
        "event_date" varchar(10),
        "organiser" varchar(160) NOT NULL DEFAULT '',
        "link" varchar(500),
        "certificate_url" varchar(1000),
        "certificate_storage_key" varchar(300),
        "has_pending" boolean NOT NULL DEFAULT false,
        "pending_title" varchar(200),
        "pending_event_date" varchar(10),
        "pending_organiser" varchar(160),
        "pending_link" varchar(500),
        "pending_certificate_url" varchar(1000),
        "pending_certificate_storage_key" varchar(300),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "trainee_events_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainees" ("id") ON DELETE CASCADE,
        CONSTRAINT "trainee_events_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "trainee_events_review_status_check" CHECK ("review_status" IN ('draft', 'pending', 'approved', 'rejected')),
        CONSTRAINT "trainee_events_event_date_check" CHECK ("event_date" IS NULL OR "event_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
        CONSTRAINT "trainee_events_pending_event_date_check" CHECK ("pending_event_date" IS NULL OR "pending_event_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "trainee_events_trainee_idx" ON "trainee_events" ("trainee_id", "sort_order")`,
    );
    await queryRunner.query(
      `CREATE INDEX "trainee_events_review_status_idx" ON "trainee_events" ("review_status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "trainers_user_id_uq" ON "trainers" ("user_id") WHERE "user_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "trainers_user_id_uq"`);
    await queryRunner.query(`
      DELETE FROM "audit_events" WHERE "action" IN (
        'portal.skill.approved',
        'portal.skill.rejected',
        'portal.skill.admin_updated',
        'portal.skill.deleted',
        'portal.event.approved',
        'portal.event.rejected',
        'portal.event.admin_updated',
        'portal.event.deleted'
      )
    `);
    await queryRunner.query(`DROP TABLE "trainee_events"`);
    await queryRunner.query(`DROP TABLE "trainee_skills"`);
  }
}
