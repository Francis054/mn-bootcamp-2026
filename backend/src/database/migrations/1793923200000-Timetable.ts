import type { MigrationInterface, QueryRunner } from 'typeorm';
import { AUDIT_ACTIONS } from '../../modules/auth/audit-event.entity.js';

const DATE = `'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`;
const CLOCK = `'^([01][0-9]|2[0-3]):[0-5][0-9]$'`;

/**
 * The 12-week timetable: blocks, weeks, deliverables, proposed trainers,
 * and daily class sessions. Lesson notes stay in `lessons`. Sample lesson
 * titles that still describe the old six-module sequence are renamed to the
 * workbook week headings. Confirmed trainers are people records, not logins.
 */
export class Timetable1793923200000 implements MigrationInterface {
  name = 'Timetable1793923200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "programmes" (
        "id" varchar(64) PRIMARY KEY,
        "name" varchar(160) NOT NULL,
        "starts_on" varchar(10) NOT NULL,
        "ends_on" varchar(10) NOT NULL,
        "rules" jsonb NOT NULL DEFAULT '[]',
        "source_note" text NOT NULL DEFAULT '',
        "import_warnings" jsonb NOT NULL DEFAULT '[]',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "programmes_starts_on_check" CHECK ("starts_on" ~ ${DATE}),
        CONSTRAINT "programmes_ends_on_check" CHECK ("ends_on" ~ ${DATE})
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "curriculum_blocks" (
        "id" varchar(64) PRIMARY KEY,
        "programme_id" varchar(64) NOT NULL REFERENCES "programmes" ("id") ON DELETE CASCADE,
        "sort_order" integer NOT NULL,
        "name" varchar(160) NOT NULL,
        "professionalism_theme" varchar(200) NOT NULL DEFAULT '',
        "cybersecurity_theme" varchar(200) NOT NULL DEFAULT '',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "curriculum_blocks_sort_order_check" CHECK ("sort_order" >= 0 AND "sort_order" <= 99)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "curriculum_weeks" (
        "id" varchar(64) PRIMARY KEY,
        "programme_id" varchar(64) NOT NULL REFERENCES "programmes" ("id") ON DELETE CASCADE,
        "block_id" varchar(64) NOT NULL REFERENCES "curriculum_blocks" ("id") ON DELETE RESTRICT,
        "number" smallint NOT NULL,
        "title" varchar(200) NOT NULL,
        "starts_on" varchar(10) NOT NULL,
        "professionalism" text NOT NULL DEFAULT '',
        "cybersecurity" text NOT NULL DEFAULT '',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "curriculum_weeks_number_check" CHECK ("number" >= 1 AND "number" <= 24),
        CONSTRAINT "curriculum_weeks_starts_on_check" CHECK ("starts_on" ~ ${DATE}),
        CONSTRAINT "curriculum_weeks_programme_number_unique" UNIQUE ("programme_id", "number")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "week_deliverables" (
        "id" varchar(64) PRIMARY KEY,
        "week_id" varchar(64) NOT NULL REFERENCES "curriculum_weeks" ("id") ON DELETE CASCADE,
        "sort_order" integer NOT NULL,
        "title" text NOT NULL,
        CONSTRAINT "week_deliverables_sort_order_check" CHECK ("sort_order" >= 1 AND "sort_order" <= 99),
        CONSTRAINT "week_deliverables_week_sort_unique" UNIQUE ("week_id", "sort_order")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "trainers" (
        "id" varchar(64) PRIMARY KEY,
        "display_name" varchar(160) NOT NULL,
        "normalized_name" varchar(160) NOT NULL,
        "kind" varchar(16) NOT NULL,
        "proposed" boolean NOT NULL DEFAULT true,
        "user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "trainers_normalized_name_unique" UNIQUE ("normalized_name"),
        CONSTRAINT "trainers_kind_check" CHECK ("kind" IN ('person', 'group'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "week_trainers" (
        "week_id" varchar(64) NOT NULL REFERENCES "curriculum_weeks" ("id") ON DELETE CASCADE,
        "trainer_id" varchar(64) NOT NULL REFERENCES "trainers" ("id") ON DELETE CASCADE,
        "role" varchar(32) NOT NULL,
        "sort_order" integer NOT NULL,
        PRIMARY KEY ("week_id", "trainer_id", "role"),
        CONSTRAINT "week_trainers_role_check" CHECK ("role" IN ('professionalism', 'cybersecurity')),
        CONSTRAINT "week_trainers_sort_order_check" CHECK ("sort_order" >= 1 AND "sort_order" <= 99)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "class_sessions" (
        "id" varchar(64) PRIMARY KEY,
        "programme_id" varchar(64) NOT NULL REFERENCES "programmes" ("id") ON DELETE CASCADE,
        "week_id" varchar(64) NOT NULL REFERENCES "curriculum_weeks" ("id") ON DELETE CASCADE,
        "import_key" varchar(40),
        "session_date" varchar(10) NOT NULL,
        "day_name" varchar(16) NOT NULL,
        "sort_order" integer NOT NULL,
        "session_type" varchar(16) NOT NULL,
        "activity" varchar(200) NOT NULL DEFAULT '',
        "topic" text NOT NULL DEFAULT '',
        "notes" text NOT NULL DEFAULT '',
        "start_time" varchar(5),
        "end_time" varchar(5),
        "raw_time" varchar(80) NOT NULL DEFAULT '',
        "trainer_status" varchar(16) NOT NULL,
        "origin" varchar(16) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "class_sessions_date_check" CHECK ("session_date" ~ ${DATE}),
        CONSTRAINT "class_sessions_sort_order_check" CHECK ("sort_order" >= 1 AND "sort_order" <= 99),
        CONSTRAINT "class_sessions_type_check" CHECK ("session_type" IN ('devotion', 'standup', 'theory', 'practical', 'break', 'group', 'event')),
        CONSTRAINT "class_sessions_trainer_status_check" CHECK ("trainer_status" IN ('assigned', 'tbc', 'all', 'unspecified')),
        CONSTRAINT "class_sessions_origin_check" CHECK ("origin" IN ('import', 'admin')),
        CONSTRAINT "class_sessions_start_time_check" CHECK ("start_time" IS NULL OR "start_time" ~ ${CLOCK}),
        CONSTRAINT "class_sessions_end_time_check" CHECK ("end_time" IS NULL OR "end_time" ~ ${CLOCK})
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "class_sessions_import_key_uq"
      ON "class_sessions" ("import_key")
      WHERE "import_key" IS NOT NULL
    `);
    await queryRunner.query(
      `CREATE INDEX "class_sessions_week_id_idx" ON "class_sessions" ("week_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "class_sessions_date_idx" ON "class_sessions" ("session_date")`,
    );
    await queryRunner.query(`
      CREATE TABLE "session_trainers" (
        "session_id" varchar(64) NOT NULL REFERENCES "class_sessions" ("id") ON DELETE CASCADE,
        "trainer_id" varchar(64) NOT NULL REFERENCES "trainers" ("id") ON DELETE CASCADE,
        "sort_order" integer NOT NULL,
        PRIMARY KEY ("session_id", "trainer_id"),
        CONSTRAINT "session_trainers_sort_order_check" CHECK ("sort_order" >= 1 AND "sort_order" <= 99)
      )
    `);

    await queryRunner.query(`
      UPDATE "phases"
      SET "name" = 'Foundations & Secure Systems',
          "months" = '5 Oct – 30 Oct',
          "summary" = 'Professional foundation, then cybersecurity foundations: the CIA triad, risk, threats, vulnerabilities and controls.'
      WHERE "id" = 1 AND "name" = 'Foundations'
    `);
    await queryRunner.query(`
      UPDATE "phases"
      SET "name" = 'Applications, Data & Cryptography',
          "months" = '2 Nov – 27 Nov',
          "summary" = 'Professional practice, then applications, databases and cryptography.'
      WHERE "id" = 2 AND "name" = 'Find & analyse'
    `);
    await queryRunner.query(`
      UPDATE "phases"
      SET "name" = 'Identity, Cloud, Threats & Capstone',
          "months" = '30 Nov – 25 Dec',
          "summary" = 'Career readiness, then identity, cloud, authorised vulnerability assessment, AI and the capstone.'
      WHERE "id" = 3 AND "name" = 'Respond & protect'
    `);

    const lessonTitles: Array<[string, string, string]> = [
      ['1', 'How networks really move data', 'Foundations and professional orientation'],
      ['2', 'Firewalls, segmentation and VPNs', 'TCP/IP networking'],
      ['3', 'The ethical hacker’s mindset and the law', 'Computer systems and secure workstations'],
      ['4', 'Reconnaissance in a safe lab', 'Security management, risk and governance'],
      ['5', 'Scanning and prioritising vulnerabilities', 'Application security and secure development'],
      ['6', 'Writing a vulnerability report', 'Database security'],
      ['7', 'Evidence handling basics', 'Cryptography and secure communications'],
      ['8', 'Spotting social engineering', 'Identity and access management'],
      ['9', 'Reading the story in a disk image', 'Cloud computing and cloud security'],
      ['10', 'The incident response lifecycle', 'Authorised vulnerability assessment'],
      ['11', 'Tabletop exercise: a simulated breach', 'AI and cybersecurity automations'],
      ['12', 'Designing an awareness session', 'Incident response, exam revision and capstone'],
    ];
    for (const [id, previous, title] of lessonTitles) {
      await queryRunner.query(
        `UPDATE "lessons"
         SET "title" = $1,
             "summary" = $2
         WHERE "id" = $3 AND "title" = $4`,
        [
          title,
          `Sample lesson notes for week ${id} (${title}). The daily timetable is the schedule. Objectives and the lab below are still placeholders.`,
          id,
          previous,
        ],
      );
    }

    await queryRunner.query(
      `UPDATE "content_singletons"
       SET "draft" = jsonb_set("draft", '{lead}', to_jsonb($1::text))
       WHERE "id" = 'homepage' AND "draft"->>'lead' = $2`,
      [
        'A free, in-person cybersecurity bootcamp in Accra. Twelve weeks, from 5 October to 25 December 2026.',
        'A free, in-person cybersecurity bootcamp in Accra, from network security to incident response. Follow the 2026 cohort from its first week to graduation.',
      ],
    );
    await queryRunner.query(
      `UPDATE "content_singletons"
       SET "draft" = jsonb_set("draft", '{siteName}', to_jsonb($1::text))
       WHERE "id" = 'settings' AND "draft"->>'siteName' = '2026 Cyber Bootcamp'`,
      ['2026 Cybersecurity Bootcamp'],
    );
    await queryRunner.query(
      `UPDATE "events"
       SET "summary" = $1
       WHERE "id" = 'start' AND "summary" = $2`,
      [
        'The free, in-person 2026 Cybersecurity Bootcamp begins.',
        'The free, in-person 2026 Cyber Security Bootcamp begins.',
      ],
    );
    await queryRunner.query(
      `UPDATE "events"
       SET "when_label" = $1,
           "summary" = $2,
           "body" = jsonb_set("body", '{text}', to_jsonb($3::text)),
           "source" = $4
       WHERE "id" = 'graduation' AND "summary" = 'Training ends in December 2026. Graduation details are still to be confirmed.'`,
      [
        'Training ends 25 Dec 2026 · ceremony TBC',
        'Training ends on 25 December 2026. The graduation ceremony date, venue and format are still to be confirmed.',
        'Training ends on 25 December 2026. The graduation ceremony date, venue and format are still to be confirmed.',
        'Training ends 25 December 2026 (timetable). Ceremony details unconfirmed. Sample event.',
      ],
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
    await queryRunner.query(`DELETE FROM "audit_events" WHERE "action" LIKE 'curriculum.timetable.%'`);
    const allowed = AUDIT_ACTIONS.filter((action) => !action.startsWith('curriculum.timetable.')).map(
      (action) => `'${action}'`,
    ).join(', ');
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("action" IN (${allowed}))`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "session_trainers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "class_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "week_trainers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trainers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "week_deliverables"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "curriculum_weeks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "curriculum_blocks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "programmes"`);
  }
}
