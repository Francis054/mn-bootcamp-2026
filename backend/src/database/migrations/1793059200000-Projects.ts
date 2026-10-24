import type { MigrationInterface, QueryRunner } from 'typeorm';
import { AUDIT_ACTIONS } from '../../modules/auth/audit-event.entity.js';
import { PROJECT_TYPES } from '../../modules/projects/project-types.js';

const WORKFLOW = `'draft', 'in_review', 'scheduled', 'published'`;
const LISTING = `'hidden', 'sample', 'public'`;
const TYPES = PROJECT_TYPES.map((type) => `'${type}'`).join(', ');

/** Actions allowed before this migration. Down() restores this list. */
const AUDIT_BEFORE_PROJECTS = [
  'auth.login.succeeded',
  'auth.login.failed',
  'auth.logout',
  ...['track', 'module', 'phase', 'lesson', 'trainee'].flatMap((kind) =>
    ['created', 'updated', 'published', 'unpublished', 'deleted'].map(
      (verb) => `curriculum.${kind}.${verb}`,
    ),
  ),
];

/**
 * Projects, the trainee relation, and link-share consent on the trainee.
 * A public project can omit its links. The links appear only when the project
 * is published and every linked trainee has agreed.
 */
export class Projects1793059200000 implements MigrationInterface {
  name = 'Projects1793059200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trainees" ADD COLUMN "links_share_consent" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "trainees" ADD COLUMN "links_share_consent_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE "trainees" ADD COLUMN "links_share_consent_recorded_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "trainees" ADD COLUMN "links_share_consent_withdrawn_at" timestamptz`,
    );

    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" varchar(64) PRIMARY KEY,
        "title" varchar(200) NOT NULL,
        "slug" varchar(200) NOT NULL,
        "type" varchar(40) NOT NULL,
        "module_id" varchar(40) NOT NULL REFERENCES "modules" ("id") ON DELETE RESTRICT,
        "cover" varchar(200) NOT NULL DEFAULT 'terminal',
        "image" varchar(200) NOT NULL DEFAULT 'electronics-lab',
        "abstract" text NOT NULL,
        "tools" varchar(500) NOT NULL DEFAULT '',
        "steps" text[] NOT NULL DEFAULT '{}',
        "team" text[] NOT NULL DEFAULT '{}',
        "repository_url" varchar(500) NOT NULL DEFAULT '',
        "demo_url" varchar(500) NOT NULL DEFAULT '',
        "lab_only_confirmed" boolean NOT NULL DEFAULT false,
        "share_agreed" boolean NOT NULL DEFAULT false,
        "publication_status" varchar(32) NOT NULL,
        "listing" varchar(16) NOT NULL,
        "internal_notes" text NOT NULL DEFAULT '',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "projects_type_check" CHECK ("type" IN (${TYPES})),
        CONSTRAINT "projects_publication_status_check" CHECK ("publication_status" IN (${WORKFLOW})),
        CONSTRAINT "projects_listing_check" CHECK ("listing" IN (${LISTING}))
      )
    `);
    await queryRunner.query(`CREATE INDEX "projects_module_id_idx" ON "projects" ("module_id")`);
    await queryRunner.query(
      `CREATE INDEX "projects_publication_status_idx" ON "projects" ("publication_status")`,
    );
    await queryRunner.query(`
      CREATE TABLE "project_trainees" (
        "project_id" varchar(64) NOT NULL REFERENCES "projects" ("id") ON DELETE CASCADE,
        "trainee_id" varchar(64) NOT NULL REFERENCES "trainees" ("id") ON DELETE RESTRICT,
        PRIMARY KEY ("project_id", "trainee_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "project_trainees_trainee_id_idx" ON "project_trainees" ("trainee_id")`,
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
      DELETE FROM "audit_events" WHERE "action" LIKE 'curriculum.project.%'
    `);
    const allowed = AUDIT_BEFORE_PROJECTS.map((action) => `'${action}'`).join(', ');
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("action" IN (${allowed}))`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "project_trainees"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "projects"`);
    await queryRunner.query(
      `ALTER TABLE "trainees" DROP COLUMN IF EXISTS "links_share_consent_withdrawn_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trainees" DROP COLUMN IF EXISTS "links_share_consent_recorded_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trainees" DROP COLUMN IF EXISTS "links_share_consent_at"`,
    );
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN IF EXISTS "links_share_consent"`);
  }
}
