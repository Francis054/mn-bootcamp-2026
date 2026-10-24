const WEAK_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  'changeme',
  'changeme1',
  'administrator',
  'administrator1',
  'letmein',
  'qwerty123',
  'welcome1',
]);

/**
 * Rules for choosing a password. Sign-in does not use this list: a failed
 * sign-in must not teach someone the policy or confirm that a mailbox exists.
 */
export function passwordProblem(password: string, email?: string): string | undefined {
  if (password.length < 12) return 'Use at least 12 characters.';
  if (password.length > 200) return 'Use at most 200 characters.';
  if (email) {
    const normalized = email.trim().toLowerCase();
    const local = normalized.split('@')[0] ?? '';
    const candidate = password.toLowerCase();
    if (candidate === normalized || (local.length >= 3 && candidate === local)) {
      return 'Do not use the mailbox as the password.';
    }
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Use at least one letter and one number.';
  }
  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    return 'Choose a password that is harder to guess.';
  }
  return undefined;
}
