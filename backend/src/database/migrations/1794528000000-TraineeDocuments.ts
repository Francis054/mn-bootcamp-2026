import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One current CV per trainee, kept in private storage.
 * Replacing a CV deletes the previous file. There is no timed history.
 * `current_cv_id` is maintained by the API and is not a foreign key:
 * a key back to this table would cycle with the trainee delete cascade.
 * `down` drops only this table, the pointer, and the CV consent rows.
 * It does not delete trainees.
 */
export class TraineeDocuments1794528000000 implements MigrationInterface {
  name = 'TraineeDocuments1794528000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "trainee_documents" (
        "id" uuid PRIMARY KEY,
        "trainee_id" varchar(64) NOT NULL,
        "kind" varchar(16) NOT NULL DEFAULT 'cv',
        "file_name" varchar(200) NOT NULL,
        "mime" varchar(100) NOT NULL,
        "size_bytes" integer NOT NULL,
        "sha256" varchar(64) NOT NULL,
        "storage_provider" varchar(16) NOT NULL,
        "storage_key" varchar(300) NOT NULL,
        "visibility" varchar(16) NOT NULL DEFAULT 'on_request',
        "review_status" varchar(16) NOT NULL DEFAULT 'pending',
        "rejection_reason" varchar(500) NOT NULL DEFAULT '',
        "submitted_at" timestamptz,
        "reviewed_at" timestamptz,
        "reviewed_by" uuid,
        "uploaded_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "trainee_documents_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainees" ("id") ON DELETE CASCADE,
        CONSTRAINT "trainee_documents_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "trainee_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "trainee_documents_kind_check" CHECK ("kind" IN ('cv')),
        CONSTRAINT "trainee_documents_visibility_check" CHECK ("visibility" IN ('private', 'on_request', 'public')),
        CONSTRAINT "trainee_documents_review_status_check" CHECK ("review_status" IN ('pending', 'approved', 'rejected')),
        CONSTRAINT "trainee_documents_sha256_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
        CONSTRAINT "trainee_documents_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 5242880)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "trainee_documents_one_cv" ON "trainee_documents" ("trainee_id") WHERE "kind" = 'cv'`,
    );
    await queryRunner.query(
      `CREATE INDEX "trainee_documents_review_status_idx" ON "trainee_documents" ("review_status")`,
    );
    await queryRunner.query(`ALTER TABLE "trainees" ADD COLUMN "current_cv_id" uuid`);
    await queryRunner.query(
      `CREATE INDEX "trainees_current_cv_id_idx" ON "trainees" ("current_cv_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "trainee_consents" DROP CONSTRAINT "trainee_consents_scope_check"`,
    );
    await queryRunner.query(`
      ALTER TABLE "trainee_consents" ADD CONSTRAINT "trainee_consents_scope_check"
      CHECK ("scope" IN ('public_profile', 'public_photo', 'contact_relay', 'cv_public', 'cv_on_request'))
    `);
    await queryRunner.query(`ALTER TABLE "trainee_documents" ENABLE ROW LEVEL SECURITY`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "trainee_consents" WHERE "scope" IN ('cv_public', 'cv_on_request')`,
    );
    await queryRunner.query(
      `ALTER TABLE "trainee_consents" DROP CONSTRAINT "trainee_consents_scope_check"`,
    );
    await queryRunner.query(`
      ALTER TABLE "trainee_consents" ADD CONSTRAINT "trainee_consents_scope_check"
      CHECK ("scope" IN ('public_profile', 'public_photo', 'contact_relay'))
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "trainees_current_cv_id_idx"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "current_cv_id"`);
    await queryRunner.query(`
      DELETE FROM "audit_events" WHERE "action" IN (
        'portal.cv.uploaded',
        'portal.cv.replaced',
        'portal.cv.removed',
        'portal.cv.approved',
        'portal.cv.rejected',
        'portal.cv.visibility'
      )
    `);
    await queryRunner.query(`DROP TABLE "trainee_documents"`);
  }
}
