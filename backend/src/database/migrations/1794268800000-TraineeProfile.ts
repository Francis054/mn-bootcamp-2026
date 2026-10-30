import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trainee profile drafts, per-item consent, and the review queue.
 * Live columns stay the last approved public version.
 * Pending columns hold the version an administrator has not approved yet.
 * `down` drops only these additions. It does not delete trainees.
 */
export class TraineeProfile1794268800000 implements MigrationInterface {
  name = 'TraineeProfile1794268800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "trainees" ADD COLUMN "headline" varchar(160) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "trainees" ADD COLUMN "location" varchar(120) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "trainees" ADD COLUMN "github_url" varchar(500)`);
    await queryRunner.query(
      `ALTER TABLE "trainees" ADD COLUMN "photo_consent" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "trainees" ADD COLUMN "contact_consent" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "trainees" ADD COLUMN "public_links" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "trainees" ADD COLUMN "profile_review_status" varchar(16) NOT NULL DEFAULT 'draft'`,
    );
    await queryRunner.query(
      `ALTER TABLE "trainees" ADD CONSTRAINT "trainees_profile_review_status_check" CHECK ("profile_review_status" IN ('draft', 'pending', 'approved', 'rejected'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "trainees" ADD COLUMN "profile_rejection_reason" varchar(500) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(`ALTER TABLE "trainees" ADD COLUMN "profile_submitted_at" timestamptz`);
    await queryRunner.query(`ALTER TABLE "trainees" ADD COLUMN "profile_reviewed_at" timestamptz`);
    await queryRunner.query(`ALTER TABLE "trainees" ADD COLUMN "profile_reviewed_by" uuid`);
    await queryRunner.query(
      `ALTER TABLE "trainees" ADD CONSTRAINT "trainees_profile_reviewed_by_fkey" FOREIGN KEY ("profile_reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(`ALTER TABLE "trainees" ADD COLUMN "pending_display_name" varchar(120)`);
    await queryRunner.query(`ALTER TABLE "trainees" ADD COLUMN "pending_headline" varchar(160)`);
    await queryRunner.query(`ALTER TABLE "trainees" ADD COLUMN "pending_bio" text`);
    await queryRunner.query(`ALTER TABLE "trainees" ADD COLUMN "pending_location" varchar(120)`);
    await queryRunner.query(`ALTER TABLE "trainees" ADD COLUMN "pending_linkedin" varchar(500)`);
    await queryRunner.query(`ALTER TABLE "trainees" ADD COLUMN "pending_github_url" varchar(500)`);
    await queryRunner.query(`ALTER TABLE "trainees" ADD COLUMN "pending_portfolio" varchar(500)`);
    await queryRunner.query(`ALTER TABLE "trainees" ADD COLUMN "pending_photo_url" varchar(1000)`);
    await queryRunner.query(`ALTER TABLE "trainees" ADD COLUMN "pending_photo_storage_key" varchar(200)`);
    await queryRunner.query(
      `UPDATE "trainees" SET "profile_review_status" = 'approved' WHERE "publication_status" = 'published'`,
    );
    await queryRunner.query(
      `UPDATE "trainees" SET "photo_consent" = true WHERE "photo_url" IS NOT NULL AND "consent_received" = true`,
    );
    await queryRunner.query(
      `CREATE INDEX "trainees_profile_review_status_idx" ON "trainees" ("profile_review_status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "trainee_consents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "trainee_id" varchar(64) NOT NULL,
        "scope" varchar(24) NOT NULL,
        "granted" boolean NOT NULL,
        "source" varchar(12) NOT NULL,
        "policy_version" varchar(32) NOT NULL,
        "wording" text NOT NULL,
        "recorded_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "trainee_consents_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainees" ("id") ON DELETE CASCADE,
        CONSTRAINT "trainee_consents_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "trainee_consents_scope_check" CHECK ("scope" IN ('public_profile', 'public_photo', 'contact_relay')),
        CONSTRAINT "trainee_consents_source_check" CHECK ("source" IN ('self', 'admin'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "trainee_consents_trainee_idx" ON "trainee_consents" ("trainee_id", "created_at" DESC)`,
    );
    await queryRunner.query(`
      INSERT INTO "trainee_consents" ("trainee_id", "scope", "granted", "source", "policy_version", "wording", "recorded_by", "created_at")
      SELECT "id", 'public_profile', true, 'admin', 'legacy-admin-consent',
        'Recorded by an administrator before per-item consent.',
        "consent_recorded_by", COALESCE("consent_received_at", now())
      FROM "trainees" WHERE "consent_received" = true
    `);
    await queryRunner.query(`
      INSERT INTO "trainee_consents" ("trainee_id", "scope", "granted", "source", "policy_version", "wording", "recorded_by", "created_at")
      SELECT "id", 'public_photo', true, 'admin', 'legacy-admin-consent',
        'Recorded by an administrator before per-item consent.',
        "consent_recorded_by", COALESCE("consent_received_at", now())
      FROM "trainees" WHERE "photo_consent" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "audit_events" WHERE "action" IN (
        'portal.profile.approved',
        'portal.profile.rejected',
        'portal.profile.admin_updated',
        'portal.photo.changed',
        'portal.consent.changed'
      )
    `);
    await queryRunner.query(`DROP TABLE "trainee_consents"`);
    await queryRunner.query(`DROP INDEX "trainees_profile_review_status_idx"`);
    await queryRunner.query(
      `ALTER TABLE "trainees" DROP CONSTRAINT "trainees_profile_reviewed_by_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trainees" DROP CONSTRAINT "trainees_profile_review_status_check"`,
    );
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "pending_photo_storage_key"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "pending_photo_url"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "pending_portfolio"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "pending_github_url"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "pending_linkedin"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "pending_location"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "pending_bio"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "pending_headline"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "pending_display_name"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "profile_reviewed_by"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "profile_reviewed_at"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "profile_submitted_at"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "profile_rejection_reason"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "profile_review_status"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "public_links"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "contact_consent"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "photo_consent"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "github_url"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "location"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "headline"`);
  }
}
