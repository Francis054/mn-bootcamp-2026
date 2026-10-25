import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A trainee profile can keep one photo address. The storage key is how a
 * later replace or remove deletes the previous object. Both stay empty until
 * an editor uploads a photo.
 */
export class TraineePhoto1793836800000 implements MigrationInterface {
  name = 'TraineePhoto1793836800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "trainees" ADD "photo_url" varchar(1000)`);
    await queryRunner.query(`ALTER TABLE "trainees" ADD "photo_storage_key" varchar(200)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "photo_storage_key"`);
    await queryRunner.query(`ALTER TABLE "trainees" DROP COLUMN "photo_url"`);
  }
}
