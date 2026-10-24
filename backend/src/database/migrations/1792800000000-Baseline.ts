import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * First migration. It records that migration history has started and creates
 * no tables. Feature tables arrive in later milestones. PostgreSQL 13 and
 * newer already provide gen_random_uuid(), so no extension is required.
 */
export class Baseline1792800000000 implements MigrationInterface {
  name = 'Baseline1792800000000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // Intentionally empty.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Nothing was created.
  }
}
