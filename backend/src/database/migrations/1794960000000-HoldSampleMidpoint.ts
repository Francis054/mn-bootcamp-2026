import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The labelled sample "Mid-bootcamp review" used 16 November 2026 as a placeholder.
 * A scheduled event becomes public at that Accra midnight. The date was never confirmed,
 * so this marks that one sample row as to-be-confirmed and it leaves the public list.
 * A row with another title, or one an editor has published, is left alone.
 * Running it again changes nothing.
 */
export class HoldSampleMidpoint1794960000000 implements MigrationInterface {
  name = 'HoldSampleMidpoint1794960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "events"
      SET "date_tbc" = true
      WHERE "id" = 'midpoint'
        AND "title" = 'Mid-bootcamp review'
        AND "publication_status" = 'scheduled'
        AND "sample" = true
        AND "internal_notes" LIKE '%Placeholder date%'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "events"
      SET "date_tbc" = false
      WHERE "id" = 'midpoint'
        AND "title" = 'Mid-bootcamp review'
        AND "publication_status" = 'scheduled'
        AND "sample" = true
        AND "internal_notes" LIKE '%Placeholder date%'
    `);
  }
}
