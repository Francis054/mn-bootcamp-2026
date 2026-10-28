import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trainee sign-in. Adds the login link to a roster row, email verification,
 * a suspend flag, and the admin queue for emails that are not on the roster.
 * Existing accounts are marked verified so staff are not locked out.
 * `down` drops only these additions. It does not delete users or trainees.
 */
export class TraineeAuth1794182400000 implements MigrationInterface {
  name = 'TraineeAuth1794182400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamptz`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "disabled_at" timestamptz`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "last_login_at" timestamptz`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "trainee_id" varchar(64)`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "users_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainees" ("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "users_trainee_id_unique" UNIQUE ("trainee_id")`,
    );
    await queryRunner.query(
      `UPDATE "users" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "access_tokens" DROP CONSTRAINT "access_tokens_purpose_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_purpose_check" CHECK ("purpose" IN ('reset', 'invite', 'verify_email', 'email_change'))`,
    );

    await queryRunner.query(`ALTER TABLE "trainees" ADD COLUMN "slug" varchar(80)`);
    await queryRunner.query(
      `ALTER TABLE "trainees" ADD CONSTRAINT "trainees_slug_unique" UNIQUE ("slug")`,
    );
    await queryRunner.query(
      `ALTER TABLE "trainees" ADD COLUMN "cohort_year" smallint NOT NULL DEFAULT 2026`,
    );
    await queryRunner.query(
      `ALTER TABLE "trainees" ADD CONSTRAINT "trainees_cohort_year_check" CHECK ("cohort_year" >= 2000 AND "cohort_year" <= 2100)`,
    );

    await queryRunner.query(`
      CREATE TABLE "pending_registrations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(320) NOT NULL,
        "display_name" varchar(120) NOT NULL DEFAULT '',
        "password_hash" text NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "reviewed_at" timestamptz,
        "reviewed_by" uuid,
        CONSTRAINT "pending_registrations_email_unique" UNIQUE ("email"),
        CONSTRAINT "pending_registrations_email_check" CHECK ("email" = lower("email") AND "email" <> ''),
        CONSTRAINT "pending_registrations_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected')),
        CONSTRAINT "pending_registrations_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "pending_registrations_status_idx" ON "pending_registrations" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "audit_events" WHERE "action" IN (
        'auth.trainee.signup',
        'auth.trainee.verified',
        'auth.trainee.verify.resent',
        'auth.trainee.approved',
        'auth.trainee.rejected',
        'auth.user.disabled',
        'auth.user.enabled'
      )
    `);
    await queryRunner.query(`DROP TABLE "pending_registrations"`);
    await queryRunner.query(
      `ALTER TABLE "trainees" DROP CONSTRAINT "trainees_cohort_year_check"`,
    );
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "cohort_year"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP CONSTRAINT "trainees_slug_unique"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "slug"`);
    await queryRunner.query(`DELETE FROM "access_tokens" WHERE "purpose" NOT IN ('reset', 'invite')`);
    await queryRunner.query(
      `ALTER TABLE "access_tokens" DROP CONSTRAINT "access_tokens_purpose_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_purpose_check" CHECK ("purpose" IN ('reset', 'invite'))`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "users_trainee_id_unique"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "users_trainee_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "trainee_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_login_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "disabled_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verified_at"`);
  }
}
