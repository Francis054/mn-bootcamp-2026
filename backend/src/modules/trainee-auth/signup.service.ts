import type { DataSource, Repository } from 'typeorm';
import { ApiError } from '../../shared/errors/api-error.js';
import type { AppLogger } from '../../shared/logging/logger.js';
import type { AccountService } from '../accounts/account.service.js';
import { mailboxDigest } from '../accounts/account.rules.js';
import type { AccessTokenRepository } from '../auth/access-token.repository.js';
import type { AuditRepository } from '../auth/audit.repository.js';
import type { LoginThrottleRepository } from '../auth/login-throttle.repository.js';
import type { Argon2Hasher } from '../auth/password-hasher.js';
import { sessionTokenHash } from '../auth/tokens.js';
import { companyField, honeypotFilled } from '../enquiries/enquiry.rules.js';
import type { ModuleRepository } from '../curriculum/repositories.js';
import type { TraineeRepository } from '../trainees/trainee.repository.js';
import type { TraineeService } from '../trainees/trainee.service.js';
import { displayNameFromEmail, hueFromEmail, initialsFrom } from '../users/profile.js';
import { UserEntity } from '../users/user.entity.js';
import type { UserRepository } from '../users/user.repository.js';
import type { UserService } from '../users/user.service.js';
import { PendingRegistrationEntity } from './pending-registration.entity.js';
import type { PendingRegistrationRepository } from './pending-registration.repository.js';
import {
  APPROVED_READY_MESSAGE,
  parseResend,
  parseSignup,
  RESEND_EMAIL_LIMIT,
  RESEND_IP_LIMIT,
  SIGNUP_ACCEPTED,
  SIGNUP_EMAIL_LIMIT,
  SIGNUP_IP_LIMIT,
  SIGNUP_LIMIT,
  SIGNUP_LOCK_MS,
  signupDecision,
  VERIFY_OK,
  VERIFY_PROBLEM,
} from './signup.rules.js';

const CHECK = 'Check the highlighted fields.';

export interface PortalAccount {
  user: {
    id: string;
    email: string;
    displayName: string;
    initials: string;
    hue: number;
    role: 'trainee';
    emailVerified: boolean;
    traineeId: string | null;
  };
  traineeId: string | null;
}

export interface PendingRegistrationRecord {
  id: string;
  email: string;
  displayName: string;
  status: PendingRegistrationEntity['status'];
  createdAt: string;
  reviewedAt: string | null;
}

export interface TraineeAccountRecord {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  traineeId: string | null;
  disabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/**
 * Trainee signup and the administrator queue.
 * A registration waits for approval. The public response does not say whether the mailbox is on the roster.
 * Confirmation email is not queued. A mail failure does not block signup, approval, or sign-in.
 */
export class SignupService {
  constructor(
    private readonly users: UserService,
    private readonly userRows: UserRepository,
    private readonly trainees: TraineeRepository,
    private readonly traineeService: TraineeService,
    private readonly modules: ModuleRepository,
    private readonly pending: PendingRegistrationRepository,
    private readonly tokens: AccessTokenRepository,
    private readonly throttles: LoginThrottleRepository,
    private readonly audits: AuditRepository,
    private readonly hasher: Argon2Hasher,
    private readonly accounts: AccountService,
    private readonly secret: string | undefined,
    private readonly logger: AppLogger,
    private readonly dataSource: DataSource,
  ) {}

  async signup(input: {
    body: unknown;
    ip: string;
    requestId: string;
    now: Date;
  }): Promise<typeof SIGNUP_ACCEPTED> {
    const parsed = parseSignup(input.body);
    if (!parsed.ok) throw new ApiError('validation', CHECK, parsed.problems);
    const ip = clip(input.ip, 64);
    const requestId = clip(input.requestId, 80);
    await this.consume(parsed.fields.email, ip, input.now, 'signup', SIGNUP_EMAIL_LIMIT, SIGNUP_IP_LIMIT);
    if (honeypotFilled(companyField(input.body))) return { ...SIGNUP_ACCEPTED };

    const passwordHash = await this.hasher.hash(parsed.fields.password);
    const trainee = await this.trainees.findByEmail(parsed.fields.email);
    const existing = await this.users.findByEmail(parsed.fields.email);
    const decision = signupDecision(Boolean(trainee), existing ? { role: existing.role, verified: existing.emailVerifiedAt instanceof Date } : null);

    if (decision.kind === 'already-registered' && existing) {
      await settleTraineeMail(
        () => this.accounts.sendExistingAccountNotice(existing.email, existing.role),
        this.logger,
      );
      await this.audit('auth.trainee.signup', null, 'user', existing.id, ip, requestId);
      return { ...SIGNUP_ACCEPTED };
    }

    if (existing && existing.role === 'trainee' && !(existing.emailVerifiedAt instanceof Date)) {
      const displayName = (parsed.fields.displayName || existing.displayName).slice(0, 120);
      await this.userRows.replaceUnverifiedLogin(existing.id, {
        passwordHash,
        displayName,
        initials: initialsFrom(displayName).slice(0, 8),
        hue: hueFromEmail(parsed.fields.email),
        traineeId: existing.traineeId,
      });
    }

    const row = await this.savePending(parsed.fields.email, parsed.fields.displayName, passwordHash);
    await this.audit('auth.trainee.signup', null, 'pending_registration', row.id, ip, requestId);
    return { ...SIGNUP_ACCEPTED };
  }

  async verify(input: { token: string; ip: string; requestId: string; now: Date }): Promise<typeof VERIFY_OK> {
    const found = await this.findLiveVerifyToken(input.token.trim(), input.now);
    if (!found) throw new ApiError('validation', CHECK, { token: VERIFY_PROBLEM });
    const user = await this.users.findById(found.userId);
    if (!user || user.role !== 'trainee') {
      await this.tokens.deleteById(found.id);
      throw new ApiError('validation', CHECK, { token: VERIFY_PROBLEM });
    }
    await this.userRows.markEmailVerified(user.id, input.now);
    if (!user.traineeId) {
      const trainee = await this.trainees.findByEmail(user.email);
      if (trainee) {
        const taken = await this.userRows.findByTraineeId(trainee.id);
        if (!taken || taken.id === user.id) await this.userRows.setTraineeLink(user.id, trainee.id);
      }
    }
    await this.tokens.deleteById(found.id);
    await this.audit('auth.trainee.verified', user.id, 'user', user.id, clip(input.ip, 64), clip(input.requestId, 80));
    return { ...VERIFY_OK };
  }

  async resend(input: { body: unknown; ip: string; requestId: string; now: Date }): Promise<typeof SIGNUP_ACCEPTED> {
    const parsed = parseResend(input.body);
    if (!parsed.ok) throw new ApiError('validation', CHECK, parsed.problems);
    const ip = clip(input.ip, 64);
    await this.consume(parsed.email, ip, input.now, 'verify-resend', RESEND_EMAIL_LIMIT, RESEND_IP_LIMIT);
    return { ...SIGNUP_ACCEPTED };
  }

  async portalMe(userId: string): Promise<PortalAccount> {
    const user = await this.users.findById(userId);
    if (!user || user.role !== 'trainee' || user.disabledAt) {
      throw new ApiError('forbidden', 'You do not have access to that.');
    }
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        initials: user.initials,
        hue: user.hue,
        role: 'trainee',
        emailVerified: user.emailVerifiedAt instanceof Date,
        traineeId: user.traineeId,
      },
      traineeId: user.traineeId,
    };
  }

  async listPending(): Promise<PendingRegistrationRecord[]> {
    const rows = await this.pending.listByStatus('pending');
    return rows.map(toPending);
  }

  async approve(input: {
    id: string;
    actorId: string;
    ip: string;
    requestId: string;
    now: Date;
  }): Promise<{ delivered: boolean; message: string; userId: string; traineeId: string }> {
    const row = await this.requirePending(input.id);
    const traineeId = await this.traineeForApproval(row, input);
    const user = await this.dataSource.transaction(async (manager) => {
      const pendingRepo = manager.getRepository(PendingRegistrationEntity);
      const current = await pendingRepo
        .createQueryBuilder('request')
        .setLock('pessimistic_write')
        .where('request.id = :id', { id: row.id })
        .getOne();
      if (!current || current.status !== 'pending') {
        throw new ApiError('not_found', 'Signup request not found.');
      }
      const saved = await activateTrainee(manager.getRepository(UserEntity), current, traineeId, input.now);
      current.status = 'approved';
      current.reviewedAt = input.now;
      current.reviewedBy = input.actorId;
      await pendingRepo.save(current);
      return saved;
    });
    await this.audit(
      'auth.trainee.approved',
      input.actorId,
      'pending_registration',
      row.id,
      clip(input.ip, 64),
      clip(input.requestId, 80),
    );
    return { delivered: true, message: APPROVED_READY_MESSAGE, userId: user.id, traineeId };
  }

  async reject(input: { id: string; actorId: string; ip: string; requestId: string; now: Date }): Promise<PendingRegistrationRecord> {
    const row = await this.requirePending(input.id);
    row.status = 'rejected';
    row.reviewedAt = input.now;
    row.reviewedBy = input.actorId;
    const saved = await this.pending.save(row);
    await this.audit(
      'auth.trainee.rejected',
      input.actorId,
      'pending_registration',
      row.id,
      clip(input.ip, 64),
      clip(input.requestId, 80),
    );
    await settleTraineeMail(
      () =>
        this.accounts.sendReview({
          to: row.email,
          item: 'signup request',
          title: row.displayName,
          approved: false,
          reason: '',
          path: '/signup',
        }),
      this.logger,
    );
    return toPending(saved);
  }

  async listTraineeAccounts(): Promise<TraineeAccountRecord[]> {
    const rows = await this.userRows.listByRole('trainee');
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      emailVerified: row.emailVerifiedAt instanceof Date,
      traineeId: row.traineeId,
      disabled: row.disabledAt instanceof Date,
      lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async setDisabled(input: {
    userId: string;
    disabled: boolean;
    actorId: string;
    ip: string;
    requestId: string;
    now: Date;
  }): Promise<TraineeAccountRecord> {
    const user = await this.requireTraineeAccount(input.userId);
    await this.userRows.setDisabledAt(user.id, input.disabled ? input.now : null);
    if (input.disabled) await this.accounts.revokeSessions(user.id);
    const next = await this.users.findById(user.id);
    if (!next) throw new ApiError('not_found', 'Trainee account not found.');
    await this.audit(
      input.disabled ? 'auth.user.disabled' : 'auth.user.enabled',
      input.actorId,
      'user',
      user.id,
      clip(input.ip, 64),
      clip(input.requestId, 80),
    );
    const [record] = (await this.listTraineeAccounts()).filter((item) => item.id === user.id);
    if (!record) throw new ApiError('not_found', 'Trainee account not found.');
    return record;
  }

  async resendInvite(input: {
    userId: string;
    actorId: string;
    ip: string;
    requestId: string;
    now: Date;
  }): Promise<{ delivered: boolean; message: string }> {
    const user = await this.requireTraineeAccount(input.userId);
    if (user.disabledAt) {
      throw new ApiError('validation', 'Enable the account before sending another email.');
    }
    if (!(user.emailVerifiedAt instanceof Date)) {
      return {
        delivered: false,
        message: 'Approve the signup first. The trainee can sign in after approval.',
      };
    }
    const delivered = await settleTraineeMail(
      () => this.accounts.sendExistingAccountNotice(user.email, user.role),
      this.logger,
    );
    if (!delivered) {
      this.logger.error({ subject: 'Trainee account email' }, 'Trainee account email was not delivered');
      return { delivered: false, message: 'The email was not sent. Try again once mail is configured.' };
    }
    return { delivered: true, message: 'The email was sent.' };
  }

  private async savePending(email: string, displayName: string, passwordHash: string): Promise<PendingRegistrationEntity> {
    const name = displayName.slice(0, 120);
    const existing = await this.pending.findByEmail(email);
    if (!existing) {
      return this.pending.insert({
        email,
        displayName: name,
        passwordHash,
        status: 'pending',
        reviewedAt: null,
        reviewedBy: null,
      });
    }
    if (existing.status === 'approved') {
      const user = await this.users.findByEmail(email);
      if (user && (user.role !== 'trainee' || user.emailVerifiedAt instanceof Date)) return existing;
    }
    existing.displayName = name;
    existing.passwordHash = passwordHash;
    existing.status = 'pending';
    existing.reviewedAt = null;
    existing.reviewedBy = null;
    return this.pending.save(existing);
  }

  private async traineeForApproval(
    row: PendingRegistrationEntity,
    input: { actorId: string; ip: string; requestId: string },
  ): Promise<string> {
    const existing = await this.trainees.findByEmail(row.email);
    if (existing) return existing.id;
    const modules = await this.modules.findAll();
    const focus = modules[0]?.id;
    if (!focus) {
      throw new ApiError('validation', 'Add a module before approving a trainee who is not on the roster.');
    }
    const displayName = row.displayName.trim() || displayNameFromEmail(row.email);
    const created = await this.traineeService.create(
      {
        displayName,
        email: row.email,
        track: 'Blue team',
        focus,
        skills: [],
        bio: '',
        quote: '',
        consentReceived: false,
        listing: 'hidden',
        publicationStatus: 'draft',
        statusLabel: 'In training',
        internalNotes: 'Created when an administrator approved a signup that was not on the roster.',
      },
      { userId: input.actorId, ip: clip(input.ip, 64), requestId: clip(input.requestId, 80) },
    );
    return created.id;
  }

  private async requirePending(id: string): Promise<PendingRegistrationEntity> {
    if (!isUuid(id)) throw new ApiError('not_found', 'Signup request not found.');
    const row = await this.pending.findById(id);
    if (!row || row.status !== 'pending') throw new ApiError('not_found', 'Signup request not found.');
    return row;
  }

  private async requireTraineeAccount(id: string): Promise<UserEntity> {
    if (!isUuid(id)) throw new ApiError('not_found', 'Trainee account not found.');
    const user = await this.users.findById(id);
    if (!user || user.role !== 'trainee') throw new ApiError('not_found', 'Trainee account not found.');
    return user;
  }

  private async findLiveVerifyToken(token: string, now: Date): Promise<{ id: string; userId: string } | null> {
    if (!this.secret || token.length === 0) return null;
    const row = await this.tokens.findByHash(sessionTokenHash(token, this.secret));
    if (!row || row.purpose !== 'verify_email') return null;
    if (row.expiresAt.getTime() <= now.getTime()) {
      await this.tokens.deleteById(row.id);
      return null;
    }
    return row;
  }

  private async consume(
    email: string,
    ip: string,
    now: Date,
    prefix: string,
    emailLimit: number,
    ipLimit: number,
  ): Promise<void> {
    const emailKey = `${prefix}:${mailboxDigest(email)}`;
    const ipKey = `${prefix}-ip:${ip}`;
    const locked =
      (await this.throttles.isLocked(emailKey, now)) || (await this.throttles.isLocked(ipKey, now));
    if (locked) throw new ApiError('rate_limited', SIGNUP_LIMIT);
    await this.throttles.recordFailure(emailKey, now, emailLimit, SIGNUP_LOCK_MS);
    await this.throttles.recordFailure(ipKey, now, ipLimit, SIGNUP_LOCK_MS);
  }

  private audit(
    action:
      | 'auth.trainee.signup'
      | 'auth.trainee.verified'
      | 'auth.trainee.verify.resent'
      | 'auth.trainee.approved'
      | 'auth.trainee.rejected'
      | 'auth.user.disabled'
      | 'auth.user.enabled',
    actorUserId: string | null,
    subjectType: string,
    subjectId: string,
    ip: string,
    requestId: string,
  ): Promise<void> {
    return this.audits.record({ action, actorUserId, ip, requestId, subjectType, subjectId });
  }
}

function toPending(row: PendingRegistrationEntity): PendingRegistrationRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
  };
}

function clip(value: string, max: number): string {
  return value.slice(0, max);
}

/** A mail failure is logged and ignored so signup, approval, and sign-in still finish. */
export async function settleTraineeMail(
  run: () => Promise<boolean>,
  logger: AppLogger,
): Promise<boolean> {
  try {
    return await run();
  } catch (error) {
    logger.error({ err: error instanceof Error ? error.name : 'Error' }, 'Mail could not be sent');
    return false;
  }
}

async function activateTrainee(
  users: Repository<UserEntity>,
  row: PendingRegistrationEntity,
  traineeId: string,
  now: Date,
): Promise<UserEntity> {
  const existing = await users.findOne({ where: { email: row.email } });
  if (existing && existing.role !== 'trainee') {
    throw new ApiError('validation', 'That email already belongs to a staff account.');
  }
  if (existing && existing.emailVerifiedAt instanceof Date) {
    throw new ApiError('validation', 'That person already has an active account.');
  }
  const taken = await users.findOne({ where: { traineeId } });
  if (taken && taken.id !== existing?.id) {
    throw new ApiError('validation', 'That trainee is already linked to another account.');
  }
  const displayName = (row.displayName.trim() || existing?.displayName || displayNameFromEmail(row.email)).slice(0, 120);
  if (existing) {
    await users.update(
      { id: existing.id },
      {
        passwordHash: row.passwordHash,
        displayName,
        initials: initialsFrom(displayName).slice(0, 8),
        hue: existing.hue,
        traineeId,
      },
    );
    await users
      .createQueryBuilder()
      .update()
      .set({ emailVerifiedAt: now })
      .where('id = :id AND email_verified_at IS NULL', { id: existing.id })
      .execute();
    const next = await users.findOne({ where: { id: existing.id } });
    if (!next) throw new ApiError('server', 'The account could not be saved.');
    return next;
  }
  return users.save(
    users.create({
      email: row.email,
      displayName,
      initials: initialsFrom(displayName).slice(0, 8),
      hue: hueFromEmail(row.email),
      role: 'trainee',
      passwordHash: row.passwordHash,
      emailVerifiedAt: now,
      traineeId,
      disabledAt: null,
      lastLoginAt: null,
    }),
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID.test(value);
}
