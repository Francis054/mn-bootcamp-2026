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
    const copy: OutboundMail = { to: message.to, subject: message.subject, text: message.text };
    if (message.html !== undefined) copy.html = message.html;
    if (message.replyTo !== undefined) copy.replyTo = message.replyTo;
    this.sent.push(copy);
    return Promise.resolve({ delivered: true });
  }
}
