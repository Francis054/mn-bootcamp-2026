import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Queued mail and the ledger for a trainee removal.
 * `email_outbox` keeps the address and the message so a retry can send it.
 * It does not keep the API key. A trainee delete cascades these rows.
 * `trainee_removals` has no foreign key, so a failed file delete can be
 * retried after the trainee row is gone. `down` drops only these tables
 * and their audit rows. It does not delete trainees.
 */
export class EmailOutboxAndRemoval1794787200000 implements MigrationInterface {
  name = 'EmailOutboxAndRemoval1794787200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "email_outbox" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "trainee_id" varchar(64),
        "kind" varchar(40) NOT NULL,
        "to_address" varchar(320) NOT NULL,
        "reply_to" varchar(320),
        "subject" varchar(200) NOT NULL,
        "text_body" text NOT NULL,
        "html_body" text NOT NULL,
        "status" varchar(16) NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "max_attempts" integer NOT NULL DEFAULT 5,
        "last_error" varchar(300),
        "next_attempt_at" timestamptz,
        "sent_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "email_outbox_trainee_id_fkey"
          FOREIGN KEY ("trainee_id") REFERENCES "trainees" ("id") ON DELETE CASCADE,
        CONSTRAINT "email_outbox_status_check"
          CHECK ("status" IN ('queued', 'sending', 'sent', 'failed')),
        CONSTRAINT "email_outbox_attempts_check"
          CHECK ("attempts" >= 0 AND "max_attempts" BETWEEN 1 AND 10)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "email_outbox_due_idx" ON "email_outbox" ("status", "next_attempt_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "email_outbox_trainee_idx" ON "email_outbox" ("trainee_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE "trainee_removals" (
        "id" uuid PRIMARY KEY,
        "trainee_id" varchar(64) NOT NULL,
        "display_name" varchar(120) NOT NULL DEFAULT '',
        "database_status" varchar(16) NOT NULL,
        "database_error" varchar(300),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "finished_at" timestamptz,
        CONSTRAINT "trainee_removals_database_status_check"
          CHECK ("database_status" IN ('pending', 'deleted', 'failed'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "trainee_removals_trainee_idx" ON "trainee_removals" ("trainee_id", "created_at")`,
    );
    await queryRunner.query(`
      CREATE TABLE "trainee_removal_items" (
        "id" uuid PRIMARY KEY,
        "removal_id" uuid NOT NULL,
        "kind" varchar(32) NOT NULL,
        "label" varchar(120) NOT NULL,
        "storage_key" varchar(500) NOT NULL,
        "status" varchar(16) NOT NULL,
        "error" varchar(300),
        "attempts" integer NOT NULL DEFAULT 0,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "trainee_removal_items_removal_id_fkey"
          FOREIGN KEY ("removal_id") REFERENCES "trainee_removals" ("id") ON DELETE CASCADE,
        CONSTRAINT "trainee_removal_items_kind_check"
          CHECK ("kind" IN (
            'profile_photo', 'portfolio_image', 'portfolio_video', 'work_photo', 'certificate', 'cv'
          )),
        CONSTRAINT "trainee_removal_items_status_check"
          CHECK ("status" IN ('pending', 'deleted', 'failed')),
        CONSTRAINT "trainee_removal_items_attempts_check" CHECK ("attempts" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "trainee_removal_items_removal_idx" ON "trainee_removal_items" ("removal_id")`,
    );
    await queryRunner.query(`ALTER TABLE "email_outbox" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "trainee_removals" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "trainee_removal_items" ENABLE ROW LEVEL SECURITY`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "audit_events" WHERE "action" IN (
        'mail.outbox.resent',
        'trainee.data.exported',
        'trainee.data.removed',
        'trainee.removal.retried'
      )
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "trainee_removal_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trainee_removals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_outbox"`);
  }
}
