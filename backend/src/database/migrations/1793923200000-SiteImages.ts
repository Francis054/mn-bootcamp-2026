import type { MigrationInterface, QueryRunner } from 'typeorm';
import { AUDIT_ACTIONS } from '../../modules/auth/audit-event.entity.js';
import { SITE_IMAGE_SLOTS, siteImageSeedRow } from '../../modules/site-images/catalogue.js';

const PROVIDER = `'static', 'memory', 'cloudinary', 'unconfigured'`;

/**
 * Built-in pictures an administrator can replace. The insert is the current
 * catalogue: the community badge, the parent-organisation plate, and the
 * page photographs. It does nothing
 * when a key is already stored. This migration has not shipped, so the
 * catalogue here is the corrected slot list. Down drops only this table and
 * the audit actions this migration added.
 */
export class SiteImages1793923200000 implements MigrationInterface {
  name = 'SiteImages1793923200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "site_images" (
        "key" varchar(64) PRIMARY KEY,
        "label" varchar(120) NOT NULL,
        "description" varchar(400) NOT NULL,
        "url" varchar(1000) NOT NULL,
        "alt" varchar(300) NOT NULL,
        "width" int NOT NULL,
        "height" int NOT NULL,
        "fit" varchar(16) NOT NULL,
        "default_url" varchar(1000) NOT NULL,
        "default_alt" varchar(300) NOT NULL,
        "default_width" int NOT NULL,
        "default_height" int NOT NULL,
        "tagline" varchar(40) NOT NULL DEFAULT '',
        "default_tagline" varchar(40) NOT NULL DEFAULT '',
        "storage_provider" varchar(32) NOT NULL,
        "storage_key" varchar(500) NOT NULL DEFAULT '',
        "updated_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "site_images_fit_check" CHECK ("fit" IN ('cover', 'contain')),
        CONSTRAINT "site_images_storage_provider_check" CHECK ("storage_provider" IN (${PROVIDER})),
        CONSTRAINT "site_images_dimensions_check" CHECK (
          "width" BETWEEN 1 AND 20000
          AND "height" BETWEEN 1 AND 20000
          AND "default_width" BETWEEN 1 AND 20000
          AND "default_height" BETWEEN 1 AND 20000
        )
      )
    `);

    for (const slot of SITE_IMAGE_SLOTS) {
      const row = siteImageSeedRow(slot);
      await queryRunner.query(
        `
        INSERT INTO "site_images" (
          "key", "label", "description", "url", "alt", "width", "height", "fit",
          "default_url", "default_alt", "default_width", "default_height",
          "tagline", "default_tagline",
          "storage_provider", "storage_key"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT ("key") DO NOTHING
        `,
        [
          row.key,
          row.label,
          row.description,
          row.url,
          row.alt,
          row.width,
          row.height,
          row.fit,
          row.defaultUrl,
          row.defaultAlt,
          row.defaultWidth,
          row.defaultHeight,
          row.tagline,
          row.defaultTagline,
          row.storageProvider,
          row.storageKey,
        ],
      );
    }

    const allowed = AUDIT_ACTIONS.map((action) => `'${action}'`).join(', ');
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_action_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("action" IN (${allowed}))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_action_check"`,
    );
    await queryRunner.query(
      `DELETE FROM "audit_events" WHERE "action" LIKE 'curriculum.site_image.%'`,
    );
    const allowed = AUDIT_ACTIONS.filter((action) => !action.startsWith('curriculum.site_image.'))
      .map((action) => `'${action}'`)
      .join(', ');
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("action" IN (${allowed}))`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "site_images"`);
  }
}
