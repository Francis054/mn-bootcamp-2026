import type { MigrationInterface, QueryRunner } from 'typeorm';
import { AUDIT_ACTIONS } from '../../modules/auth/audit-event.entity.js';

/** Actions allowed before this migration. Down() restores this list. */
const AUDIT_BEFORE_ACCOUNTS = [
  'auth.login.succeeded',
  'auth.login.failed',
  'auth.logout',
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

const ACCOUNT_ACTIONS = [
  'auth.password.changed',
  'auth.password.reset.requested',
  'auth.password.reset.completed',
  'auth.user.invited',
  'auth.user.role.updated',
  'enquiry.created',
  'enquiry.updated',
  'enquiry.deleted',
];

/**
 * Single-use reset and invite tokens, and the contact-form inbox.
 * Token rows store a hash. Enquiry rows store the message the person wrote.
 * Audit rows stay free of both.
 */
export class Accounts1793404800000 implements MigrationInterface {
  name = 'Accounts1793404800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "access_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "token_hash" varchar(64) NOT NULL,
        "purpose" varchar(16) NOT NULL,
        "user_id" uuid NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "access_tokens_token_hash_key" UNIQUE ("token_hash"),
        CONSTRAINT "access_tokens_purpose_check" CHECK ("purpose" IN ('reset', 'invite')),
        CONSTRAINT "access_tokens_user_id_fkey"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "enquiries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "email" varchar(320) NOT NULL,
        "topic" varchar(80) NOT NULL,
        "message" varchar(5000) NOT NULL,
        "handled" boolean NOT NULL DEFAULT false,
        "notified" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    const allowed = AUDIT_ACTIONS.map((action) => `'${action}'`).join(', ');
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_action_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("action" IN (${allowed}))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "enquiries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "access_tokens"`);
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_action_check"`,
    );
    const quoted = ACCOUNT_ACTIONS.map((action) => `'${action}'`).join(', ');
    await queryRunner.query(`DELETE FROM "audit_events" WHERE "action" IN (${quoted})`);
    const allowed = AUDIT_BEFORE_ACCOUNTS.map((action) => `'${action}'`).join(', ');
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("action" IN (${allowed}))`,
    );
  }
}
