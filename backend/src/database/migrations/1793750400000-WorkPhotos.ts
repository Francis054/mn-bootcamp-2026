import type { MigrationInterface, QueryRunner } from 'typeorm';
import { AUDIT_ACTIONS } from '../../modules/auth/audit-event.entity.js';

const WORKFLOW = `'draft', 'in_review', 'scheduled', 'published'`;
const LISTING = `'hidden', 'sample', 'public'`;
const PROVIDER = `'static', 'memory', 'cloudinary', 'unconfigured'`;

/** Actions allowed before this migration. Down() restores this list. */
const AUDIT_BEFORE_WORK_PHOTOS = [
  'auth.login.succeeded',
  'auth.login.failed',
  'auth.logout',
  'auth.password.changed',
  'auth.password.reset.requested',
  'auth.password.reset.completed',
  'auth.user.invited',
  'auth.user.role.updated',
  'enquiry.created',
  'enquiry.updated',
  'enquiry.deleted',
  ...[
    'track',
    'module',
    'phase',
    'lesson',
    'trainee',
    'project',
    'event',
    'media',
    'homepage',
    'about',
    'milestone',
    'settings',
  ].flatMap((kind) =>
    ['created', 'updated', 'published', 'unpublished', 'deleted'].map(
      (verb) => `curriculum.${kind}.${verb}`,
    ),
  ),
];

/**
 * Photos of trainees at work. An administrator uploads them. Publication is
 * separate from the upload, the same way a project is published.
 */
export class WorkPhotos1793750400000 implements MigrationInterface {
  name = 'WorkPhotos1793750400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "work_photos" (
        "id" varchar(64) PRIMARY KEY,
        "trainee_id" varchar(64) NOT NULL REFERENCES "trainees" ("id") ON DELETE CASCADE,
        "project_id" varchar(64) REFERENCES "projects" ("id") ON DELETE SET NULL,
        "src" varchar(1000) NOT NULL DEFAULT '',
        "width" int NOT NULL,
        "height" int NOT NULL,
        "alt" varchar(300) NOT NULL,
        "caption" varchar(500) NOT NULL DEFAULT '',
        "publication_status" varchar(32) NOT NULL,
        "listing" varchar(16) NOT NULL,
        "storage_provider" varchar(32) NOT NULL,
        "storage_key" varchar(500) NOT NULL DEFAULT '',
        "uploaded_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "work_photos_publication_status_check" CHECK ("publication_status" IN (${WORKFLOW})),
        CONSTRAINT "work_photos_listing_check" CHECK ("listing" IN (${LISTING})),
        CONSTRAINT "work_photos_storage_provider_check" CHECK ("storage_provider" IN (${PROVIDER}))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "work_photos_trainee_id_idx" ON "work_photos" ("trainee_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "work_photos_project_id_idx" ON "work_photos" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "work_photos_publication_status_idx" ON "work_photos" ("publication_status")`,
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
      DELETE FROM "audit_events" WHERE "action" LIKE 'curriculum.work_photo.%'
    `);
    const allowed = AUDIT_BEFORE_WORK_PHOTOS.map((action) => `'${action}'`).join(', ');
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("action" IN (${allowed}))`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "work_photos"`);
  }
}
