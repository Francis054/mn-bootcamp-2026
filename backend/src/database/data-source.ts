import { DataSource } from 'typeorm';
import type { AppEnv } from '../config/env.js';
import { AccessTokenEntity } from '../modules/auth/access-token.entity.js';
import { AuditEventEntity } from '../modules/auth/audit-event.entity.js';
import { LoginThrottleEntity } from '../modules/auth/login-throttle.entity.js';
import { SessionEntity } from '../modules/auth/session.entity.js';
import { EnquiryEntity } from '../modules/enquiries/enquiry.entity.js';
import { LessonEntity } from '../modules/curriculum/lesson.entity.js';
import { ModuleEntity } from '../modules/curriculum/module.entity.js';
import { PhaseEntity } from '../modules/curriculum/phase.entity.js';
import { TrackEntity } from '../modules/curriculum/track.entity.js';
import { ContentSingletonEntity } from '../modules/content/content.entity.js';
import { EventEntity } from '../modules/events/event.entity.js';
import { MediaEntity } from '../modules/gallery/media.entity.js';
import { ProjectEntity } from '../modules/projects/project.entity.js';
import { TraineeEntity } from '../modules/trainees/trainee.entity.js';
import { UserEntity } from '../modules/users/user.entity.js';
import { connectionUrlForDriver, sslConfigForDriver } from './ssl.js';
import { Accounts1793404800000 } from './migrations/1793404800000-Accounts.js';
import { Auth1792868400000 } from './migrations/1792868400000-Auth.js';
import { Baseline1792800000000 } from './migrations/1792800000000-Baseline.js';
import { Curriculum1792886400000 } from './migrations/1792886400000-Curriculum.js';
import { Content1793318400000 } from './migrations/1793318400000-Content.js';
import { Events1793145600000 } from './migrations/1793145600000-Events.js';
import { Gallery1793232000000 } from './migrations/1793232000000-Gallery.js';
import { Projects1793059200000 } from './migrations/1793059200000-Projects.js';
import { Trainees1792972800000 } from './migrations/1792972800000-Trainees.js';

/**
 * `synchronize` stays false. Schema changes are migration files, reviewed like
 * any other change. Add each new migration class to this list.
 */
export function createDataSource(
  env: Pick<AppEnv, 'databaseUrl' | 'databaseSsl' | 'databaseSslCa' | 'nodeEnv'>,
): DataSource {
  return new DataSource({
    type: 'postgres',
    url: connectionUrlForDriver(env.databaseUrl),
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
      TraineeEntity,
      ProjectEntity,
      EventEntity,
      MediaEntity,
      ContentSingletonEntity,
      AccessTokenEntity,
      EnquiryEntity,
    ],
    migrations: [
      Baseline1792800000000,
      Auth1792868400000,
      Curriculum1792886400000,
      Trainees1792972800000,
      Projects1793059200000,
      Events1793145600000,
      Gallery1793232000000,
      Content1793318400000,
      Accounts1793404800000,
    ],
    migrationsTableName: 'schema_migrations',
    ssl: sslConfigForDriver(env.databaseSsl, env.databaseSslCa),
  });
}
