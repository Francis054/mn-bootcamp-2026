import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trainee portfolio and LinkedIn links are optional, so a blank value is null.
 * Trainee and trainer accounts can upload media. An editor or administrator
 * publishes. The photo records who uploaded it.
 */
export class RolesAndOptionalLinks1793577600000 implements MigrationInterface {
  name = 'RolesAndOptionalLinks1793577600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "trainees" SET "linkedin" = NULL WHERE btrim("linkedin") = ''`);
    await queryRunner.query(
      `UPDATE "trainees" SET "portfolio" = NULL WHERE btrim("portfolio") = ''`,
    );
    await queryRunner.query(`ALTER TABLE "trainees" ALTER COLUMN "linkedin" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "trainees" ALTER COLUMN "linkedin" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "trainees" ALTER COLUMN "portfolio" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "trainees" ALTER COLUMN "portfolio" DROP NOT NULL`);

    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "users_role_check"`);
    await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "users_role_check"
      CHECK ("role" IN ('viewer', 'editor', 'administrator', 'trainer', 'trainee'))
    `);

    await queryRunner.query(`
      ALTER TABLE "media_assets"
      ADD COLUMN "uploaded_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "media_assets" DROP COLUMN "uploaded_by"`);

    await queryRunner.query(`
      UPDATE "users" SET "role" = 'viewer' WHERE "role" IN ('trainer', 'trainee')
    `);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "users_role_check"`);
    await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "users_role_check"
      CHECK ("role" IN ('viewer', 'editor', 'administrator'))
    `);

    await queryRunner.query(`UPDATE "trainees" SET "linkedin" = '' WHERE "linkedin" IS NULL`);
    await queryRunner.query(`UPDATE "trainees" SET "portfolio" = '' WHERE "portfolio" IS NULL`);
    await queryRunner.query(`ALTER TABLE "trainees" ALTER COLUMN "linkedin" SET DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "trainees" ALTER COLUMN "linkedin" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "trainees" ALTER COLUMN "portfolio" SET DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "trainees" ALTER COLUMN "portfolio" SET NOT NULL`);
  }
}
