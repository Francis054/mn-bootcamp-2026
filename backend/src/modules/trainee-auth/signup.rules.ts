import { passwordProblem } from '../auth/password-policy.js';
import { emailProblem } from '../accounts/account.rules.js';
import type { Role } from '../users/role.js';

/** Same sentence for an address on the roster and one that is not. */
export const SIGNUP_ACCEPTED = {
  accepted: true,
  message:
    'If this email is on the cohort list, we sent a link. If you do not see it, request another from the verification page.',
} as const;

export const SIGNUP_LIMIT = 'Too many requests. Try again later.';

export const VERIFY_OK = {
  verified: true,
  message: 'Email confirmed. Sign in to continue.',
} as const;

export const VERIFY_PROBLEM = 'This confirmation link is missing, used, or expired.';

export const EMAIL_NOT_VERIFIED =
  'Confirm your email before you sign in. You can request another link.';

const HOUR_MS = 60 * 60 * 1000;

/** Three accepted signup posts per email, then the throttle locks. */
export const SIGNUP_EMAIL_LIMIT = 3;
/** Five accepted signup posts per address, then the throttle locks. */
export const SIGNUP_IP_LIMIT = 5;
export const RESEND_EMAIL_LIMIT = 3;
export const RESEND_IP_LIMIT = 10;
export const SIGNUP_LOCK_MS = HOUR_MS;

export interface SignupFields {
  email: string;
  password: string;
  displayName: string;
}

export type SignupParse =
  | { ok: true; fields: SignupFields }
  | { ok: false; problems: Record<string, string> };

export type RosterUser = { role: Role; verified: boolean };

/**
 * What signup does after the password is accepted.
 * A staff mailbox and a verified trainee get the "already registered" mail.
 * An unverified trainee on the roster is replaced. Anyone else waits for an administrator.
 */
export type SignupDecision =
  | { kind: 'already-registered' }
  | { kind: 'roster' }
  | { kind: 'pending' };

export function signupDecision(traineeOnRoster: boolean, user: RosterUser | null): SignupDecision {
  if (user && (user.role !== 'trainee' || user.verified)) return { kind: 'already-registered' };
  if (traineeOnRoster) return { kind: 'roster' };
  return { kind: 'pending' };
}

export function parseSignup(body: unknown): SignupParse {
  if (!isRecord(body)) return { ok: false, problems: { form: 'Check the highlighted fields.' } };
  const problems: Record<string, string> = {};
  const email = typeof body.email === 'string' ? body.email : '';
  const emailIssue = emailProblem(email);
  if (emailIssue) problems.email = emailIssue;
  const password = typeof body.password === 'string' ? body.password : '';
  const confirm = typeof body.confirm === 'string' ? body.confirm : '';
  const normalized = email.trim().toLowerCase();
  if (password.length === 0) problems.password = 'Choose a password.';
  else {
    const issue = passwordProblem(password, normalized);
    if (issue) problems.password = issue;
  }
  if (password !== confirm) problems.confirm = 'The two passwords do not match.';
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  if (displayName.length > 120) problems.displayName = 'Use at most 120 characters.';
  if (body.acceptTerms !== true) {
    problems.acceptTerms = 'Tick to confirm you are creating a trainee account.';
  }
  if (Object.keys(problems).length > 0) return { ok: false, problems };
  return { ok: true, fields: { email: normalized, password, displayName } };
}

export function parseResend(body: unknown): { ok: true; email: string } | { ok: false; problems: Record<string, string> } {
  if (!isRecord(body)) return { ok: false, problems: { email: 'Enter your email address.' } };
  const email = typeof body.email === 'string' ? body.email : '';
  const issue = emailProblem(email);
  if (issue) return { ok: false, problems: { email: issue } };
  return { ok: true, email: email.trim().toLowerCase() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
