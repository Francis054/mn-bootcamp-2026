import type { AppEnv } from '../../config/env.js';
import type { EmailProvider } from './email-provider.js';
import { MailerSendMail } from './mailersend-mail.js';
import { MemoryMail } from './memory-mail.js';
import { UnconfiguredMail } from './unconfigured-mail.js';

/**
 * MailerSend when both settings are present. Otherwise an in-memory provider
 * in development and test, and a provider that reports nothing was sent in
 * production. Neither path is selected by a hardcoded address.
 */
export function createMail(env: AppEnv): EmailProvider {
  const apiKey = env.mailersendApiToken;
  const from = env.emailFrom;
  if (apiKey && from) return new MailerSendMail({ apiKey, from });
  if (env.nodeEnv === 'production') return new UnconfiguredMail();
  return new MemoryMail();
}
