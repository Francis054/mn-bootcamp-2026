import type { MigrationInterface, QueryRunner } from 'typeorm';
import { AUDIT_ACTIONS } from '../../modules/auth/audit-event.entity.js';
import { TRAINEE_TRACKS } from '../../modules/trainees/tracks.js';

const WORKFLOW = `'draft', 'in_review', 'scheduled', 'published'`;
const LISTING = `'hidden', 'sample', 'public'`;
const TRACKS = TRAINEE_TRACKS.map((track) => `'${track}'`).join(', ');

/**
 * Actions the curriculum migration already allowed. Down() restores this list
 * after deleting trainee rows, so the older check can be put back.
 */
const AUDIT_BEFORE_TRAINEES = [
  'auth.login.succeeded',
  'auth.login.failed',
  'auth.logout',
  ...['track', 'module', 'phase', 'lesson'].flatMap((kind) =>
    ['created', 'updated', 'published', 'unpublished', 'deleted'].map(
      (verb) => `curriculum.${kind}.${verb}`,
    ),
  ),
];

/**
 * Trainee profiles. A public read needs consent as well as publication.
 * Email, links, notes, and the consent bookkeeping stay off the public DTO.
 */
export class Trainees1792972800000 implements MigrationInterface {
  name = 'Trainees1792972800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "trainees" (
        "id" varchar(64) PRIMARY KEY,
        "display_name" varchar(120) NOT NULL,
        "initials" varchar(8) NOT NULL,
        "hue" smallint NOT NULL,
        "email" varchar(320) NOT NULL,
        "track" varchar(40) NOT NULL,
        "focus" varchar(40) NOT NULL REFERENCES "modules" ("id") ON DELETE RESTRICT,
        "skills" text[] NOT NULL DEFAULT '{}',
        "bio" text NOT NULL DEFAULT '',
        "quote" text NOT NULL DEFAULT '',
        "linkedin" varchar(500) NOT NULL DEFAULT '',
        "portfolio" varchar(500) NOT NULL DEFAULT '',
        "consent_received" boolean NOT NULL DEFAULT false,
        "consent_received_at" timestamptz,
        "consent_recorded_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "consent_withdrawn_at" timestamptz,
        "listing" varchar(16) NOT NULL,
        "publication_status" varchar(32) NOT NULL,
        "status_label" varchar(80) NOT NULL DEFAULT 'In training',
        "internal_notes" text NOT NULL DEFAULT '',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "trainees_email_unique" UNIQUE ("email"),
        CONSTRAINT "trainees_email_check" CHECK ("email" = lower("email") AND "email" <> ''),
        CONSTRAINT "trainees_track_check" CHECK ("track" IN (${TRACKS})),
        CONSTRAINT "trainees_hue_check" CHECK ("hue" >= 0 AND "hue" <= 359),
        CONSTRAINT "trainees_publication_status_check" CHECK ("publication_status" IN (${WORKFLOW})),
        CONSTRAINT "trainees_listing_check" CHECK ("listing" IN (${LISTING}))
      )
    `);
    await queryRunner.query(`CREATE INDEX "trainees_focus_idx" ON "trainees" ("focus")`);
    await queryRunner.query(
      `CREATE INDEX "trainees_publication_status_idx" ON "trainees" ("publication_status")`,
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
      DELETE FROM "audit_events" WHERE "action" LIKE 'curriculum.trainee.%'
    `);
    const allowed = AUDIT_BEFORE_TRAINEES.map((action) => `'${action}'`).join(', ');
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("action" IN (${allowed}))`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "trainees"`);
  }
}
