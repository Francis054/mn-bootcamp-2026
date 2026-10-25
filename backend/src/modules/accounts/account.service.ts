import { ApiError } from '../../shared/errors/api-error.js';
import { UserFacingError } from '../../shared/errors/user-facing-error.js';
import type { AccessTokenEntity } from '../auth/access-token.entity.js';
import type { AccessTokenRepository } from '../auth/access-token.repository.js';
import type { AuditRepository } from '../auth/audit.repository.js';
import { TOO_MANY_REQUESTS } from '../auth/login-throttle.js';
import type { LoginThrottleRepository } from '../auth/login-throttle.repository.js';
import type { Argon2Hasher } from '../auth/password-hasher.js';
import type { SessionService } from '../auth/session.service.js';
import { newSecretToken, sessionTokenHash } from '../auth/tokens.js';
import type { EmailProvider } from '../mail/email-provider.js';
import type { PublicUser } from '../users/public-user.js';
import { isRole, type Role } from '../users/role.js';
import { toPublicUser, type UserService } from '../users/user.service.js';
import type { UserRepository } from '../users/user.repository.js';
import {
  changePasswordProblems,
  emailProblem,
  INVITE_TTL_MS,
  inviteProblems,
  mailboxDigest,
  newPasswordProblems,
  PASSWORD_CHANGED,
  PASSWORD_SAVED,
  RESET_ACCEPTED,
  RESET_LINK_PROBLEM,
  RESET_TTL_MS,
  unusablePassword,
} from './account.rules.js';

const CHECK = 'Check the highlighted fields.';

export interface LimitSettings {
  failureLimit: number;
  ipFailureLimit: number;
  lockMs: number;
}

/**
 * Password change, reset, invitations, and role changes.
 * Reset responses do not say whether the mailbox exists.
 */
export class AccountService {
  constructor(
    private readonly users: UserService,
    private readonly userRows: UserRepository,
    private readonly sessions: SessionService,
    private readonly tokens: AccessTokenRepository,
    private readonly throttles: LoginThrottleRepository,
    private readonly audits: AuditRepository,
    private readonly hasher: Argon2Hasher,
    private readonly mail: EmailProvider,
    private readonly secret: string | undefined,
    private readonly frontendUrl: string,
    private readonly limits: LimitSettings,
  ) {}

  async requestReset(input: {
    email: string;
    ip: string;
    requestId: string;
    now: Date;
  }): Promise<typeof RESET_ACCEPTED> {
    const problem = emailProblem(input.email);
    if (problem) throw new ApiError('validation', CHECK, { email: problem });
    const email = input.email.trim().toLowerCase();
    const ip = clip(input.ip, 64);
    await this.assertResetOpen(email, ip, input.now);
    const user = await this.users.findByEmail(email);
    if (user) {
      await this.issueToken(user.id, 'reset', user.email, RESET_TTL_MS, input.now, (link) => ({
        subject: 'Reset your Maxim Nyansa password',
        text: `Use this link to choose a new password. It expires in 15 minutes.\n\n${link}\n`,
      }));
    }
    await this.audits.record({
      action: 'auth.password.reset.requested',
      actorUserId: user?.id ?? null,
      ip,
      requestId: clip(input.requestId, 80),
      subjectType: 'user',
      subjectId: user?.id ?? null,
    });
    return { ...RESET_ACCEPTED };
  }

  async completeReset(input: {
    token: string;
    password: string;
    confirm: string;
    ip: string;
    requestId: string;
    now: Date;
  }): Promise<typeof PASSWORD_SAVED> {
    const found = await this.findLiveToken(input.token.trim(), input.now);
    const user = found ? await this.users.findById(found.userId) : null;
    const problems = newPasswordProblems(input.password, input.confirm, user?.email ?? '');
    if (!found || !user) problems.token = RESET_LINK_PROBLEM;
    if (Object.keys(problems).length > 0) throw new ApiError('validation', CHECK, problems);
    if (!found || !user) throw new ApiError('validation', CHECK, { token: RESET_LINK_PROBLEM });

    await this.userRows.updatePassword(user.id, await this.hasher.hash(input.password));
    await this.tokens.deleteById(found.id);
    await this.sessions.revokeOthers(user.id, null);
    await this.audits.record({
      action: 'auth.password.reset.completed',
      actorUserId: user.id,
      ip: clip(input.ip, 64),
      requestId: clip(input.requestId, 80),
      subjectType: 'user',
      subjectId: user.id,
    });
    return { ...PASSWORD_SAVED };
  }

  async changePassword(input: {
    userId: string;
    sessionId: string;
    current: string;
    next: string;
    confirm: string;
    ip: string;
    requestId: string;
  }): Promise<typeof PASSWORD_CHANGED> {
    const user = await this.users.findById(input.userId);
    if (!user) throw new ApiError('unauthenticated', 'Sign in to continue.');
    const problems = changePasswordProblems({
      current: input.current,
      next: input.next,
      confirm: input.confirm,
      email: user.email,
    });
    if (input.current.length > 0) {
      const matches = await this.hasher.verify(user.passwordHash, input.current);
      if (!matches) problems.current = 'The current password is not correct.';
    }
    if (Object.keys(problems).length > 0) throw new ApiError('validation', CHECK, problems);

    await this.userRows.updatePassword(user.id, await this.hasher.hash(input.next));
    await this.sessions.revokeOthers(user.id, input.sessionId);
    await this.audits.record({
      action: 'auth.password.changed',
      actorUserId: user.id,
      ip: clip(input.ip, 64),
      requestId: clip(input.requestId, 80),
      subjectType: 'user',
      subjectId: user.id,
    });
    return { ...PASSWORD_CHANGED };
  }

  async listUsers(): Promise<PublicUser[]> {
    const rows = await this.userRows.list();
    return rows.map((row) => toPublicUser(row));
  }

  async updateRole(input: {
    actorId: string;
    userId: string;
    role: string;
    ip: string;
    requestId: string;
  }): Promise<PublicUser> {
    if (!isRole(input.role)) {
      throw new ApiError('validation', CHECK, {
        role: 'Choose viewer, editor, trainer, trainee, or administrator.',
      });
    }
    if (input.actorId === input.userId && input.role !== 'administrator') {
      throw new ApiError(
        'validation',
        'You cannot remove your own administrator access from this session.',
        { role: 'Ask another administrator to change your role.' },
      );
    }
    if (!isUuid(input.userId)) throw new ApiError('not_found', 'User not found.');
    const user = await this.users.findById(input.userId);
    if (!user) throw new ApiError('not_found', 'User not found.');
    await this.userRows.updateRole(user.id, input.role);
    const next = await this.users.findById(user.id);
    if (!next) throw new ApiError('not_found', 'User not found.');
    await this.audits.record({
      action: 'auth.user.role.updated',
      actorUserId: input.actorId,
      ip: clip(input.ip, 64),
      requestId: clip(input.requestId, 80),
      subjectType: 'user',
      subjectId: user.id,
    });
    return toPublicUser(next);
  }

  async invite(input: {
    email: string;
    role: string;
    actorId: string;
    ip: string;
    requestId: string;
    now: Date;
  }): Promise<{ delivered: boolean; message: string }> {
    const problems = inviteProblems(input.email, input.role);
    if (Object.keys(problems).length > 0) throw new ApiError('validation', CHECK, problems);
    if (!isRole(input.role)) {
      throw new ApiError('validation', CHECK, {
        role: 'Choose viewer, editor, trainer, trainee, or administrator.',
      });
    }
    const email = input.email.trim().toLowerCase();
    const role: Role = input.role;
    const existing = await this.users.findByEmail(email);
    if (existing) throw alreadyExists();
    const created = await this.createInvitedUser(email, role);
    const delivered = await this.issueToken(
      created.id,
      'invite',
      email,
      INVITE_TTL_MS,
      input.now,
      (link) => ({
        subject: 'Invitation to the Maxim Nyansa admin',
        text: `Choose a password with this link. It expires in 24 hours.\n\n${link}\n`,
      }),
    );
    await this.audits.record({
      action: 'auth.user.invited',
      actorUserId: input.actorId,
      ip: clip(input.ip, 64),
      requestId: clip(input.requestId, 80),
      subjectType: 'user',
      subjectId: created.id,
    });
    if (delivered) return { delivered: true, message: 'The invitation was sent.' };
    return { delivered: false, message: 'The account is ready. No invitation email was sent.' };
  }

  private async createInvitedUser(email: string, role: Role): Promise<PublicUser> {
    try {
      return await this.users.createUser({ email, password: unusablePassword(), role });
    } catch (error) {
      if (
        error instanceof UserFacingError &&
        error.message === 'An account with that mailbox already exists.'
      ) {
        throw alreadyExists();
      }
      throw error;
    }
  }

  private async assertResetOpen(email: string, ip: string, now: Date): Promise<void> {
    const emailKey = `reset:${mailboxDigest(email)}`;
    const ipKey = `reset-ip:${ip}`;
    const locked =
      (await this.throttles.isLocked(emailKey, now)) || (await this.throttles.isLocked(ipKey, now));
    if (locked) throw new ApiError('rate_limited', TOO_MANY_REQUESTS);
    const emailState = await this.throttles.recordFailure(
      emailKey,
      now,
      this.limits.failureLimit,
      this.limits.lockMs,
    );
    const ipState = await this.throttles.recordFailure(
      ipKey,
      now,
      this.limits.ipFailureLimit,
      this.limits.lockMs,
    );
    if (emailState === 'locked' || ipState === 'locked') {
      throw new ApiError('rate_limited', TOO_MANY_REQUESTS);
    }
  }

  private async issueToken(
    userId: string,
    purpose: 'reset' | 'invite',
    to: string,
    ttlMs: number,
    now: Date,
    compose: (link: string) => { subject: string; text: string },
  ): Promise<boolean> {
    const secret = this.secret;
    if (!secret) return false;
    if (purpose === 'reset') await this.tokens.deleteForUser(userId, 'reset');
    const raw = newSecretToken();
    await this.tokens.insert({
      tokenHash: sessionTokenHash(raw, secret),
      purpose,
      userId,
      expiresAt: new Date(now.getTime() + ttlMs),
    });
    const link = `${this.frontendUrl}/admin/reset-password?token=${encodeURIComponent(raw)}`;
    const letter = compose(link);
    try {
      const result = await this.mail.send({ to, subject: letter.subject, text: letter.text });
      return result.delivered;
    } catch {
      return false;
    }
  }

  private async findLiveToken(token: string, now: Date): Promise<AccessTokenEntity | null> {
    if (!this.secret || token.length === 0) return null;
    const row = await this.tokens.findByHash(sessionTokenHash(token, this.secret));
    if (!row) return null;
    if (row.expiresAt.getTime() <= now.getTime()) {
      await this.tokens.deleteById(row.id);
      return null;
    }
    return row;
  }
}

function alreadyExists(): ApiError {
  const message = 'An account with that mailbox already exists.';
  return new ApiError('validation', message, { email: message });
}

function clip(value: string, max: number): string {
  return value.slice(0, max);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID.test(value);
}
