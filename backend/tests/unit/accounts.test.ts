import { describe, expect, it } from 'vitest';
import {
  changePasswordProblems,
  inviteProblems,
  newPasswordProblems,
  RESET_ACCEPTED,
} from '../../src/modules/accounts/account.rules.js';
import { createMail } from '../../src/modules/mail/create-mail.js';
import { MemoryMail } from '../../src/modules/mail/memory-mail.js';
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

  it('requires MAILERSEND_API_TOKEN before it will send', () => {
    expect(createMail(testEnv({ emailFrom: 'desk@example.test' })).name).toBe('memory');
    expect(createMail(testEnv({ mailersendApiToken: 'mls_test' })).name).toBe('memory');
    const production = createMail(
      testEnv({ nodeEnv: 'production', mailersendApiToken: 'mls_test' }),
    );
    expect(production).toBeInstanceOf(UnconfiguredMail);
    expect(
      createMail(testEnv({ mailersendApiToken: 'mls_test', emailFrom: 'Desk <desk@example.test>' }))
        .name,
    ).toBe('mailersend');
  });
});
