import type { DataSource } from 'typeorm';
import type { OutboxStatus } from './email-outbox.entity.js';

export const OUTBOX_MAX_ATTEMPTS = 5;
/** Wait after attempt 1, 2, 3, and 4. Attempt 5 is the last. */
export const OUTBOX_BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000] as const;
/** A sending row older than this is treated as stuck and can be claimed again. */
export const OUTBOX_STALE_MS = 120_000;

export interface OutboxMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo: string | null;
  traineeId: string | null;
  kind: string;
}

export interface OutboxRow extends OutboxMessage {
  id: string;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutboxListItem {
  id: string;
  traineeId: string | null;
  kind: string;
  to: string;
  subject: string;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutboxStore {
  insert(message: OutboxMessage, now: Date): Promise<OutboxRow>;
  claimById(id: string, now: Date): Promise<OutboxRow | null>;
  claimDue(now: Date, staleBefore: Date): Promise<OutboxRow | null>;
  markSent(id: string, now: Date): Promise<void>;
  markFailed(id: string, now: Date, error: string, nextAttemptAt: Date | null): Promise<void>;
  resetForResend(id: string, now: Date): Promise<OutboxRow | null>;
  get(id: string): Promise<OutboxRow | null>;
  listAttention(staleBefore: Date): Promise<OutboxListItem[]>;
}

const DUE = `
  (
    status IN ('queued', 'failed')
    AND attempts < max_attempts
    AND next_attempt_at IS NOT NULL
    AND next_attempt_at <= $1
  )
  OR (
    status = 'sending'
    AND updated_at <= $2
  )
`;

export class PostgresOutboxStore implements OutboxStore {
  constructor(private readonly dataSource: DataSource) {}

  private read(sql: string, params: readonly unknown[]): Promise<unknown> {
    return this.dataSource.query<unknown>(sql, [...params]);
  }

  async insert(message: OutboxMessage, now: Date): Promise<OutboxRow> {
    const rows = await this.read(
      `INSERT INTO email_outbox (
         id, trainee_id, kind, to_address, reply_to, subject, text_body, html_body,
         status, attempts, max_attempts, last_error, next_attempt_at, sent_at, created_at, updated_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
         'queued', 0, $8, NULL, $9, NULL, $9, $9
       )
       RETURNING *`,
      [
        message.traineeId,
        clip(message.kind, 40),
        clip(message.to, 320),
        message.replyTo ? clip(message.replyTo, 320) : null,
        clip(message.subject, 200),
        message.text,
        message.html,
        OUTBOX_MAX_ATTEMPTS,
        now,
      ],
    );
    const row = firstRow(rows);
    if (!row) throw new Error('The outbox row was not saved.');
    return mapRow(row);
  }

  async claimById(id: string, now: Date): Promise<OutboxRow | null> {
    const rows = await this.read(
      `UPDATE email_outbox
         SET status = 'sending', attempts = attempts + 1, updated_at = $2
       WHERE id = $1
         AND status IN ('queued', 'failed')
         AND attempts < max_attempts
       RETURNING *`,
      [id, now],
    );
    const row = firstRow(rows);
    return row ? mapRow(row) : null;
  }

  async claimDue(now: Date, staleBefore: Date): Promise<OutboxRow | null> {
    const rows = await this.read(
      `WITH due AS (
         SELECT id FROM email_outbox
         WHERE ${DUE}
         ORDER BY next_attempt_at ASC NULLS LAST, created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE email_outbox AS box
          SET status = 'sending', attempts = box.attempts + 1, updated_at = $1
         FROM due
        WHERE box.id = due.id
       RETURNING box.*`,
      [now, staleBefore],
    );
    const row = firstRow(rows);
    return row ? mapRow(row) : null;
  }

  async markSent(id: string, now: Date): Promise<void> {
    await this.read(
      `UPDATE email_outbox
         SET status = 'sent', last_error = NULL, next_attempt_at = NULL, sent_at = $2, updated_at = $2
       WHERE id = $1`,
      [id, now],
    );
  }

  async markFailed(
    id: string,
    now: Date,
    error: string,
    nextAttemptAt: Date | null,
  ): Promise<void> {
    await this.read(
      `UPDATE email_outbox
         SET status = 'failed', last_error = $2, next_attempt_at = $3, updated_at = $4
       WHERE id = $1`,
      [id, clip(error, 300), nextAttemptAt, now],
    );
  }

  async resetForResend(id: string, now: Date): Promise<OutboxRow | null> {
    const rows = await this.read(
      `UPDATE email_outbox
         SET status = 'queued', attempts = 0, last_error = NULL, next_attempt_at = $2, updated_at = $2
       WHERE id = $1 AND status <> 'sent'
       RETURNING *`,
      [id, now],
    );
    const row = firstRow(rows);
    return row ? mapRow(row) : null;
  }

  async get(id: string): Promise<OutboxRow | null> {
    const rows = await this.read(`SELECT * FROM email_outbox WHERE id = $1`, [id]);
    const row = firstRow(rows);
    return row ? mapRow(row) : null;
  }

  async listAttention(staleBefore: Date): Promise<OutboxListItem[]> {
    const rows = await this.read(
      `SELECT id, trainee_id, kind, to_address, subject, status, attempts, max_attempts,
              last_error, next_attempt_at, created_at, updated_at
         FROM email_outbox
        WHERE status = 'failed'
           OR (status = 'sending' AND updated_at <= $1)
           OR (status = 'queued' AND next_attempt_at IS NOT NULL AND next_attempt_at <= $1)
        ORDER BY updated_at DESC
        LIMIT 200`,
      [staleBefore],
    );
    return asRecords(rows).map(mapListItem);
  }
}

/** In-memory stand-in for the retry tests. It does not open a database. */
export class MemoryOutboxStore implements OutboxStore {
  private readonly rows: OutboxRow[] = [];
  private sequence = 0;

  async insert(message: OutboxMessage, now: Date): Promise<OutboxRow> {
    await Promise.resolve();
    this.sequence += 1;
    const row: OutboxRow = {
      ...message,
      id: `00000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`,
      status: 'queued',
      attempts: 0,
      maxAttempts: OUTBOX_MAX_ATTEMPTS,
      lastError: null,
      nextAttemptAt: now.toISOString(),
      sentAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.rows.push(row);
    return copy(row);
  }

  async claimById(id: string, now: Date): Promise<OutboxRow | null> {
    await Promise.resolve();
    const row = this.rows.find((item) => item.id === id);
    if (!row) return null;
    if (row.status !== 'queued' && row.status !== 'failed') return null;
    if (row.attempts >= row.maxAttempts) return null;
    return copy(markSending(row, now));
  }

  async claimDue(now: Date, staleBefore: Date): Promise<OutboxRow | null> {
    await Promise.resolve();
    const row = this.rows
      .filter((item) => canClaim(item, now, staleBefore))
      .sort((a, b) => (a.nextAttemptAt ?? '').localeCompare(b.nextAttemptAt ?? ''))[0];
    if (!row) return null;
    return copy(markSending(row, now));
  }

  async markSent(id: string, now: Date): Promise<void> {
    await Promise.resolve();
    const row = this.require(id);
    row.status = 'sent';
    row.lastError = null;
    row.nextAttemptAt = null;
    row.sentAt = now.toISOString();
    row.updatedAt = now.toISOString();
  }

  async markFailed(
    id: string,
    now: Date,
    error: string,
    nextAttemptAt: Date | null,
  ): Promise<void> {
    await Promise.resolve();
    const row = this.require(id);
    row.status = 'failed';
    row.lastError = clip(error, 300);
    row.nextAttemptAt = nextAttemptAt ? nextAttemptAt.toISOString() : null;
    row.updatedAt = now.toISOString();
  }

  async resetForResend(id: string, now: Date): Promise<OutboxRow | null> {
    await Promise.resolve();
    const row = this.rows.find((item) => item.id === id);
    if (!row || row.status === 'sent') return null;
    row.status = 'queued';
    row.attempts = 0;
    row.lastError = null;
    row.nextAttemptAt = now.toISOString();
    row.updatedAt = now.toISOString();
    return copy(row);
  }

  async get(id: string): Promise<OutboxRow | null> {
    await Promise.resolve();
    const row = this.rows.find((item) => item.id === id);
    return row ? copy(row) : null;
  }

  async listAttention(staleBefore: Date): Promise<OutboxListItem[]> {
    await Promise.resolve();
    const cutoff = staleBefore.toISOString();
    return this.rows
      .filter(
        (row) =>
          row.status === 'failed' ||
          (row.status === 'sending' && row.updatedAt <= cutoff) ||
          (row.status === 'queued' && row.nextAttemptAt !== null && row.nextAttemptAt <= cutoff),
      )
      .map((row) => ({
        id: row.id,
        traineeId: row.traineeId,
        kind: row.kind,
        to: row.to,
        subject: row.subject,
        status: row.status,
        attempts: row.attempts,
        maxAttempts: row.maxAttempts,
        lastError: row.lastError,
        nextAttemptAt: row.nextAttemptAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
  }

  private require(id: string): OutboxRow {
    const row = this.rows.find((item) => item.id === id);
    if (!row) throw new Error('The outbox row is missing.');
    return row;
  }
}

function canClaim(row: OutboxRow, now: Date, staleBefore: Date | null): boolean {
  if (row.status === 'sending') {
    return staleBefore !== null && row.updatedAt <= staleBefore.toISOString();
  }
  if (row.status !== 'queued' && row.status !== 'failed') return false;
  if (row.attempts >= row.maxAttempts) return false;
  if (!row.nextAttemptAt) return false;
  return row.nextAttemptAt <= now.toISOString();
}

function markSending(row: OutboxRow, now: Date): OutboxRow {
  row.status = 'sending';
  row.attempts += 1;
  row.updatedAt = now.toISOString();
  return row;
}

function copy(row: OutboxRow): OutboxRow {
  return { ...row };
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function firstRow(value: unknown): Record<string, unknown> | null {
  const rows = asRecords(normalizeQuery(value));
  return rows[0] ?? null;
}

/**
 * TypeORM returns `[rows, rowCount]` for UPDATE and DELETE, and the rows
 * themselves for SELECT and INSERT.
 */
function normalizeQuery(value: unknown): unknown {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    Array.isArray(value[0]) &&
    typeof value[1] === 'number'
  ) {
    return value[0];
  }
  return value;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && !Array.isArray(item),
  );
}

function mapRow(row: Record<string, unknown>): OutboxRow {
  return {
    id: text(row.id),
    traineeId: optionalText(row.trainee_id),
    kind: text(row.kind),
    to: text(row.to_address),
    replyTo: optionalText(row.reply_to),
    subject: text(row.subject),
    text: text(row.text_body),
    html: text(row.html_body),
    status: statusOf(row.status),
    attempts: numberOf(row.attempts),
    maxAttempts: numberOf(row.max_attempts),
    lastError: optionalText(row.last_error),
    nextAttemptAt: instant(row.next_attempt_at),
    sentAt: instant(row.sent_at),
    createdAt: instant(row.created_at) ?? '',
    updatedAt: instant(row.updated_at) ?? '',
  };
}

function mapListItem(row: Record<string, unknown>): OutboxListItem {
  return {
    id: text(row.id),
    traineeId: optionalText(row.trainee_id),
    kind: text(row.kind),
    to: text(row.to_address),
    subject: text(row.subject),
    status: statusOf(row.status),
    attempts: numberOf(row.attempts),
    maxAttempts: numberOf(row.max_attempts),
    lastError: optionalText(row.last_error),
    nextAttemptAt: instant(row.next_attempt_at),
    createdAt: instant(row.created_at) ?? '',
    updatedAt: instant(row.updated_at) ?? '',
  };
}

function statusOf(value: unknown): OutboxStatus {
  if (value === 'queued' || value === 'sending' || value === 'sent' || value === 'failed')
    return value;
  return 'failed';
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberOf(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function instant(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 0) return new Date(value).toISOString();
  return null;
}
