import type { MigrationInterface, QueryRunner } from 'typeorm';
import {
  AUDIT_ACTION_PATTERN_SOURCE,
  AUDIT_ACTIONS,
} from '../../modules/auth/audit-event.entity.js';

/**
 * Replaces the enumerated audit-action check with a name pattern.
 * Later features validate new names in code (`isAuditAction`) and do not
 * rewrite this constraint. Down restores the allow-list from migrations 1–15
 * and deletes only rows whose names are outside that list, so a database
 * that already applied those migrations can move forward and back.
 */
export class AuditActionPattern1794096000000 implements MigrationInterface {
  name = 'AuditActionPattern1794096000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_action_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("action" ~ '${AUDIT_ACTION_PATTERN_SOURCE}')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const allowed = AUDIT_ACTIONS.map((action) => `'${action}'`).join(', ');
    await queryRunner.query(`DELETE FROM "audit_events" WHERE "action" NOT IN (${allowed})`);
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_action_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("action" IN (${allowed}))`,
    );
  }
}
