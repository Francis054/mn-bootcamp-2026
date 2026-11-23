import type { MigrationInterface, QueryRunner } from 'typeorm';

const GROUP = `'founder', 'team', 'partner'`;
const PROVIDER = `'static', 'memory', 'cloudinary', 'unconfigured'`;

/**
 * People on the public About page: founder, team, and partners.
 * A description is optional. The photo is stored the same way as a profile
 * photo. `down` drops only this table and its audit rows.
 */
export class AboutPeople1795046400000 implements MigrationInterface {
  name = 'AboutPeople1795046400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "about_people" (
        "id" varchar(64) PRIMARY KEY,
        "person_group" varchar(16) NOT NULL,
        "name" varchar(120) NOT NULL,
        "title" varchar(160) NOT NULL DEFAULT '',
        "description" varchar(2000) NOT NULL DEFAULT '',
        "photo_url" varchar(1000) NOT NULL DEFAULT '',
        "photo_storage_key" varchar(500) NOT NULL DEFAULT '',
        "storage_provider" varchar(32) NOT NULL DEFAULT 'memory',
        "width" int NOT NULL DEFAULT 0,
        "height" int NOT NULL DEFAULT 0,
        "display_order" int NOT NULL DEFAULT 0,
        "published" boolean NOT NULL DEFAULT false,
        "updated_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "about_people_group_check" CHECK ("person_group" IN (${GROUP})),
        CONSTRAINT "about_people_storage_provider_check" CHECK ("storage_provider" IN (${PROVIDER})),
        CONSTRAINT "about_people_dimensions_check" CHECK (
          "width" BETWEEN 0 AND 20000 AND "height" BETWEEN 0 AND 20000
        ),
        CONSTRAINT "about_people_display_order_check" CHECK ("display_order" BETWEEN 0 AND 10000)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "about_people_group_order_idx" ON "about_people" ("person_group", "display_order")`,
    );
    await queryRunner.query(
      `CREATE INDEX "about_people_published_idx" ON "about_people" ("published")`,
    );
    await queryRunner.query(`ALTER TABLE "about_people" ENABLE ROW LEVEL SECURITY`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "audit_events" WHERE "action" LIKE 'curriculum.about_person.%'
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "about_people"`);
  }
}
