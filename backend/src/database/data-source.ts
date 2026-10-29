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
import { SiteImageEntity } from '../modules/site-images/site-image.entity.js';
import { WorkPhotoEntity } from '../modules/work-photos/work-photo.entity.js';
import { ProjectEntity } from '../modules/projects/project.entity.js';
import { TraineeEntity } from '../modules/trainees/trainee.entity.js';
import { UserEntity } from '../modules/users/user.entity.js';
import { connectionUrlForDriver, sslConfigForDriver } from './ssl.js';
import { Accounts1793404800000 } from './migrations/1793404800000-Accounts.js';
import { CatalogueLinks1793664000000 } from './migrations/1793664000000-CatalogueLinks.js';
import { WorkPhotos1793750400000 } from './migrations/1793750400000-WorkPhotos.js';
import { SiteImages1794009600000 } from './migrations/1794009600000-SiteImages.js';
import { AuditActionPattern1794096000000 } from './migrations/1794096000000-AuditActionPattern.js';
import { TraineeAuth1794182400000 } from './migrations/1794182400000-TraineeAuth.js';
import { TraineeProfile1794268800000 } from './migrations/1794268800000-TraineeProfile.js';
import { TraineePortfolio1794355200000 } from './migrations/1794355200000-TraineePortfolio.js';
import { PortfolioItemEntity } from '../modules/portfolio/portfolio-item.entity.js';
import { PortfolioMediaEntity } from '../modules/portfolio/portfolio-media.entity.js';
import { PortfolioVideoGrantEntity } from '../modules/portfolio/portfolio-grant.entity.js';
import { TraineeConsentEntity } from '../modules/trainees/trainee-consent.entity.js';
import { PendingRegistrationEntity } from '../modules/trainee-auth/pending-registration.entity.js';
import { TraineePhoto1793836800000 } from './migrations/1793836800000-TraineePhoto.js';
import { RolesAndOptionalLinks1793577600000 } from './migrations/1793577600000-RolesAndOptionalLinks.js';
import { Auth1792868400000 } from './migrations/1792868400000-Auth.js';
import { Baseline1792800000000 } from './migrations/1792800000000-Baseline.js';
import { Curriculum1792886400000 } from './migrations/1792886400000-Curriculum.js';
import { Content1793318400000 } from './migrations/1793318400000-Content.js';
import { Events1793145600000 } from './migrations/1793145600000-Events.js';
import { Gallery1793232000000 } from './migrations/1793232000000-Gallery.js';
import { Projects1793059200000 } from './migrations/1793059200000-Projects.js';
import { Trainees1792972800000 } from './migrations/1792972800000-Trainees.js';
import { Timetable1793923200000 } from './migrations/1793923200000-Timetable.js';
import {
  BlockEntity,
  DeliverableEntity,
  ProgrammeEntity,
  SessionEntity as ClassSessionEntity,
  SessionTrainerEntity,
  TrainerEntity,
  WeekEntity,
  WeekTrainerEntity,
} from '../modules/timetable/timetable.entity.js';

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
      TraineeConsentEntity,
      PortfolioItemEntity,
      PortfolioMediaEntity,
      PortfolioVideoGrantEntity,
      ProjectEntity,
      EventEntity,
      MediaEntity,
      WorkPhotoEntity,
      SiteImageEntity,
      ContentSingletonEntity,
      AccessTokenEntity,
      PendingRegistrationEntity,
      EnquiryEntity,
      ProgrammeEntity,
      BlockEntity,
      WeekEntity,
      DeliverableEntity,
      TrainerEntity,
      WeekTrainerEntity,
      ClassSessionEntity,
      SessionTrainerEntity,
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
      RolesAndOptionalLinks1793577600000,
      CatalogueLinks1793664000000,
      WorkPhotos1793750400000,
      TraineePhoto1793836800000,
      Timetable1793923200000,
      SiteImages1794009600000,
      AuditActionPattern1794096000000,
      TraineeAuth1794182400000,
      TraineeProfile1794268800000,
      TraineePortfolio1794355200000,
    ],
    migrationsTableName: 'schema_migrations',
    ssl: sslConfigForDriver(env.databaseSsl, env.databaseSslCa),
  });
}
