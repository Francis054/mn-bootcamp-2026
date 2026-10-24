import { createHash, randomBytes } from 'node:crypto';
import { passwordProblem } from '../auth/password-policy.js';
import { isRole } from '../users/role.js';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const RESET_TTL_MS = 15 * 60 * 1000;
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export const RESET_LINK_PROBLEM = 'This reset link is missing, used or expired.';

/** The same object for a mailbox that exists and one that does not. */
export const RESET_ACCEPTED = {
  accepted: true,
  delivered: false,
  message: 'If an account exists for that address, a reset message will be sent.',
} as const;

export const PASSWORD_SAVED = {
  completed: true,
  passwordStored: true,
  message: 'The password is saved. Sign in with the new password.',
} as const;

export const PASSWORD_CHANGED = {
  changed: true,
  message: 'The password is saved. Other sessions were signed out.',
} as const;

export function emailProblem(email: string): string | undefined {
  const value = email.trim().toLowerCase();
  if (value.length === 0) return 'Enter your email address.';
  if (value.length > 320 || !EMAIL.test(value)) {
    return 'Enter a valid email address, like name@example.com.';
  }
  return undefined;
}

export function mailboxDigest(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

/**
 * A password nobody knows, long enough for the stored-password rule.
 * The invitation link replaces it.
 */
export function unusablePassword(): string {
  return `Invite-${randomBytes(24).toString('base64url')}9`;
}

export function changePasswordProblems(input: {
  current: string;
  next: string;
  confirm: string;
  email: string;
}): Record<string, string> {
  const problems: Record<string, string> = {};
  if (input.current.length === 0) problems.current = 'Enter your current password.';
  if (input.next.length === 0) problems.next = 'Choose a new password.';
  else {
    const issue = passwordProblem(input.next, input.email);
    if (issue) problems.next = issue;
  }
  if (input.next !== input.confirm) problems.confirm = 'The two passwords do not match.';
  return problems;
}

export function newPasswordProblems(
  password: string,
  confirm: string,
  email: string,
): Record<string, string> {
  const problems: Record<string, string> = {};
  if (password.length === 0) problems.password = 'Choose a new password.';
  else {
    const issue = passwordProblem(password, email);
    if (issue) problems.password = issue;
  }
  if (password !== confirm) problems.confirm = 'The two passwords do not match.';
  return problems;
}

export function inviteProblems(email: string, role: string): Record<string, string> {
  const problems: Record<string, string> = {};
  const emailIssue = emailProblem(email);
  if (emailIssue) problems.email = emailIssue;
  if (role.length === 0) problems.role = 'Choose a role.';
  else if (!isRole(role)) problems.role = 'Choose viewer, editor or administrator.';
  return problems;
}

export function readText(body: unknown, key: string): string {
  if (!isRecord(body) || !Object.prototype.hasOwnProperty.call(body, key)) return '';
  const value = body[key];
  return typeof value === 'string' ? value : '';
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
