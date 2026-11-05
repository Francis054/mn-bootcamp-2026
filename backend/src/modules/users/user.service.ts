import { UserFacingError } from '../../shared/errors/user-facing-error.js';
import { passwordProblem } from '../auth/password-policy.js';
import type { Argon2Hasher } from '../auth/password-hasher.js';
import { displayNameFromEmail, hueFromEmail, initialsFrom } from './profile.js';
import type { PublicUser } from './public-user.js';
import type { Role } from './role.js';
import { isRole } from './role.js';
import type { UserEntity } from './user.entity.js';
import type { UserRepository } from './user.repository.js';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface CreateUserInput {
  email: string;
  password: string;
  role: Role;
  displayName?: string;
  /** Staff and test accounts are verified. An invitation leaves this false. */
  verified?: boolean;
}

export function toPublicUser(user: UserEntity): PublicUser {
  if (!isRole(user.role)) {
    throw new UserFacingError('This account has a role the server does not recognize.');
  }
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    initials: user.initials,
    hue: user.hue,
    role: user.role,
    emailVerified: user.emailVerifiedAt instanceof Date,
    traineeId: user.traineeId ?? null,
  };
}

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: Argon2Hasher,
  ) {}

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.users.findByEmail(normalizeEmail(email));
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.users.findById(id);
  }

  /**
   * Create one administrator, or replace that administrator's password when
   * `rotate` is set. Does not promote an existing viewer or editor.
   */
  async createAdministrator(input: {
    email: string;
    password: string;
    displayName?: string;
    rotate: boolean;
  }): Promise<'created' | 'updated'> {
    const email = normalizeEmail(input.email);
    assertEmail(email);
    assertPassword(input.password, email);
    const existing = await this.users.findByEmail(email);
    if (!existing) {
      await this.insert({
        email,
        password: input.password,
        role: 'administrator',
        ...(input.displayName ? { displayName: input.displayName } : {}),
      });
      return 'created';
    }
    if (!input.rotate) {
      throw new UserFacingError('An account with that mailbox already exists.');
    }
    if (existing.role !== 'administrator') {
      throw new UserFacingError('That mailbox is not an administrator.');
    }
    await this.users.updatePassword(existing.id, await this.hasher.hash(input.password));
    return 'updated';
  }

  /** Used by tests and invitations. Public trainee signup uses its own path. */
  async createUser(input: CreateUserInput): Promise<PublicUser> {
    const email = normalizeEmail(input.email);
    assertEmail(email);
    assertPassword(input.password, email);
    const existing = await this.users.findByEmail(email);
    if (existing) throw new UserFacingError('An account with that mailbox already exists.');
    const saved = await this.insert({
      email,
      password: input.password,
      role: input.role,
      ...(input.verified === false ? { verified: false } : {}),
      ...(input.displayName ? { displayName: input.displayName } : {}),
    });
    return toPublicUser(saved);
  }

  touchLastLogin(id: string, at: Date): Promise<void> {
    return this.users.setLastLogin(id, at);
  }

  private async insert(input: CreateUserInput & { email: string }): Promise<UserEntity> {
    const displayName = (input.displayName?.trim() || displayNameFromEmail(input.email)).slice(
      0,
      120,
    );
    if (displayName.length === 0) {
      throw new UserFacingError('Give the account a name.');
    }
    const passwordHash = await this.hasher.hash(input.password);
    return this.users.insert({
      email: input.email,
      displayName,
      initials: initialsFrom(displayName).slice(0, 8),
      hue: hueFromEmail(input.email),
      role: input.role,
      passwordHash,
      emailVerifiedAt: input.verified === false ? null : new Date(),
    });
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertEmail(email: string): void {
  if (!EMAIL.test(email) || email.length > 320) {
    throw new UserFacingError('Enter a valid email address, like name@example.com.');
  }
}

function assertPassword(password: string, email: string): void {
  const problem = passwordProblem(password, email);
  if (problem) throw new UserFacingError(problem);
}
