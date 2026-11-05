import { ApiError, type DevUser, type Trainee } from '@/domain/types';
import { newPassword, collect, emailAddress } from '@/domain/validate';
import { newId } from '@/domain/format';
import { can } from '@/domain/permissions';
import { getState, updateState } from './store';
import { readActiveSession } from './session';

export const SIGNUP_ACCEPTED = {
  accepted: true,
  message:
    'If this email is on the cohort list, we sent a link. If you do not see it, request another from the verification page.',
};

interface PendingRow {
  id: string;
  email: string;
  displayName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt: string | null;
}

interface MailRow {
  to: string;
  subject: string;
  text: string;
  html: string;
  token: string;
}

const pending: PendingRow[] = [];
const tokens = new Map<string, { email: string; expiresAt: number }>();
const sent: MailRow[] = [];
const hits = new Map<string, { count: number; lockedUntil: number }>();

export function resetTraineeAuthDev(): void {
  pending.splice(0, pending.length);
  tokens.clear();
  sent.splice(0, sent.length);
  hits.clear();
}

export function readDevMail(): readonly MailRow[] {
  return sent;
}

export function traineeAuthRoute(method: string, path: string, body: Record<string, unknown>): unknown | undefined {
  if (method === 'POST' && path === '/public/trainee-signup') return signup(body);
  if (method === 'POST' && path === '/public/trainee-signup/verify') return verify(body);
  if (method === 'POST' && path === '/public/trainee-signup/resend') return resend(body);
  if (method === 'GET' && path === '/portal/me') return portalMe();
  if (method === 'GET' && path === '/admin/pending-registrations') return listPending();
  if (method === 'POST' && /^\/admin\/pending-registrations\/[^/]+\/approve$/.test(path)) {
    return approve(path.split('/')[3] ?? '');
  }
  if (method === 'POST' && /^\/admin\/pending-registrations\/[^/]+\/reject$/.test(path)) {
    return reject(path.split('/')[3] ?? '');
  }
  if (method === 'GET' && path === '/admin/trainee-accounts') return listAccounts();
  if (method === 'POST' && /^\/admin\/trainee-accounts\/[^/]+\/disable$/.test(path)) {
    return setDisabled(path.split('/')[3] ?? '', true);
  }
  if (method === 'POST' && /^\/admin\/trainee-accounts\/[^/]+\/enable$/.test(path)) {
    return setDisabled(path.split('/')[3] ?? '', false);
  }
  if (method === 'POST' && /^\/admin\/trainee-accounts\/[^/]+\/resend-invite$/.test(path)) {
    return resendInvite(path.split('/')[3] ?? '');
  }
  return undefined;
}

function signup(body: Record<string, unknown>) {
  const email = String(body.email ?? '');
  const password = String(body.password ?? '');
  const confirm = String(body.confirm ?? '');
  const displayName = String(body.displayName ?? '').trim();
  const problems = collect({
    email: emailAddress(email),
    password: newPassword(password, email),
    confirm: password === confirm ? null : 'The two passwords do not match.',
    displayName: displayName.length > 120 ? 'Use at most 120 characters.' : null,
    acceptTerms: body.acceptTerms === true ? null : 'Tick to confirm you are creating a trainee account.',
  });
  if (Object.keys(problems).length) {
    throw new ApiError('validation', 'Check the highlighted fields.', 422, problems);
  }
  const normalized = email.trim().toLowerCase();
  consume(`signup:${normalized}`, 3);
  consume('signup-ip:dev', 5);
  if (String(body.company ?? '').trim()) return { ...SIGNUP_ACCEPTED };
  const roster = getState().trainees.find((row) => row.email.toLowerCase() === normalized);
  const existing = getState().users.find((row) => row.email === normalized);
  if (existing && (existing.role !== 'trainee' || existing.emailVerified !== false)) {
    queueMail(normalized, 'You already have a Maxim Nyansa account', '/forgot-password');
    return { ...SIGNUP_ACCEPTED, developmentVerifyPath: null };
  }
  if (roster) {
    const user = upsertTraineeUser(normalized, displayName || roster.displayName, roster.id, false);
    const link = queueMail(normalized, 'Confirm your Maxim Nyansa trainee account', '/verify-email');
    void user;
    return { ...SIGNUP_ACCEPTED, developmentVerifyPath: link };
  }
  const current = pending.find((row) => row.email === normalized);
  if (current) {
    current.displayName = displayName;
    current.status = 'pending';
    current.reviewedAt = null;
  } else {
    pending.push({
      id: newId('pending'),
      email: normalized,
      displayName,
      status: 'pending',
      createdAt: new Date().toISOString(),
      reviewedAt: null,
    });
  }
  return { ...SIGNUP_ACCEPTED, developmentVerifyPath: null };
}

function verify(body: Record<string, unknown>) {
  const token = String(body.token ?? '');
  const row = tokens.get(token);
  if (!row || row.expiresAt <= Date.now()) {
    tokens.delete(token);
    throw new ApiError('validation', 'Check the highlighted fields.', 422, {
      token: 'This confirmation link is missing, used, or expired.',
    });
  }
  tokens.delete(token);
  updateState((state) => ({
    ...state,
    users: state.users.map((user) => (user.email === row.email ? { ...user, emailVerified: true } : user)),
  }));
  return { verified: true, message: 'Email confirmed. Sign in to continue.' };
}

function resend(body: Record<string, unknown>) {
  const email = String(body.email ?? '');
  const problem = emailAddress(email);
  if (problem) throw new ApiError('validation', 'Check the highlighted fields.', 422, { email: problem });
  const normalized = email.trim().toLowerCase();
  consume(`resend:${normalized}`, 3);
  consume('resend-ip:dev', 10);
  const user = getState().users.find((row) => row.email === normalized);
  let developmentVerifyPath: string | null = null;
  if (user && user.role === 'trainee' && user.emailVerified === false && !user.disabled) {
    developmentVerifyPath = queueMail(normalized, 'Confirm your Maxim Nyansa trainee account', '/verify-email');
  }
  return { ...SIGNUP_ACCEPTED, developmentVerifyPath };
}

function portalMe() {
  const user = requirePortal();
  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      initials: user.initials,
      hue: user.hue,
      role: 'trainee' as const,
      emailVerified: user.emailVerified !== false,
      traineeId: user.traineeId ?? null,
    },
    traineeId: user.traineeId ?? null,
  };
}

function listPending() {
  requireManage();
  return pending.filter((row) => row.status === 'pending');
}

function approve(id: string) {
  requireManage();
  const row = pending.find((item) => item.id === id && item.status === 'pending');
  if (!row) throw new ApiError('not_found', 'Signup request not found.', 404);
  const roster = getState().trainees.find((item) => item.email.toLowerCase() === row.email);
  const traineeId = roster?.id ?? newId('trainee');
  if (!roster) {
    const trainee: Trainee = {
      id: traineeId,
      displayName: row.displayName || 'New trainee',
      initials: (row.displayName || 'NT').slice(0, 2).toUpperCase(),
      hue: 140,
      email: row.email,
      track: 'Blue team',
      focus: 'network',
      skills: [],
      bio: '',
      quote: '',
      linkedin: null,
      portfolio: null,
      photoUrl: null,
      consentReceived: false,
      listing: 'hidden',
      publicationStatus: 'draft',
      statusLabel: 'In training',
      internalNotes: 'Created when an administrator approved a signup that was not on the roster.',
      lessonIds: [],
    };
    updateState((state) => ({ ...state, trainees: [trainee, ...state.trainees] }));
  }
  const user = upsertTraineeUser(row.email, row.displayName || 'New trainee', traineeId, false);
  row.status = 'approved';
  row.reviewedAt = new Date().toISOString();
  const link = queueMail(row.email, 'Confirm your Maxim Nyansa trainee account', '/verify-email');
  return {
    delivered: true,
    message: 'The account is ready and a confirmation email was sent.',
    userId: user.id,
    traineeId,
    developmentVerifyPath: link,
  };
}

function reject(id: string) {
  requireManage();
  const row = pending.find((item) => item.id === id && item.status === 'pending');
  if (!row) throw new ApiError('not_found', 'Signup request not found.', 404);
  row.status = 'rejected';
  row.reviewedAt = new Date().toISOString();
  return row;
}

function listAccounts() {
  requireManage();
  return getState()
    .users.filter((user) => user.role === 'trainee')
    .map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified !== false,
      traineeId: user.traineeId ?? null,
      disabled: Boolean(user.disabled),
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
    }));
}

function setDisabled(id: string, disabled: boolean) {
  requireManage();
  const current = getState().users.find((user) => user.id === id && user.role === 'trainee');
  if (!current) throw new ApiError('not_found', 'Trainee account not found.', 404);
  updateState((state) => ({
    ...state,
    users: state.users.map((user) => (user.id === id ? { ...user, disabled } : user)),
  }));
  return listAccounts().find((user) => user.id === id);
}

function resendInvite(id: string) {
  requireManage();
  const user = getState().users.find((item) => item.id === id && item.role === 'trainee');
  if (!user) throw new ApiError('not_found', 'Trainee account not found.', 404);
  if (user.disabled) {
    throw new ApiError('validation', 'Enable the account before sending another email.', 422);
  }
  queueMail(user.email, 'Confirm your Maxim Nyansa trainee account', user.emailVerified === false ? '/verify-email' : '/forgot-password');
  return { delivered: true, message: 'The email was sent.' };
}

function upsertTraineeUser(email: string, displayName: string, traineeId: string, emailVerified: boolean): DevUser {
  const existing = getState().users.find((user) => user.email === email);
  const next: DevUser = {
    id: existing?.id ?? newId('user'),
    email,
    displayName: displayName || existing?.displayName || 'Trainee',
    initials: (displayName || 'TR').slice(0, 2).toUpperCase(),
    hue: existing?.hue ?? 140,
    role: 'trainee',
    emailVerified,
    traineeId,
    disabled: false,
  };
  updateState((state) => ({
    ...state,
    users: existing
      ? state.users.map((user) => (user.email === email ? next : user))
      : [next, ...state.users],
  }));
  return next;
}

function queueMail(email: string, subject: string, path: string): string {
  const token = newId('verify');
  tokens.set(token, { email, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
  const link = `${path}?token=${token}`;
  const text = `${subject}\n\n${link}\n`;
  sent.push({ to: email, subject, text, html: `<p><a href="${link}">${subject}</a></p>`, token });
  return link;
}

function consume(key: string, limit: number): void {
  const row = hits.get(key) ?? { count: 0, lockedUntil: 0 };
  if (row.lockedUntil > Date.now()) {
    throw new ApiError('rate_limited', 'Too many requests. Try again later.', 429);
  }
  row.count += 1;
  if (row.count > limit) {
    row.lockedUntil = Date.now() + 60 * 60 * 1000;
    row.count = 0;
    hits.set(key, row);
    throw new ApiError('rate_limited', 'Too many requests. Try again later.', 429);
  }
  hits.set(key, row);
}

function requirePortal(): DevUser {
  const session = readActiveSession();
  if (!session) throw new ApiError('unauthenticated', 'Sign in to continue.', 401);
  const user = getState().users.find((item) => item.id === session.user.id);
  if (!user || user.disabled) throw new ApiError('unauthenticated', 'Sign in to continue.', 401);
  if (!can(user.role, 'portal.access')) {
    throw new ApiError('forbidden', 'You do not have access to that.', 403);
  }
  return user;
}

function requireManage(): DevUser {
  const session = readActiveSession();
  if (!session) throw new ApiError('unauthenticated', 'Sign in to continue.', 401);
  const user = getState().users.find((item) => item.id === session.user.id);
  if (!user) throw new ApiError('unauthenticated', 'Sign in to continue.', 401);
  if (!can(user.role, 'users.manage')) {
    throw new ApiError('forbidden', 'You do not have access to that.', 403);
  }
  return user;
}
