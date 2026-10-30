import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Optional milestones a trainee writes on their own journey.
 * The rest of the journey is computed when it is read. There is no journey table.
 * `down` drops only this table and its audit rows. It does not delete trainees.
 */
export class TraineeMilestones1794700800000 implements MigrationInterface {
  name = 'TraineeMilestones1794700800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "trainee_milestones" (
        "id" uuid PRIMARY KEY,
        "trainee_id" varchar(64) NOT NULL,
        "title" varchar(160) NOT NULL,
        "summary" varchar(2000) NOT NULL DEFAULT '',
        "occurred_on" varchar(10) NOT NULL,
        "visibility" varchar(16) NOT NULL DEFAULT 'private',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "trainee_milestones_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainees" ("id") ON DELETE CASCADE,
        CONSTRAINT "trainee_milestones_visibility_check" CHECK ("visibility" IN ('private', 'public'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "trainee_milestones_trainee_date_idx" ON "trainee_milestones" ("trainee_id", "occurred_on")`,
    );
    await queryRunner.query(`ALTER TABLE "trainee_milestones" ENABLE ROW LEVEL SECURITY`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "audit_events" WHERE "action" IN (
        'portal.milestone.created',
        'portal.milestone.updated',
        'portal.milestone.deleted'
      )
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "trainee_milestones"`);
  }
}
