import type { AppEnv } from '../config/env.js';
import { createDataSource } from '../database/data-source.js';
import { AccountService } from '../modules/accounts/account.service.js';
import { AccessTokenEntity } from '../modules/auth/access-token.entity.js';
import { AccessTokenRepository } from '../modules/auth/access-token.repository.js';
import { AuditRepository } from '../modules/auth/audit.repository.js';
import { AuditEventEntity } from '../modules/auth/audit-event.entity.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { LoginThrottleRepository } from '../modules/auth/login-throttle.repository.js';
import { Argon2Hasher } from '../modules/auth/password-hasher.js';
import { SessionEntity } from '../modules/auth/session.entity.js';
import { SessionRepository } from '../modules/auth/session.repository.js';
import { SessionService } from '../modules/auth/session.service.js';
import { CatalogueService } from '../modules/curriculum/catalogue.service.js';
import { curriculumRouter } from '../modules/curriculum/curriculum.routes.js';
import { LessonEntity } from '../modules/curriculum/lesson.entity.js';
import { LessonService } from '../modules/curriculum/lesson.service.js';
import { ModuleEntity } from '../modules/curriculum/module.entity.js';
import { PhaseEntity } from '../modules/curriculum/phase.entity.js';
import {
  LessonRepository,
  ModuleRepository,
  PhaseRepository,
  TrackRepository,
} from '../modules/curriculum/repositories.js';
import { accraToday } from '../modules/curriculum/schedule.js';
import { TrackEntity } from '../modules/curriculum/track.entity.js';
import { ContentSingletonEntity } from '../modules/content/content.entity.js';
import { ContentRepository } from '../modules/content/content.repository.js';
import { ContentService } from '../modules/content/content.service.js';
import { EnquiryEntity } from '../modules/enquiries/enquiry.entity.js';
import { EnquiryRepository } from '../modules/enquiries/enquiry.repository.js';
import { EnquiryService } from '../modules/enquiries/enquiry.service.js';
import { EventEntity } from '../modules/events/event.entity.js';
import { EventRepository } from '../modules/events/event.repository.js';
import { EventService } from '../modules/events/event.service.js';
import { MediaEntity } from '../modules/gallery/media.entity.js';
import { MediaRepository } from '../modules/gallery/media.repository.js';
import { MediaService } from '../modules/gallery/media.service.js';
import { SiteImageEntity } from '../modules/site-images/site-image.entity.js';
import { SiteImageRepository } from '../modules/site-images/site-image.repository.js';
import { SiteImageService } from '../modules/site-images/site-image.service.js';
import { WorkPhotoEntity } from '../modules/work-photos/work-photo.entity.js';
import { WorkPhotoRepository } from '../modules/work-photos/work-photo.repository.js';
import { WorkPhotoService } from '../modules/work-photos/work-photo.service.js';
import { createMail } from '../modules/mail/create-mail.js';
import type { EmailProvider } from '../modules/mail/email-provider.js';
import { ObservedMail } from '../modules/mail/observed-mail.js';
import { PendingRegistrationEntity } from '../modules/trainee-auth/pending-registration.entity.js';
import { PendingRegistrationRepository } from '../modules/trainee-auth/pending-registration.repository.js';
import { SignupService } from '../modules/trainee-auth/signup.service.js';
import { createStorage } from '../modules/storage/create-storage.js';
import type { StorageProvider } from '../modules/storage/storage-provider.js';
import { ProjectEntity } from '../modules/projects/project.entity.js';
import { liveRepositoryVisibility } from '../modules/projects/project-url.js';
import { ProjectRepository } from '../modules/projects/project.repository.js';
import { ProjectService } from '../modules/projects/project.service.js';
import { TraineeEntity } from '../modules/trainees/trainee.entity.js';
import { TraineeConsentEntity } from '../modules/trainees/trainee-consent.entity.js';
import { TraineeConsentRepository } from '../modules/trainees/trainee-consent.repository.js';
import { PortalProfileService } from '../modules/trainees/portal-profile.service.js';
import { TraineeRepository } from '../modules/trainees/trainee.repository.js';
import { TraineeService } from '../modules/trainees/trainee.service.js';
import { UserEntity } from '../modules/users/user.entity.js';
import { UserRepository } from '../modules/users/user.repository.js';
import { UserService } from '../modules/users/user.service.js';
import { HealthService } from '../modules/health/health.service.js';
import { TimetableRepository } from '../modules/timetable/timetable.repository.js';
import { TimetableService } from '../modules/timetable/timetable.service.js';
import { createLogger, type AppLogger } from '../shared/logging/logger.js';
import type { Router } from 'express';
import type { DataSource } from 'typeorm';

/**
 * Composition root. This is the only place that wires the database to
 * services. A service does not construct its own repository.
 */
export class AppContainer {
  readonly health: HealthService;
  readonly users: UserService;
  readonly sessions: SessionService;
  readonly authRouter: Router;
  readonly curriculumRouter: Router;
  readonly storage: StorageProvider;
  readonly mail: EmailProvider;

  constructor(
    readonly env: AppEnv,
    readonly logger: AppLogger,
    readonly dataSource: DataSource,
    users: UserService,
    sessions: SessionService,
    auth: AuthService,
    catalogue: CatalogueService,
    lessons: LessonService,
    trainees: TraineeService,
    projects: ProjectService,
    events: EventService,
    media: MediaService,
    workPhotos: WorkPhotoService,
    siteImages: SiteImageService,
    storage: StorageProvider,
    content: ContentService,
    mail: EmailProvider,
    accounts: AccountService,
    enquiries: EnquiryService,
    timetable: TimetableService,
    signup: SignupService,
    profiles: PortalProfileService,
  ) {
    this.health = new HealthService(dataSource, logger);
    this.users = users;
    this.sessions = sessions;
    this.storage = storage;
    this.mail = mail;
    this.authRouter = authRouter(auth, sessions, accounts);
    this.curriculumRouter = curriculumRouter(
      catalogue,
      lessons,
      trainees,
      projects,
      events,
      media,
      env.uploadMaxBytes,
      content,
      sessions,
      accounts,
      enquiries,
      workPhotos,
      siteImages,
      storage,
      timetable,
      signup,
      profiles,
    );
  }

  static async create(env: AppEnv): Promise<AppContainer> {
    const logger = createLogger(env);
    const dataSource = createDataSource(env);
    await dataSource.initialize();
    const hasher = new Argon2Hasher();
    await hasher.warm();
    const userRepository = new UserRepository(dataSource.getRepository(UserEntity));
    const users = new UserService(userRepository, hasher);
    const sessions = new SessionService(
      new SessionRepository(dataSource.getRepository(SessionEntity)),
      userRepository,
      env.sessionSecret,
      env.sessionIdleTtlMs,
      env.sessionAbsoluteTtlMs,
    );
    const audit = new AuditRepository(dataSource.getRepository(AuditEventEntity));
    const throttles = new LoginThrottleRepository(dataSource);
    const mail = createMail(env);
    const outbound = new ObservedMail(mail, logger, env.devMailLog && env.nodeEnv !== 'production');
    const contentRepository = new ContentRepository(
      dataSource.getRepository(ContentSingletonEntity),
    );
    const traineeRepository = new TraineeRepository(dataSource.getRepository(TraineeEntity));
    const accounts = new AccountService(
      users,
      userRepository,
      sessions,
      new AccessTokenRepository(dataSource.getRepository(AccessTokenEntity)),
      throttles,
      audit,
      hasher,
      outbound,
      env.sessionSecret,
      env.frontendUrl,
      {
        failureLimit: env.loginFailureLimit,
        ipFailureLimit: env.loginIpFailureLimit,
        lockMs: env.loginLockMs,
      },
      traineeRepository,
      logger,
    );
    const enquiries = new EnquiryService(
      new EnquiryRepository(dataSource.getRepository(EnquiryEntity)),
      contentRepository,
      outbound,
      throttles,
      audit,
      { failureLimit: env.loginFailureLimit, lockMs: env.loginLockMs },
    );
    const auth = new AuthService(
      users,
      sessions,
      throttles,
      audit,
      hasher,
      logger,
      {
        failureLimit: env.loginFailureLimit,
        ipFailureLimit: env.loginIpFailureLimit,
        lockMs: env.loginLockMs,
      },
      env.sessionSecret,
    );
    const trackRepository = new TrackRepository(dataSource.getRepository(TrackEntity));
    const moduleRepository = new ModuleRepository(dataSource.getRepository(ModuleEntity));
    const phaseRepository = new PhaseRepository(dataSource.getRepository(PhaseEntity));
    const lessonRepository = new LessonRepository(dataSource.getRepository(LessonEntity));
    const projectRepository = new ProjectRepository(dataSource.getRepository(ProjectEntity));
    const catalogue = new CatalogueService(
      trackRepository,
      moduleRepository,
      phaseRepository,
      lessonRepository,
      traineeRepository,
      projectRepository,
      audit,
    );
    const lessonService = new LessonService(
      lessonRepository,
      moduleRepository,
      phaseRepository,
      audit,
      accraToday,
    );
    const storage = createStorage(env);
    const consentRepository = new TraineeConsentRepository(
      dataSource.getRepository(TraineeConsentEntity),
    );
    const traineeService = new TraineeService(
      traineeRepository,
      moduleRepository,
      lessonRepository,
      projectRepository,
      audit,
      storage,
      env.uploadMaxBytes,
      consentRepository,
    );
    const projectService = new ProjectService(
      projectRepository,
      moduleRepository,
      traineeRepository,
      lessonRepository,
      audit,
      liveRepositoryVisibility(),
    );
    const mediaRepository = new MediaRepository(dataSource.getRepository(MediaEntity));
    const eventService = new EventService(
      new EventRepository(dataSource.getRepository(EventEntity)),
      lessonRepository,
      projectRepository,
      mediaRepository,
      audit,
      () => new Date(),
    );
    const contentService = new ContentService(contentRepository, audit);
    const mediaService = new MediaService(
      mediaRepository,
      audit,
      storage,
      env.uploadMaxBytes,
      () => new Date(),
    );
    const workPhotoService = new WorkPhotoService(
      new WorkPhotoRepository(dataSource.getRepository(WorkPhotoEntity)),
      traineeRepository,
      projectRepository,
      audit,
      storage,
      env.uploadMaxBytes,
    );
    const siteImageService = new SiteImageService(
      new SiteImageRepository(dataSource.getRepository(SiteImageEntity)),
      audit,
      storage,
      env.uploadMaxBytes,
    );
    const timetable = new TimetableService(new TimetableRepository(dataSource), audit);
    const signup = new SignupService(
      users,
      userRepository,
      traineeRepository,
      traineeService,
      moduleRepository,
      new PendingRegistrationRepository(dataSource.getRepository(PendingRegistrationEntity)),
      new AccessTokenRepository(dataSource.getRepository(AccessTokenEntity)),
      throttles,
      audit,
      hasher,
      accounts,
      env.sessionSecret,
      logger,
    );
    const profiles = new PortalProfileService(
      traineeRepository,
      userRepository,
      consentRepository,
      audit,
      storage,
      env.uploadMaxBytes,
    );
    return new AppContainer(
      env,
      logger,
      dataSource,
      users,
      sessions,
      auth,
      catalogue,
      lessonService,
      traineeService,
      projectService,
      eventService,
      mediaService,
      workPhotoService,
      siteImageService,
      storage,
      contentService,
      mail,
      accounts,
      enquiries,
      timetable,
      signup,
      profiles,
    );
  }

  async close(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }
}
