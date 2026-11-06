import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trainees an administrator already approved can sign in without a confirmation email.
 * Sets `email_verified_at` only where it is still empty, and only for trainee logins
 * that are linked to a roster row or whose signup request is approved.
 * Administrator, editor, trainer, and viewer rows are left alone.
 * Running it again changes nothing. `down` does not clear the timestamp:
 * that would lock those trainees out, and this migration does not record which rows it set.
 */
export class ApproveWaitingTrainees1794873600000 implements MigrationInterface {
  name = 'ApproveWaitingTrainees1794873600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "users" AS account
      SET "email_verified_at" = now()
      WHERE account."role" = 'trainee'
        AND account."email_verified_at" IS NULL
        AND (
          account."trainee_id" IS NOT NULL
          OR EXISTS (
            SELECT 1
            FROM "pending_registrations" AS request
            WHERE lower(request."email") = lower(account."email")
              AND request."status" = 'approved'
          )
        )
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Data backfill. Reversing it would block trainees who can already sign in.
  }
}
