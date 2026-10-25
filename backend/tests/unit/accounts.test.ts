import { describe, expect, it } from 'vitest';
import {
  changePasswordProblems,
  inviteProblems,
  newPasswordProblems,
  RESET_ACCEPTED,
} from '../../src/modules/accounts/account.rules.js';
import { createMail } from '../../src/modules/mail/create-mail.js';
import { MemoryMail } from '../../src/modules/mail/memory-mail.js';
import { ResendMail } from '../../src/modules/mail/resend-mail.js';
import { UnconfiguredMail } from '../../src/modules/mail/unconfigured-mail.js';
import { sessionTokenHash } from '../../src/modules/auth/tokens.js';
import {
  ENQUIRY_TOPICS,
  honeypotFilled,
  parseEnquiry,
} from '../../src/modules/enquiries/enquiry.rules.js';
import { testEnv } from '../support/app-env.js';

const SECRET = 'test-session-secret-at-least-32-chars';

describe('account rules', () => {
  it('uses one reset response and does not include a development link', () => {
    expect(RESET_ACCEPTED).toEqual({
      accepted: true,
      delivered: false,
      message: 'If an account exists for that address, a reset message will be sent.',
    });
    expect(JSON.stringify(RESET_ACCEPTED)).not.toContain('developmentResetPath');
  });

  it('asks for a new password before the length rule, and keeps the 12 character rule', () => {
    expect(newPasswordProblems('', 'other', 'ada@example.test').password).toBe(
      'Choose a new password.',
    );
    expect(newPasswordProblems('short-1', 'short-1', 'ada@example.test').password).toBe(
      'Use at least 12 characters.',
    );
    expect(
      changePasswordProblems({ current: '', next: 'short-1', confirm: 'nope', email: 'a@b.c' }),
    ).toEqual({
      current: 'Enter your current password.',
      next: 'Use at least 12 characters.',
      confirm: 'The two passwords do not match.',
    });
  });

  it('requires a role on an invitation', () => {
    expect(inviteProblems('ada@example.test', '')).toEqual({ role: 'Choose a role.' });
    expect(inviteProblems('ada@example.test', 'owner').role).toBe(
      'Choose viewer, editor, trainer, trainee, or administrator.',
    );
    expect(inviteProblems('ada@example.test', 'editor')).toEqual({});
  });

  it('hashes a token so the stored value is not the token', () => {
    const hash = sessionTokenHash('raw-token-value', SECRET);
    expect(hash).not.toBe('raw-token-value');
    expect(hash).toHaveLength(64);
    expect(sessionTokenHash('raw-token-value', SECRET)).toBe(hash);
  });
});

describe('enquiry rules', () => {
  it('accepts the four topics and rejects a missing consent tick', () => {
    expect(ENQUIRY_TOPICS).toHaveLength(4);
    const parsed = parseEnquiry({
      name: 'Ada',
      email: 'ada@example.test',
      topic: 'The 2026 bootcamp',
      message: 'Please tell me about the sample week.',
      consent: true,
    });
    expect(parsed.ok).toBe(true);
    const refused = parseEnquiry({
      name: 'Ada',
      email: 'ada@example.test',
      topic: 'A different topic',
      message: 'short',
      consent: false,
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.problems.topic).toBe('Choose a topic.');
      expect(refused.problems.message).toBe('Use at least 20 characters.');
      expect(refused.problems.consent).toBe(
        'Tick to confirm you understand this message is not delivered.',
      );
    }
  });

  it('treats a filled company field as the honeypot and an empty one as a normal form', () => {
    expect(honeypotFilled('spam company')).toBe(true);
    expect(honeypotFilled('')).toBe(false);
    expect(honeypotFilled(undefined)).toBe(false);
  });
});

describe('mail providers', () => {
  it('keeps development and test mail in memory', async () => {
    const mail = createMail(testEnv());
    expect(mail.name).toBe('memory');
    expect(mail).toBeInstanceOf(MemoryMail);
    if (!(mail instanceof MemoryMail)) return;
    const result = await mail.send({ to: 'ada@example.test', subject: 'Hello', text: 'Body' });
    expect(result).toEqual({ delivered: true });
    expect(mail.sent).toEqual([{ to: 'ada@example.test', subject: 'Hello', text: 'Body' }]);
  });

  it('reports nothing sent when production has no mail settings', async () => {
    const mail = createMail(testEnv({ nodeEnv: 'production' }));
    expect(mail).toBeInstanceOf(UnconfiguredMail);
    await expect(
      mail.send({ to: 'ada@example.test', subject: 'Hello', text: 'Body' }),
    ).resolves.toEqual({
      delivered: false,
    });
  });

  it('selects Resend only when both settings are present', () => {
    const mail = createMail(testEnv({ resendApiKey: 'rk_test', emailFrom: 'desk@example.test' }));
    expect(mail.name).toBe('resend');
  });

  it('posts to Resend without repeating the key or the refusal body', async () => {
    const calls: { url: string; authorization: string }[] = [];
    const fetchImpl: typeof fetch = (input, init) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const headers = init?.headers;
      const authorization =
        headers && !Array.isArray(headers) && !(headers instanceof Headers)
          ? (headers.Authorization ?? '')
          : '';
      calls.push({ url, authorization });
      return Promise.resolve(new Response('provider-body-with-rk_secret', { status: 422 }));
    };
    const mail = new ResendMail({
      apiKey: 'rk_secret',
      from: 'desk@example.test',
      fetchImpl,
    });
    let message = '';
    try {
      await mail.send({ to: 'ada@example.test', subject: 'Hello', text: 'Body' });
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).toBe('The mail provider refused the message.');
    expect(message).not.toContain('rk_secret');
    expect(message).not.toContain('provider-body');
    expect(calls[0]).toEqual({
      url: 'https://api.resend.com/emails',
      authorization: 'Bearer rk_secret',
    });
  });
});
