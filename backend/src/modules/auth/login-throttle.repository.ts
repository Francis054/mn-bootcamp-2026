import type { DataSource } from 'typeorm';
import { LoginThrottleEntity } from './login-throttle.entity.js';
import { isThrottleLocked, nextFailure, type ThrottleState } from './login-throttle.js';

export class LoginThrottleRepository {
  constructor(private readonly dataSource: DataSource) {}

  async isLocked(subjectKey: string, now: Date): Promise<boolean> {
    const row = await this.dataSource.getRepository(LoginThrottleEntity).findOne({
      where: { subjectKey },
    });
    return isThrottleLocked(row === null ? null : toState(row), now);
  }

  async recordFailure(
    subjectKey: string,
    now: Date,
    limit: number,
    lockMs: number,
  ): Promise<'open' | 'locked'> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(LoginThrottleEntity);
      const existing = await repository.findOne({
        where: { subjectKey },
        lock: { mode: 'pessimistic_write' },
      });
      const decision = nextFailure(
        existing === null ? null : toState(existing),
        now,
        limit,
        lockMs,
      );
      const row = existing ?? repository.create({ subjectKey });
      row.failureCount = decision.next.failureCount;
      row.lockedUntil = decision.next.lockedUntil;
      await repository.save(row);
      return decision.locked ? 'locked' : 'open';
    });
  }

  async clear(subjectKey: string): Promise<void> {
    await this.dataSource.getRepository(LoginThrottleEntity).delete({ subjectKey });
  }
}

function toState(row: LoginThrottleEntity): ThrottleState {
  return { failureCount: row.failureCount, lockedUntil: row.lockedUntil };
}
