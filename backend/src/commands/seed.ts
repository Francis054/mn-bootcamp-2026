import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { EnvError, loadEnv } from '../config/env.js';
import { createDataSource } from '../database/data-source.js';
import { LessonEntity } from '../modules/curriculum/lesson.entity.js';
import { ModuleEntity } from '../modules/curriculum/module.entity.js';
import { PhaseEntity } from '../modules/curriculum/phase.entity.js';
import {
  LessonRepository,
  ModuleRepository,
  PhaseRepository,
  TrackRepository,
} from '../modules/curriculum/repositories.js';
import { SeedService } from '../modules/curriculum/seed.service.js';
import { TrackEntity } from '../modules/curriculum/track.entity.js';
import { postgresCode } from '../shared/persistence/postgres-error.js';

export interface SeedIO {
  env?: NodeJS.ProcessEnv;
  loadDotenv?: boolean;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}

/** Insert labelled sample curriculum. Safe to run again. Does not print secrets. */
export async function runSeed(options: SeedIO = {}): Promise<number> {
  const stdout = options.stdout ?? ((line: string) => process.stdout.write(`${line}\n`));
  const stderr = options.stderr ?? ((line: string) => process.stderr.write(`${line}\n`));
  const env = options.env ?? process.env;
  try {
    const appEnv = loadEnv(env, { loadDotenv: options.loadDotenv ?? options.env === undefined });
    const dataSource = createDataSource(appEnv);
    await dataSource.initialize();
    try {
      const seed = new SeedService(
        new TrackRepository(dataSource.getRepository(TrackEntity)),
        new ModuleRepository(dataSource.getRepository(ModuleEntity)),
        new PhaseRepository(dataSource.getRepository(PhaseEntity)),
        new LessonRepository(dataSource.getRepository(LessonEntity)),
      );
      await seed.run();
      stdout('Sample curriculum is ready.');
      return 0;
    } finally {
      if (dataSource.isInitialized) await dataSource.destroy();
    }
  } catch (error) {
    stderr(safeMessage(error));
    return 1;
  }
}

function safeMessage(error: unknown): string {
  if (error instanceof EnvError) return error.message;
  if (postgresCode(error) === '42P01') {
    return 'The curriculum tables are missing. Run the migrations.';
  }
  return 'The sample curriculum was not loaded. Check DATABASE_URL and run the migrations.';
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  runSeed()
    .then((code) => {
      process.exit(code);
    })
    .catch(() => {
      process.stderr.write('The sample curriculum was not loaded.\n');
      process.exit(1);
    });
}
