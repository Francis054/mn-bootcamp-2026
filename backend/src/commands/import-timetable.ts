import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DataSource } from 'typeorm';
import { EnvError, loadEnv } from '../config/env.js';
import { createDataSource } from '../database/data-source.js';
import { AuditRepository } from '../modules/auth/audit.repository.js';
import { AuditEventEntity } from '../modules/auth/audit-event.entity.js';
import { TimetableRepository } from '../modules/timetable/timetable.repository.js';
import { TimetableService } from '../modules/timetable/timetable.service.js';
import { timetableWorkbookPath } from '../modules/timetable/workbook-path.js';
import { postgresCode } from '../shared/persistence/postgres-error.js';

export interface ImportIO {
  env?: NodeJS.ProcessEnv;
  loadDotenv?: boolean;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  dataSource?: DataSource;
}

/** Load the workbook into the timetable tables. Safe to run again. */
export async function runTimetableImport(options: ImportIO = {}): Promise<number> {
  const stdout = options.stdout ?? ((line: string) => process.stdout.write(`${line}\n`));
  const stderr = options.stderr ?? ((line: string) => process.stderr.write(`${line}\n`));
  const env = options.env ?? process.env;
  let opened = false;
  let dataSource = options.dataSource;
  try {
    if (!dataSource) {
      const appEnv = loadEnv(env, { loadDotenv: options.loadDotenv ?? options.env === undefined });
      dataSource = createDataSource(appEnv);
      await dataSource.initialize();
      opened = true;
    }
    const service = new TimetableService(
      new TimetableRepository(dataSource),
      new AuditRepository(dataSource.getRepository(AuditEventEntity)),
    );
    const report = await service.importBuffer(readFileSync(timetableWorkbookPath()), {
      userId: null,
      ip: null,
      requestId: null,
    });
    stdout(
      `Timetable ready: ${report.weeks} weeks, ${report.sessions} sessions, ${report.trainers} trainers, ${report.deliverables} deliverables, ${report.warnings.length} warnings.`,
    );
    for (const warning of report.warnings) {
      stdout(`warning ${warning.code}: ${warning.message}`);
    }
    return 0;
  } catch (error) {
    stderr(safeMessage(error));
    return 1;
  } finally {
    if (opened && dataSource?.isInitialized) await dataSource.destroy();
  }
}

function safeMessage(error: unknown): string {
  if (error instanceof EnvError) return error.message;
  if (postgresCode(error) === '42P01') return 'The timetable tables are missing. Run the migrations.';
  if (error instanceof Error && /ENOENT|workbook|Timetable sheet/.test(error.message)) {
    return error.message;
  }
  return 'The timetable was not loaded. Check DATABASE_URL and run the migrations.';
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  runTimetableImport()
    .then((code) => {
      process.exit(code);
    })
    .catch(() => {
      process.stderr.write('The timetable was not loaded.\n');
      process.exit(1);
    });
}
