export interface OutboundMail {
  to: string;
  subject: string;
  text: string;
  /** HTML part. Providers that only keep text may ignore it. */
  html?: string;
  replyTo?: string;
  /** Set when the message is about one trainee. Staff mail leaves this empty. */
  traineeId?: string;
  /** Short label such as verification or cv_link. Not a secret. */
  kind?: string;
}

export interface MailResult {
  delivered: boolean;
}

/**
 * Sends one plain-text message. Repositories do not call this.
 * `configured` is false when the process has no mail account.
 */
export interface EmailProvider {
  readonly name: 'memory' | 'resend' | 'unconfigured';
  readonly configured: boolean;
  send(message: OutboundMail): Promise<MailResult>;
}
