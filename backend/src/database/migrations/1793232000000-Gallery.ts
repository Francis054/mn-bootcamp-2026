import type { MigrationInterface, QueryRunner } from 'typeorm';
import { AUDIT_ACTIONS } from '../../modules/auth/audit-event.entity.js';

const WORKFLOW = `'draft', 'in_review', 'scheduled', 'published'`;
const LISTING = `'hidden', 'sample', 'public'`;
const CONSENT = `'pending', 'verified', 'withdrawn'`;
const PROVIDER = `'static', 'memory', 'cloudinary', 'unconfigured'`;
const ALBUM = `'anniversary', 'hackathon', 'community'`;

/** Actions allowed before this migration. Down() restores this list. */
const AUDIT_BEFORE_GALLERY = [
  'auth.login.succeeded',
  'auth.login.failed',
  'auth.logout',
  ...['track', 'module', 'phase', 'lesson', 'trainee', 'project', 'event'].flatMap((kind) =>
    ['created', 'updated', 'published', 'unpublished', 'deleted'].map(
      (verb) => `curriculum.${kind}.${verb}`,
    ),
  ),
];

/**
 * Photo metadata. Consent and publication are separate. Bytes for new uploads
 * live with the storage provider, not in this table.
 */
export class Gallery1793232000000 implements MigrationInterface {
  name = 'Gallery1793232000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "media_assets" (
        "id" varchar(64) PRIMARY KEY,
        "file" varchar(80) NOT NULL,
        "src" varchar(1000) NOT NULL DEFAULT '',
        "width" int NOT NULL,
        "height" int NOT NULL,
        "caption" varchar(500) NOT NULL,
        "alt" varchar(300) NOT NULL,
        "album" varchar(32) NOT NULL,
        "consent" varchar(16) NOT NULL,
        "consent_verified_at" timestamptz,
        "consent_recorded_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "consent_withdrawn_at" timestamptz,
        "publication_status" varchar(32) NOT NULL,
        "listing" varchar(16) NOT NULL,
        "storage_provider" varchar(32) NOT NULL,
        "storage_key" varchar(500) NOT NULL DEFAULT '',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "media_assets_album_check" CHECK ("album" IN (${ALBUM})),
        CONSTRAINT "media_assets_consent_check" CHECK ("consent" IN (${CONSENT})),
        CONSTRAINT "media_assets_publication_status_check" CHECK ("publication_status" IN (${WORKFLOW})),
        CONSTRAINT "media_assets_listing_check" CHECK ("listing" IN (${LISTING})),
        CONSTRAINT "media_assets_storage_provider_check" CHECK ("storage_provider" IN (${PROVIDER}))
      )
    `);
    await queryRunner.query(`CREATE INDEX "media_assets_album_idx" ON "media_assets" ("album")`);
    await queryRunner.query(
      `CREATE INDEX "media_assets_publication_status_idx" ON "media_assets" ("publication_status")`,
    );

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
    await queryRunner.query(`
      DELETE FROM "audit_events" WHERE "action" LIKE 'curriculum.media.%'
    `);
    const allowed = AUDIT_BEFORE_GALLERY.map((action) => `'${action}'`).join(', ');
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("action" IN (${allowed}))`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "media_assets"`);
  }
}
