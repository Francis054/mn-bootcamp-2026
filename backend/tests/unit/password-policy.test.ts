import { describe, expect, it } from 'vitest';
import { passwordProblem } from '../../src/modules/auth/password-policy.js';

describe('password policy', () => {
  it('accepts a long password with a letter and a number', () => {
    expect(passwordProblem('Correct-horse-1', 'ada@example.test')).toBeUndefined();
  });

  it('refuses short, common, and mailbox passwords without repeating them', () => {
    expect(passwordProblem('short1')).toBe('Use at least 12 characters.');
    expect(passwordProblem('password123')).toBe('Use at least 12 characters.');
    expect(passwordProblem('administrator1')).toBe('Choose a password that is harder to guess.');
    expect(passwordProblem('abcdefghijkl')).toBe('Use at least one letter and one number.');
    const message = passwordProblem('ada@example.test', 'ada@example.test');
    expect(message).toBe('Do not use the mailbox as the password.');
    expect(message).not.toContain('ada@example.test');
  });
});
