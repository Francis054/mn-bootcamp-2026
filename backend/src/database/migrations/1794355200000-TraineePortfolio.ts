import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trainee portfolio items: projects, labs, and case studies.
 * Live columns are the last approved public version.
 * Pending columns are the draft an administrator has not approved yet.
 * `down` drops only these tables. It does not delete trainees.
 */
export class TraineePortfolio1794355200000 implements MigrationInterface {
  name = 'TraineePortfolio1794355200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "portfolio_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "trainee_id" varchar(64) NOT NULL,
        "kind" varchar(16) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "review_status" varchar(16) NOT NULL DEFAULT 'draft',
        "rejection_reason" varchar(500) NOT NULL DEFAULT '',
        "submitted_at" timestamptz,
        "reviewed_at" timestamptz,
        "reviewed_by" uuid,
        "title" varchar(160) NOT NULL DEFAULT '',
        "summary" text NOT NULL DEFAULT '',
        "skills" text[] NOT NULL DEFAULT '{}',
        "started_on" varchar(10),
        "completed_on" varchar(10),
        "repository_url" varchar(500),
        "demo_url" varchar(500),
        "has_pending" boolean NOT NULL DEFAULT false,
        "pending_kind" varchar(16),
        "pending_title" varchar(160),
        "pending_summary" text,
        "pending_skills" text[],
        "pending_started_on" varchar(10),
        "pending_completed_on" varchar(10),
        "pending_repository_url" varchar(500),
        "pending_demo_url" varchar(500),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "portfolio_items_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainees" ("id") ON DELETE CASCADE,
        CONSTRAINT "portfolio_items_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "portfolio_items_kind_check" CHECK ("kind" IN ('project', 'lab', 'case_study')),
        CONSTRAINT "portfolio_items_pending_kind_check" CHECK ("pending_kind" IS NULL OR "pending_kind" IN ('project', 'lab', 'case_study')),
        CONSTRAINT "portfolio_items_review_status_check" CHECK ("review_status" IN ('draft', 'pending', 'approved', 'rejected'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "portfolio_items_trainee_idx" ON "portfolio_items" ("trainee_id", "sort_order")`,
    );
    await queryRunner.query(
      `CREATE INDEX "portfolio_items_review_status_idx" ON "portfolio_items" ("review_status")`,
    );
    await queryRunner.query(`
      CREATE TABLE "portfolio_media" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "item_id" uuid NOT NULL,
        "trainee_id" varchar(64) NOT NULL,
        "slot" varchar(8) NOT NULL,
        "kind" varchar(16) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "alt" varchar(200) NOT NULL DEFAULT '',
        "storage_key" varchar(300),
        "public_url" varchar(1000),
        "mime" varchar(100),
        "byte_size" integer,
        "provider" varchar(16),
        "external_id" varchar(64),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "portfolio_media_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "portfolio_items" ("id") ON DELETE CASCADE,
        CONSTRAINT "portfolio_media_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainees" ("id") ON DELETE CASCADE,
        CONSTRAINT "portfolio_media_slot_check" CHECK ("slot" IN ('live', 'pending')),
        CONSTRAINT "portfolio_media_kind_check" CHECK ("kind" IN ('image', 'video_file', 'video_link')),
        CONSTRAINT "portfolio_media_provider_check" CHECK ("provider" IS NULL OR "provider" IN ('upload', 'youtube', 'vimeo', 'loom'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "portfolio_media_item_idx" ON "portfolio_media" ("item_id", "slot", "sort_order")`,
    );
    await queryRunner.query(`
      CREATE TABLE "portfolio_video_grants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "item_id" uuid NOT NULL,
        "trainee_id" varchar(64) NOT NULL,
        "public_id" varchar(200) NOT NULL,
        "mime" varchar(100) NOT NULL,
        "max_bytes" integer NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "consumed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "portfolio_video_grants_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "portfolio_items" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "portfolio_video_grants_item_idx" ON "portfolio_video_grants" ("item_id")`,
    );
    await queryRunner.query(`ALTER TABLE "portfolio_items" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "portfolio_media" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "portfolio_video_grants" ENABLE ROW LEVEL SECURITY`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "audit_events" WHERE "action" IN (
        'portal.portfolio.approved',
        'portal.portfolio.rejected',
        'portal.portfolio.admin_updated',
        'portal.portfolio.deleted'
      )
    `);
    await queryRunner.query(`DROP TABLE "portfolio_video_grants"`);
    await queryRunner.query(`DROP TABLE "portfolio_media"`);
    await queryRunner.query(`DROP TABLE "portfolio_items"`);
  }
}
