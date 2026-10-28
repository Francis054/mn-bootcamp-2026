import { ApiError } from '../../shared/errors/api-error.js';
import { EMAIL_NOT_VERIFIED } from '../trainee-auth/signup.rules.js';
import type { AppLogger } from '../../shared/logging/logger.js';
import type { PublicUser } from '../users/public-user.js';
import { toPublicUser, type UserService } from '../users/user.service.js';
import type { AuditRepository } from './audit.repository.js';
import type { LoginThrottleRepository } from './login-throttle.repository.js';
import type { Argon2Hasher } from './password-hasher.js';
import type { SessionService } from './session.service.js';
import { newSecretToken } from './tokens.js';

export const BAD_LOGIN = 'The email or password is not correct.';
export const LOCKED_LOGIN = 'Too many sign-in attempts. Wait a minute and try again.';

export interface LoginSuccess {
  user: PublicUser;
  expiresAt: string;
  sessionToken: string;
  csrfToken: string;
}

export interface LoginAttempt {
  email: string;
  password: string;
  ip: string;
  requestId: string;
  now: Date;
}

export class AuthService {
  constructor(
    private readonly users: UserService,
    private readonly sessions: SessionService,
    private readonly throttles: LoginThrottleRepository,
    private readonly audits: AuditRepository,
    private readonly hasher: Argon2Hasher,
    private readonly logger: AppLogger,
    private readonly limits: { failureLimit: number; ipFailureLimit: number; lockMs: number },
    private readonly sessionSecret: string | undefined,
  ) {}

  async login(attempt: LoginAttempt): Promise<LoginSuccess> {
    if (!this.sessionSecret) {
      throw new ApiError('server', 'Sign-in is not configured.');
    }
    const ip = attempt.ip.slice(0, 64);
    const emailKey = `email:${attempt.email}`;
    const ipKey = `ip:${ip}`;
    const user = await this.users.findByEmail(attempt.email);
    const locked =
      (await this.throttles.isLocked(emailKey, attempt.now)) ||
      (await this.throttles.isLocked(ipKey, attempt.now));
    if (locked) {
      await this.recordFailure(user?.id ?? null, ip, attempt.requestId);
      throw new ApiError('rate_limited', LOCKED_LOGIN);
    }

    const passwordOk = await this.hasher.verify(user?.passwordHash, attempt.password);
    if (!user || !passwordOk) {
      const emailState = await this.throttles.recordFailure(
        emailKey,
        attempt.now,
        this.limits.failureLimit,
        this.limits.lockMs,
      );
      const ipState = await this.throttles.recordFailure(
        ipKey,
        attempt.now,
        this.limits.ipFailureLimit,
        this.limits.lockMs,
      );
      await this.recordFailure(user?.id ?? null, ip, attempt.requestId);
      if (emailState === 'locked' || ipState === 'locked') {
        throw new ApiError('rate_limited', LOCKED_LOGIN);
      }
      throw new ApiError('unauthenticated', BAD_LOGIN);
    }

    if (user.disabledAt) {
      await this.recordFailure(user.id, ip, attempt.requestId);
      throw new ApiError('unauthenticated', BAD_LOGIN);
    }

    if (user.role === 'trainee' && !(user.emailVerifiedAt instanceof Date)) {
      await this.recordFailure(user.id, ip, attempt.requestId);
      throw new ApiError('forbidden', EMAIL_NOT_VERIFIED);
    }

    await this.throttles.clear(emailKey);
    await this.users.touchLastLogin(user.id, attempt.now);
    const session = await this.sessions.start(user, attempt.now);
    await this.audits.record({
      action: 'auth.login.succeeded',
      actorUserId: user.id,
      ip,
      requestId: attempt.requestId,
    });
    this.logger.info(
      { requestId: attempt.requestId, action: 'auth.login.succeeded' },
      'Sign-in succeeded',
    );
    return {
      user: toPublicUser(user),
      expiresAt: session.expiresAt.toISOString(),
      sessionToken: session.token,
      csrfToken: newSecretToken(),
    };
  }

  async logout(input: { token: string | undefined; ip: string; requestId: string }): Promise<void> {
    if (!input.token) return;
    const userId = await this.sessions.revoke(input.token);
    if (!userId) return;
    await this.audits.record({
      action: 'auth.logout',
      actorUserId: userId,
      ip: input.ip.slice(0, 64),
      requestId: input.requestId,
    });
    this.logger.info({ requestId: input.requestId, action: 'auth.logout' }, 'Signed out');
  }

  private async recordFailure(
    actorUserId: string | null,
    ip: string,
    requestId: string,
  ): Promise<void> {
    await this.audits.record({
      action: 'auth.login.failed',
      actorUserId,
      ip,
      requestId,
    });
    this.logger.info({ requestId, action: 'auth.login.failed' }, 'Sign-in failed');
  }
}
