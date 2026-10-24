import { ApiError } from '../../shared/errors/api-error.js';
import type { PublicUser } from '../users/public-user.js';
import { toPublicUser } from '../users/user.service.js';
import type { UserEntity } from '../users/user.entity.js';
import type { UserRepository } from '../users/user.repository.js';
import type { SessionRepository } from './session.repository.js';
import { newSecretToken, sessionTokenHash } from './tokens.js';

const TOUCH_AFTER_MS = 60_000;

export interface AuthenticatedSession {
  user: PublicUser;
  sessionId: string;
  expiresAt: string;
}

export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly users: UserRepository,
    private readonly secret: string | undefined,
    private readonly idleTtlMs: number,
    private readonly absoluteTtlMs: number,
  ) {}

  async start(user: UserEntity, now: Date): Promise<{ token: string; expiresAt: Date }> {
    const secret = this.requireSecret();
    const token = newSecretToken();
    const expiresAt = new Date(now.getTime() + this.absoluteTtlMs);
    await this.sessions.insert({
      id: sessionTokenHash(token, secret),
      userId: user.id,
      expiresAt,
      lastSeenAt: now,
    });
    return { token, expiresAt };
  }

  async authenticate(token: string, now: Date): Promise<AuthenticatedSession | null> {
    if (!this.secret) return null;
    const id = sessionTokenHash(token, this.secret);
    const session = await this.sessions.findById(id);
    if (!session) return null;
    const idleDeadline = session.lastSeenAt.getTime() + this.idleTtlMs;
    if (session.expiresAt.getTime() <= now.getTime() || idleDeadline <= now.getTime()) {
      await this.sessions.deleteById(id);
      return null;
    }
    if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_AFTER_MS) {
      await this.sessions.touch(id, now);
    }
    const user = await this.users.findById(session.userId);
    if (!user) {
      await this.sessions.deleteById(id);
      return null;
    }
    return { user: toPublicUser(user), sessionId: id, expiresAt: session.expiresAt.toISOString() };
  }

  async revoke(token: string): Promise<string | null> {
    if (!this.secret) return null;
    const id = sessionTokenHash(token, this.secret);
    const session = await this.sessions.findById(id);
    await this.sessions.deleteById(id);
    return session?.userId ?? null;
  }

  private requireSecret(): string {
    if (!this.secret) throw new ApiError('server', 'Sign-in is not configured.');
    return this.secret;
  }
}
