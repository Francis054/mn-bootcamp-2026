import type { AppLogger } from '../../shared/logging/logger.js';
import type { EmailProvider, MailResult, OutboundMail } from './email-provider.js';

/**
 * Sends through the configured provider and records a failure instead of
 * dropping it. A later outbox can replace this class and keep the same
 * `send` method. Callers must treat `delivered: false` as "try again".
 */
export class ObservedMail implements EmailProvider {
  readonly name: EmailProvider['name'];
  readonly configured: boolean;

  constructor(
    private readonly inner: EmailProvider,
    private readonly logger: AppLogger,
    private readonly devMailLog: boolean,
  ) {
    this.name = inner.name;
    this.configured = inner.configured;
  }

  async send(message: OutboundMail): Promise<MailResult> {
    try {
      const result = await this.inner.send(message);
      if (!result.delivered) {
        this.logger.error(
          { provider: this.inner.name, subject: message.subject },
          'Mail was not delivered',
        );
        return result;
      }
      if (this.devMailLog) {
        this.logger.info(
          { provider: this.inner.name, subject: message.subject },
          'Development mail accepted',
        );
      }
      return result;
    } catch (error) {
      this.logger.error(
        {
          provider: this.inner.name,
          subject: message.subject,
          err: error instanceof Error ? error.name : 'Error',
        },
        'Mail send failed',
      );
      return { delivered: false };
    }
  }
}
