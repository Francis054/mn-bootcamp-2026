import type { Repository } from 'typeorm';
import { isAuditAction, type AuditAction, type AuditEventEntity } from './audit-event.entity.js';

export interface AuditInput {
  action: AuditAction;
  actorUserId: string | null;
  ip: string | null;
  requestId: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
}

/**
 * One row per sign-in, sign-out, or curriculum change. The row stores the
 * action and the row id. It does not store a password, a mailbox, or the text
 * the editor wrote.
 */
export class AuditRepository {
  constructor(private readonly repository: Repository<AuditEventEntity>) {}

  async record(input: AuditInput): Promise<void> {
    if (!isAuditAction(input.action)) {
      throw new Error('Unknown audit action.');
    }
    const row = this.repository.create({
      action: input.action,
      actorUserId: input.actorUserId,
      ip: input.ip,
      requestId: input.requestId,
      subjectType: input.subjectType ?? null,
      subjectId: input.subjectId ?? null,
    });
    await this.repository.save(row);
  }

  countByAction(action: AuditAction): Promise<number> {
    return this.repository.count({ where: { action } });
  }
}
