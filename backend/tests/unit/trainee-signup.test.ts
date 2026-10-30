import { describe, expect, it } from 'vitest';
import { existingAccountLetter, resetLetter, verificationLetter } from '../../src/modules/mail/letters.js';
import { ObservedMail } from '../../src/modules/mail/observed-mail.js';
import { UnconfiguredMail } from '../../src/modules/mail/unconfigured-mail.js';
import type { EmailProvider, MailResult } from '../../src/modules/mail/email-provider.js';
import { signupDecision } from '../../src/modules/trainee-auth/signup.rules.js';
import { captureLogger } from '../support/logger.js';

describe('signup eligibility', () => {
  it('keeps roster, pending, and already-registered apart', () => {
    expect(signupDecision(true, null)).toEqual({ kind: 'roster' });
    expect(signupDecision(true, { role: 'trainee', verified: false })).toEqual({ kind: 'roster' });
    expect(signupDecision(false, null)).toEqual({ kind: 'pending' });
    expect(signupDecision(false, { role: 'trainee', verified: false })).toEqual({ kind: 'pending' });
    expect(signupDecision(true, { role: 'trainee', verified: true })).toEqual({ kind: 'already-registered' });
    expect(signupDecision(false, { role: 'administrator', verified: true })).toEqual({
      kind: 'already-registered',
    });
    expect(signupDecision(true, { role: 'editor', verified: false })).toEqual({
      kind: 'already-registered',
    });
  });
});

describe('trainee letters', () => {
  it('includes the link in text and html', () => {
    const link = 'https://bootcamp.example/verify-email?token=abc';
    const verify = verificationLetter(link);
    const reset = resetLetter('https://bootcamp.example/portal/reset-password?token=abc');
    const existing = existingAccountLetter('https://bootcamp.example/forgot-password');
    expect(verify.text).toContain(link);
    expect(verify.html).toContain(link);
    expect(verify.html).toContain('<a href="');
    expect(reset.text).toContain('/portal/reset-password');
    expect(reset.html).toContain('/portal/reset-password');
    expect(existing.text).toContain('/forgot-password');
    expect(existing.html).toContain('already exists');
  });
});

describe('observed mail', () => {
  it('logs a failed send and does not throw or repeat the mailbox', async () => {
    const boom: EmailProvider = {
      name: 'resend',
      configured: true,
      send(): Promise<MailResult> {
        return Promise.reject(new Error('network down ada@example.test'));
      },
    };
    const captured = captureLogger();
    const mail = new ObservedMail(boom, captured.logger, false);
    const result = await mail.send({
      to: 'ada@example.test',
      subject: 'Confirm your Maxim Nyansa trainee account',
      text: 'https://bootcamp.example/verify-email?token=secret',
      html: '<p>https://bootcamp.example/verify-email?token=secret</p>',
    });
    expect(result).toEqual({ delivered: false });
    const log = captured.lines().join('\n');
    expect(log).toContain('Mail send failed');
    expect(log).not.toContain('ada@example.test');
    expect(log).not.toContain('secret');
  });

  it('logs when the provider reports that nothing was delivered', async () => {
    const captured = captureLogger();
    const mail = new ObservedMail(new UnconfiguredMail(), captured.logger, false);
    await expect(
      mail.send({ to: 'ada@example.test', subject: 'Hello', text: 'Body' }),
    ).resolves.toEqual({ delivered: false });
    expect(captured.lines().join('\n')).toContain('Mail was not delivered');
  });
});
