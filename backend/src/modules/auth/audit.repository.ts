import type { Repository } from 'typeorm';
import type { AuditAction, AuditEventEntity } from './audit-event.entity.js';

export interface AuditInput {
  action: AuditAction;
  actorUserId: string | null;
  ip: string | null;
  requestId: string | null;
}

/** Auth events only. No password, and no mailbox address. */
export class AuditRepository {
  constructor(private readonly repository: Repository<AuditEventEntity>) {}

  async record(input: AuditInput): Promise<void> {
    const row = this.repository.create({
      action: input.action,
      actorUserId: input.actorUserId,
      ip: input.ip,
      requestId: input.requestId,
    });
    await this.repository.save(row);
  }

  countByAction(action: AuditAction): Promise<number> {
    return this.repository.count({ where: { action } });
  }
}
