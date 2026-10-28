import { describe, expect, it } from 'vitest';
import { AuditRepository } from '../../src/modules/auth/audit.repository.js';
import {
  AUDIT_ACTION_PATTERN,
  AUDIT_ACTIONS,
  isAuditAction,
  type AuditAction,
} from '../../src/modules/auth/audit-event.entity.js';

describe('audit action names', () => {
  it('accepts only listed names that match the database pattern', () => {
    expect(AUDIT_ACTIONS.length).toBeGreaterThan(0);
    for (const action of AUDIT_ACTIONS) {
      expect(action).toMatch(AUDIT_ACTION_PATTERN);
      expect(isAuditAction(action)).toBe(true);
    }
    expect(isAuditAction('curriculum.future_kind.created')).toBe(false);
    expect(isAuditAction('auth')).toBe(false);
    expect(isAuditAction('Not An Action')).toBe(false);
    expect(AUDIT_ACTION_PATTERN.test('curriculum.future_kind.created')).toBe(true);
  });

  it('refuses to store an action that is not on the list', async () => {
    const saved: unknown[] = [];
    const repository = new AuditRepository({
      create: (row: unknown) => row,
      save: (row: unknown) => {
        saved.push(row);
        return Promise.resolve(row);
      },
    } as never);
    await expect(
      repository.record({
        action: 'curriculum.future_kind.created' as AuditAction,
        actorUserId: null,
        ip: null,
        requestId: null,
      }),
    ).rejects.toThrow('Unknown audit action.');
    expect(saved).toEqual([]);

    await repository.record({
      action: 'auth.login.succeeded',
      actorUserId: null,
      ip: null,
      requestId: null,
    });
    expect(saved).toHaveLength(1);
  });
});
