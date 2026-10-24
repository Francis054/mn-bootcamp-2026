import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Accounts, server sessions, sign-in throttles, and the auth audit.
 * Passwords are stored only as hashes. Session cookies are stored only as hashes.
 */
export class Auth1792868400000 implements MigrationInterface {
  name = 'Auth1792868400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(320) NOT NULL,
        "display_name" varchar(120) NOT NULL,
        "initials" varchar(8) NOT NULL,
        "hue" smallint NOT NULL,
        "role" varchar(32) NOT NULL,
        "password_hash" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "users_email_unique" UNIQUE ("email"),
        CONSTRAINT "users_role_check" CHECK ("role" IN ('viewer', 'editor', 'administrator')),
        CONSTRAINT "users_hue_check" CHECK ("hue" >= 0 AND "hue" <= 359)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id" varchar(64) PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "expires_at" timestamptz NOT NULL,
        "last_seen_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "sessions_user_id_idx" ON "sessions" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "sessions_expires_at_idx" ON "sessions" ("expires_at")`);
    await queryRunner.query(`
      CREATE TABLE "login_throttles" (
        "subject_key" varchar(400) PRIMARY KEY,
        "failure_count" integer NOT NULL DEFAULT 0,
        "locked_until" timestamptz,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "audit_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "action" varchar(64) NOT NULL,
        "actor_user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "ip" varchar(64),
        "request_id" varchar(80),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "audit_events_action_check" CHECK (
          "action" IN ('auth.login.succeeded', 'auth.login.failed', 'auth.logout')
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "audit_events_created_at_idx" ON "audit_events" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "login_throttles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
