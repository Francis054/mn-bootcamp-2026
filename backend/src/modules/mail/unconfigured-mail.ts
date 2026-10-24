import type { EmailProvider, MailResult, OutboundMail } from './email-provider.js';

/** Production without mail settings. The process still boots. */
export class UnconfiguredMail implements EmailProvider {
  readonly name = 'unconfigured' as const;
  readonly configured = false;

  send(_message: OutboundMail): Promise<MailResult> {
    return Promise.resolve({ delivered: false });
  }
}
