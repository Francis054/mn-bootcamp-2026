import type { EmailProvider, MailResult, OutboundMail } from './email-provider.js';

/**
 * Keeps messages in this process. Development and the tests use it so no
 * network call is made and nothing is printed.
 */
export class MemoryMail implements EmailProvider {
  readonly name = 'memory' as const;
  readonly configured = true;
  readonly sent: OutboundMail[] = [];

  send(message: OutboundMail): Promise<MailResult> {
    this.sent.push({ to: message.to, subject: message.subject, text: message.text });
    return Promise.resolve({ delivered: true });
  }
}
