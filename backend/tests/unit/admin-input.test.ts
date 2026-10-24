import { describe, expect, it } from 'vitest';
import { resolveAdminInput } from '../../src/commands/admin-input.js';
import { UserFacingError } from '../../src/shared/errors/user-facing-error.js';

const hidden = 'Hidden-password-1';

describe('resolveAdminInput', () => {
  it('reads the mailbox from an argument and the password from the environment', async () => {
    const env: NodeJS.ProcessEnv = { ADMIN_BOOTSTRAP_PASSWORD: hidden };
    const input = await resolveAdminInput(['ada@example.test'], env, () => {
      throw new Error('The prompt should not run when the environment has a password.');
    });
    expect(input.email).toBe('ada@example.test');
    expect(input.password).toBe(hidden);
    expect(input.rotate).toBe(false);
    expect(env.ADMIN_BOOTSTRAP_PASSWORD).toBeUndefined();
  });

  it('refuses a password on the command line and does not repeat it', async () => {
    expect.assertions(2);
    try {
      await resolveAdminInput(['--password', hidden], {}, () => Promise.resolve(''));
    } catch (error) {
      expect(error).toBeInstanceOf(UserFacingError);
      const message = error instanceof Error ? error.message : '';
      expect(message).not.toContain(hidden);
    }
  });

  it('keeps a display name from being read as the mailbox', async () => {
    const env: NodeJS.ProcessEnv = {
      ADMIN_EMAIL: 'ada@example.test',
      ADMIN_BOOTSTRAP_PASSWORD: hidden,
    };
    const input = await resolveAdminInput(['--name', 'Ada Lovelace'], env, () =>
      Promise.resolve(''),
    );
    expect(input.email).toBe('ada@example.test');
    expect(input.displayName).toBe('Ada Lovelace');
  });

  it('rejects two prompts that do not match', async () => {
    const prompts = ['Correct-horse-1', 'Correct-horse-2'];
    await expect(
      resolveAdminInput(['--email', 'ada@example.test'], {}, () =>
        Promise.resolve(prompts.shift() ?? ''),
      ),
    ).rejects.toThrow('The two passwords do not match.');
  });
});
