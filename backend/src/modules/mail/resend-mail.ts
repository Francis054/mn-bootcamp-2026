import type { EmailProvider, MailResult, OutboundMail } from './email-provider.js';

export interface ResendSettings {
  apiKey: string;
  from: string;
  fetchImpl?: typeof fetch;
}

/**
 * Sends through Resend's HTTPS API. The key and the from address come from
 * the environment. This class does not log them, and a refusal does not
 * repeat the provider's response.
 */
export class ResendMail implements EmailProvider {
  readonly name = 'resend' as const;
  readonly configured = true;

  constructor(private readonly settings: ResendSettings) {}

  async send(message: OutboundMail): Promise<MailResult> {
    const response = await (this.settings.fetchImpl ?? fetch)('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.settings.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      }),
    });
    await response.text();
    if (!response.ok) throw new Error('The mail provider refused the message.');
    return { delivered: true };
  }
}
