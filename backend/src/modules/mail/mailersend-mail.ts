import { parseMailbox, type Mailbox } from './address.js';
import type { EmailProvider, MailResult, OutboundMail } from './email-provider.js';

/** MailerSend does not publish a client timeout. Abort a hung HTTPS call so the outbox can retry. */
export const MAILERSEND_TIMEOUT_MS = 15_000;

const EMAIL_URL = 'https://api.mailersend.com/v1/email';

export interface MailerSendSettings {
  apiKey: string;
  from: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Sends one message through MailerSend's transactional HTTPS API.
 * `POST https://api.mailersend.com/v1/email` with `Authorization: Bearer`.
 * A queued send is HTTP 202 and an empty body. Any other 2xx is accepted too,
 * except the documented 202 that says every recipient was suppressed.
 * The key, the mailbox, and the response body are not logged.
 */
export class MailerSendMail implements EmailProvider {
  readonly name = 'mailersend' as const;
  readonly configured = true;

  constructor(private readonly settings: MailerSendSettings) {}

  async send(message: OutboundMail): Promise<MailResult> {
    const from = parseMailbox(this.settings.from);
    if (!from) throw new Error('The mail provider refused the message.');
    let response: Response;
    try {
      response = await (this.settings.fetchImpl ?? fetch)(EMAIL_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.settings.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mailersendBody(from, message)),
        signal: AbortSignal.timeout(this.settings.timeoutMs ?? MAILERSEND_TIMEOUT_MS),
      });
    } catch (error) {
      throw transportError(error, this.settings.apiKey);
    }
    const payload = await response.text();
    if (!response.ok || allRecipientsSuppressed(payload)) {
      throw new Error('The mail provider refused the message.');
    }
    return { delivered: true };
  }
}

function mailersendBody(from: Mailbox, message: OutboundMail): Record<string, unknown> {
  const fromBody: Record<string, string> = { email: from.email };
  if (from.name) fromBody.name = from.name;
  const body: Record<string, unknown> = {
    from: fromBody,
    to: [{ email: message.to }],
    subject: message.subject,
    text: message.text,
  };
  if (message.html) body.html = message.html;
  if (message.replyTo) {
    const reply = parseMailbox(message.replyTo);
    if (!reply) throw new Error('The mail provider refused the message.');
    const replyBody: Record<string, string> = { email: reply.email };
    if (reply.name) replyBody.name = reply.name;
    body.reply_to = replyBody;
  }
  return body;
}

/** Documented 202 where MailerSend accepted the call but did not send. */
function allRecipientsSuppressed(payload: string): boolean {
  const trimmed = payload.trim();
  if (!trimmed.startsWith('{')) return false;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object') return false;
    const warnings = (parsed as { warnings?: unknown }).warnings;
    if (!Array.isArray(warnings)) return false;
    return warnings.some((item) => {
      if (!item || typeof item !== 'object') return false;
      return (item as { type?: unknown }).type === 'ALL_SUPPRESSED';
    });
  } catch {
    return false;
  }
}

function transportError(error: unknown, secret: string): Error {
  if (isTimeout(error)) return new Error('The mail provider did not respond in time.');
  const raw = error instanceof Error ? error.message : 'The message could not be sent.';
  if (
    (secret && raw.includes(secret)) ||
    /bearer|api[_-]?key|token=|service_role|eyJ[A-Za-z0-9_-]{8,}/i.test(raw)
  ) {
    return new Error('The mail provider refused the message.');
  }
  const compact = raw.replace(/\s+/g, ' ').trim();
  if (!compact) return new Error('The message could not be sent.');
  return new Error(compact.slice(0, 300));
}

function isTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('name' in error)) return false;
  const name = String(error.name);
  return name === 'TimeoutError' || name === 'AbortError';
}
