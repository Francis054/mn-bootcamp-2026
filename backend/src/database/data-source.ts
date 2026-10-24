import { DataSource } from 'typeorm';
import type { AppEnv } from '../config/env.js';
import { AuditEventEntity } from '../modules/auth/audit-event.entity.js';
import { LoginThrottleEntity } from '../modules/auth/login-throttle.entity.js';
import { SessionEntity } from '../modules/auth/session.entity.js';
import { LessonEntity } from '../modules/curriculum/lesson.entity.js';
import { ModuleEntity } from '../modules/curriculum/module.entity.js';
import { PhaseEntity } from '../modules/curriculum/phase.entity.js';
import { TrackEntity } from '../modules/curriculum/track.entity.js';
import { UserEntity } from '../modules/users/user.entity.js';
import { Auth1792868400000 } from './migrations/1792868400000-Auth.js';
import { Baseline1792800000000 } from './migrations/1792800000000-Baseline.js';
import { Curriculum1792886400000 } from './migrations/1792886400000-Curriculum.js';

/**
 * `synchronize` stays false. Schema changes are migration files, reviewed like
 * any other change. Add each new migration class to this list.
 */
export function createDataSource(
  env: Pick<AppEnv, 'databaseUrl' | 'databaseSsl' | 'nodeEnv'>,
): DataSource {
  return new DataSource({
    type: 'postgres',
    url: env.databaseUrl,
    synchronize: false,
    logging: env.nodeEnv === 'development' ? ['error'] : false,
    entities: [
      UserEntity,
      SessionEntity,
      LoginThrottleEntity,
      AuditEventEntity,
      TrackEntity,
      ModuleEntity,
      PhaseEntity,
      LessonEntity,
    ],
    migrations: [Baseline1792800000000, Auth1792868400000, Curriculum1792886400000],
    migrationsTableName: 'schema_migrations',
    ssl: env.databaseSsl ? { rejectUnauthorized: true } : false,
  });
}
