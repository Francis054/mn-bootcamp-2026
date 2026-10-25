import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The class, trainee, and project forms save a module id, and a class also
 * needs the phase for its week. Those rows used to exist only after a seed,
 * so a fresh database rejected the save. This inserts the catalogue when the
 * id is missing and does not overwrite a row that is already there.
 *
 * The same forms can attach classes, trainees, projects, and photos. Those
 * choices live in join tables. Deleting a parent or a linked row removes the
 * link so the delete does not fail with a hidden database error.
 */
export class CatalogueLinks1793664000000 implements MigrationInterface {
  name = 'CatalogueLinks1793664000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "tracks" ("id", "name", "summary", "sort_order", "publication_status", "listing")
      VALUES
        ('blue-team', 'Blue team', 'Sample track. Defending systems. The real description is still to be confirmed.', 1, 'published', 'sample'),
        ('red-team', 'Red team', 'Sample track. Testing defences in a lab, with permission. The real description is still to be confirmed.', 2, 'published', 'sample'),
        ('grc-awareness', 'GRC & Awareness', 'Sample track. Governance, risk, compliance, and helping people stay safe. The real description is still to be confirmed.', 3, 'published', 'sample')
      ON CONFLICT ("id") DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "modules" ("id", "name", "short", "icon", "summary", "sort_order", "publication_status", "listing")
      VALUES
        ('network', 'Network security', 'Network', 'network', 'How data moves across networks and how to defend it with firewalls, segmentation and secure configuration.', 1, 'published', 'sample'),
        ('ethical', 'Ethical hacking', 'Ethical hacking', 'terminal', 'Thinking like an attacker, legally and responsibly, to find weaknesses before others do.', 2, 'published', 'sample'),
        ('vuln', 'Vulnerability assessment', 'Vulnerability', 'scan', 'Scanning systems, ranking what matters most and reporting it clearly.', 3, 'published', 'sample'),
        ('forensics', 'Digital forensics', 'Forensics', 'search', 'Collecting and analysing digital evidence without breaking its chain of custody.', 4, 'published', 'sample'),
        ('awareness', 'Security awareness', 'Awareness', 'users', 'Helping people recognise phishing and social engineering, the most common way in.', 5, 'published', 'sample'),
        ('incident', 'Incident response', 'Incident response', 'alert', 'Detecting, containing and recovering from attacks, step by step.', 6, 'published', 'sample')
      ON CONFLICT ("id") DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "phases" ("id", "name", "months", "summary", "module_ids", "publication_status", "listing")
      VALUES
        (1, 'Foundations', 'October', 'How networks work, how they are defended, and the ethics and law of security testing.', ARRAY['network', 'ethical'], 'published', 'sample'),
        (2, 'Find & analyse', 'November', 'Finding weaknesses before attackers do, and reading the evidence they leave behind.', ARRAY['vuln', 'forensics'], 'published', 'sample'),
        (3, 'Respond & protect', 'December', 'Handling incidents calmly and helping people around you stay safe online.', ARRAY['incident', 'awareness'], 'published', 'sample')
      ON CONFLICT ("id") DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE "trainee_lessons" (
        "trainee_id" varchar(64) NOT NULL REFERENCES "trainees" ("id") ON DELETE CASCADE,
        "lesson_id" varchar(64) NOT NULL REFERENCES "lessons" ("id") ON DELETE CASCADE,
        PRIMARY KEY ("trainee_id", "lesson_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "trainee_lessons_lesson_id_idx" ON "trainee_lessons" ("lesson_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE "project_lessons" (
        "project_id" varchar(64) NOT NULL REFERENCES "projects" ("id") ON DELETE CASCADE,
        "lesson_id" varchar(64) NOT NULL REFERENCES "lessons" ("id") ON DELETE CASCADE,
        PRIMARY KEY ("project_id", "lesson_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "project_lessons_lesson_id_idx" ON "project_lessons" ("lesson_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE "event_lessons" (
        "event_id" varchar(64) NOT NULL REFERENCES "events" ("id") ON DELETE CASCADE,
        "lesson_id" varchar(64) NOT NULL REFERENCES "lessons" ("id") ON DELETE CASCADE,
        PRIMARY KEY ("event_id", "lesson_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "event_lessons_lesson_id_idx" ON "event_lessons" ("lesson_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE "event_projects" (
        "event_id" varchar(64) NOT NULL REFERENCES "events" ("id") ON DELETE CASCADE,
        "project_id" varchar(64) NOT NULL REFERENCES "projects" ("id") ON DELETE CASCADE,
        PRIMARY KEY ("event_id", "project_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "event_projects_project_id_idx" ON "event_projects" ("project_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE "event_media" (
        "event_id" varchar(64) NOT NULL REFERENCES "events" ("id") ON DELETE CASCADE,
        "media_id" varchar(64) NOT NULL REFERENCES "media_assets" ("id") ON DELETE CASCADE,
        PRIMARY KEY ("event_id", "media_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "event_media_media_id_idx" ON "event_media" ("media_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "event_media"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_projects"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_lessons"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_lessons"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trainee_lessons"`);
    // Catalogue rows stay. Removing them can fail while classes still point at them.
  }
}
