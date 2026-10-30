import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Employer messages and CV requests.
 * The trainee's email is not a column on either table.
 * `down` drops only these tables and their audit rows. It does not delete trainees.
 */
export class EmployerReach1794614400000 implements MigrationInterface {
  name = 'EmployerReach1794614400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "contact_requests" (
        "id" uuid PRIMARY KEY,
        "trainee_id" varchar(64) NOT NULL,
        "from_name" varchar(120) NOT NULL,
        "from_org" varchar(160) NOT NULL DEFAULT '',
        "from_email" varchar(320) NOT NULL,
        "message" varchar(2000) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'new',
        "forwarded_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "ip_hash" varchar(64) NOT NULL DEFAULT '',
        CONSTRAINT "contact_requests_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainees" ("id") ON DELETE CASCADE,
        CONSTRAINT "contact_requests_status_check" CHECK ("status" IN ('new', 'forwarded', 'blocked', 'failed'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "contact_requests_trainee_created_idx" ON "contact_requests" ("trainee_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "contact_requests_email_created_idx" ON "contact_requests" ("from_email", "created_at")`,
    );
    await queryRunner.query(`
      CREATE TABLE "cv_requests" (
        "id" uuid PRIMARY KEY,
        "trainee_id" varchar(64) NOT NULL,
        "document_id" uuid NOT NULL,
        "from_name" varchar(120) NOT NULL,
        "from_org" varchar(160) NOT NULL DEFAULT '',
        "from_email" varchar(320) NOT NULL,
        "message" varchar(2000) NOT NULL DEFAULT '',
        "status" varchar(16) NOT NULL DEFAULT 'new',
        "sent_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "ip_hash" varchar(64) NOT NULL DEFAULT '',
        CONSTRAINT "cv_requests_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainees" ("id") ON DELETE CASCADE,
        CONSTRAINT "cv_requests_status_check" CHECK ("status" IN ('new', 'sent', 'blocked', 'failed'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "cv_requests_trainee_created_idx" ON "cv_requests" ("trainee_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "cv_requests_email_created_idx" ON "cv_requests" ("from_email", "created_at")`,
    );
    await queryRunner.query(`ALTER TABLE "contact_requests" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "cv_requests" ENABLE ROW LEVEL SECURITY`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "audit_events" WHERE "action" IN (
        'contact.created',
        'contact.blocked',
        'cv.request.created',
        'cv.request.sent'
      )
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "cv_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "contact_requests"`);
  }
}
