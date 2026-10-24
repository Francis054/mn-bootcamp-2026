import type { AppEnv } from '../config/env.js';
import { createDataSource } from '../database/data-source.js';
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
import { ProjectEntity } from '../modules/projects/project.entity.js';
import { liveRepositoryVisibility } from '../modules/projects/project-url.js';
import { ProjectRepository } from '../modules/projects/project.repository.js';
import { ProjectService } from '../modules/projects/project.service.js';
import { TraineeEntity } from '../modules/trainees/trainee.entity.js';
import { TraineeRepository } from '../modules/trainees/trainee.repository.js';
import { TraineeService } from '../modules/trainees/trainee.service.js';
import { UserEntity } from '../modules/users/user.entity.js';
import { UserRepository } from '../modules/users/user.repository.js';
import { UserService } from '../modules/users/user.service.js';
import { HealthService } from '../modules/health/health.service.js';
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
  ) {
    this.health = new HealthService(dataSource, logger);
    this.users = users;
    this.sessions = sessions;
    this.authRouter = authRouter(auth, sessions);
    this.curriculumRouter = curriculumRouter(catalogue, lessons, trainees, projects, sessions);
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
    const auth = new AuthService(
      users,
      sessions,
      new LoginThrottleRepository(dataSource),
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
    const traineeRepository = new TraineeRepository(dataSource.getRepository(TraineeEntity));
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
    const traineeService = new TraineeService(
      traineeRepository,
      moduleRepository,
      projectRepository,
      audit,
    );
    const projectService = new ProjectService(
      projectRepository,
      moduleRepository,
      traineeRepository,
      audit,
      liveRepositoryVisibility(),
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
    );
  }

  async close(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }
}
