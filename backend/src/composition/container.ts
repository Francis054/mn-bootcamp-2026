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

  constructor(
    readonly env: AppEnv,
    readonly logger: AppLogger,
    readonly dataSource: DataSource,
    users: UserService,
    sessions: SessionService,
    auth: AuthService,
  ) {
    this.health = new HealthService(dataSource, logger);
    this.users = users;
    this.sessions = sessions;
    this.authRouter = authRouter(auth, sessions);
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
    const auth = new AuthService(
      users,
      sessions,
      new LoginThrottleRepository(dataSource),
      new AuditRepository(dataSource.getRepository(AuditEventEntity)),
      hasher,
      logger,
      {
        failureLimit: env.loginFailureLimit,
        ipFailureLimit: env.loginIpFailureLimit,
        lockMs: env.loginLockMs,
      },
      env.sessionSecret,
    );
    return new AppContainer(env, logger, dataSource, users, sessions, auth);
  }

  async close(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }
}
