import type { AppLogger } from '../../shared/logging/logger.js';
import type { EmailProvider, MailResult, OutboundMail } from './email-provider.js';
import {
  OUTBOX_BACKOFF_MS,
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_STALE_MS,
  type OutboxRow,
  type OutboxStore,
} from './outbox-store.js';

const BATCH = 20;

/**
 * Queues every message, tries it immediately, then retries on a timer.
 * A free Render web service has no separate worker, so the timer lives
 * in this process. `unref` keeps the timer from holding a test process open.
 */
export class OutboxMail implements EmailProvider {
  readonly name: EmailProvider['name'];
  readonly configured: boolean;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly inner: EmailProvider,
    private readonly store: OutboxStore,
    private readonly logger: AppLogger,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.name = inner.name;
    this.configured = inner.configured;
  }

  async send(message: OutboundMail): Promise<MailResult> {
    const row = await this.store.insert(
      {
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html ?? '',
        replyTo: message.replyTo ?? null,
        traineeId: message.traineeId ?? null,
        kind: message.kind ?? 'message',
      },
      this.now(),
    );
    return this.deliver(row);
  }

  async processDue(): Promise<number> {
    const now = this.now();
    const staleBefore = new Date(now.getTime() - OUTBOX_STALE_MS);
    let sent = 0;
    for (let index = 0; index < BATCH; index += 1) {
      const row = await this.store.claimDue(now, staleBefore);
      if (!row) break;
      const result = await this.finish(row);
      if (result.delivered) sent += 1;
    }
    return sent;
  }

  /** Puts a failed or stuck message back at attempt zero and tries it now. */
  async resend(id: string): Promise<MailResult | null> {
    const reset = await this.store.resetForResend(id, this.now());
    if (!reset) return null;
    return this.deliver(reset);
  }

  listAttention(): ReturnType<OutboxStore['listAttention']> {
    const staleBefore = new Date(this.now().getTime() - OUTBOX_STALE_MS);
    return this.store.listAttention(staleBefore);
  }

  start(intervalMs = 60_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.processDue().catch((error: unknown) => {
        this.logger.error(
          { err: error instanceof Error ? error.name : 'Error' },
          'Email outbox retry failed',
        );
      });
    }, intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private async deliver(row: OutboxRow): Promise<MailResult> {
    const claimed = await this.store.claimById(row.id, this.now());
    if (!claimed) {
      const current = await this.store.get(row.id);
      return { delivered: current?.status === 'sent' };
    }
    return this.finish(claimed);
  }

  private async finish(row: OutboxRow): Promise<MailResult> {
    if (!this.inner.configured) {
      await this.fail(row, 'Mail is not configured.');
      return { delivered: false };
    }
    try {
      const result = await this.inner.send({
        to: row.to,
        subject: row.subject,
        text: row.text,
        html: row.html,
        ...(row.replyTo ? { replyTo: row.replyTo } : {}),
      });
      if (!result.delivered) {
        await this.fail(row, 'The message was not accepted.');
        return { delivered: false };
      }
      await this.store.markSent(row.id, this.now());
      return { delivered: true };
    } catch (error) {
      await this.fail(row, safeMailError(error));
      return { delivered: false };
    }
  }

  private async fail(row: OutboxRow, error: string): Promise<void> {
    const now = this.now();
    const next = nextAttempt(row.attempts, row.maxAttempts, now);
    await this.store.markFailed(row.id, now, error, next);
    this.logger.error(
      { kind: row.kind, attempt: row.attempts, maxAttempts: row.maxAttempts },
      'Email outbox send failed',
    );
  }
}

export function nextAttempt(attempts: number, maxAttempts: number, now: Date): Date | null {
  if (attempts >= maxAttempts) return null;
  const index = Math.max(0, Math.min(attempts - 1, OUTBOX_BACKOFF_MS.length - 1));
  const delay = OUTBOX_BACKOFF_MS[index] ?? OUTBOX_BACKOFF_MS[0];
  return new Date(now.getTime() + delay);
}

/** Drops provider secrets. A normal refusal message is kept. */
export function safeMailError(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'The message could not be sent.';
  if (/bearer|api[_-]?key|secret|token=|service_role|eyJ[A-Za-z0-9_-]{8,}/i.test(raw)) {
    return 'The mail provider refused the message.';
  }
  const compact = raw.replace(/\s+/g, ' ').trim();
  if (!compact) return 'The message could not be sent.';
  return compact.slice(0, 300);
}

export { OUTBOX_MAX_ATTEMPTS };
