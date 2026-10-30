import { ApiError } from '@/domain/types';
import { getState, updateState } from './store';
import { readActiveSession } from './session';

export interface FailedEmailRow {
  id: string;
  traineeId: string | null;
  kind: string;
  to: string;
  subject: string;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RemovalItemRow {
  id: string;
  kind: string;
  label: string;
  status: 'pending' | 'deleted' | 'failed';
  error: string | null;
  attempts: number;
}

export interface RemovalReportRow {
  removalId: string;
  traineeId: string;
  displayName: string;
  database: { status: 'pending' | 'deleted' | 'failed'; error: string | null };
  items: RemovalItemRow[];
}

let failed: FailedEmailRow[] = [sampleFailure()];
let removals: RemovalReportRow[] = [];

export function resetPrivacyDev(): void {
  failed = [sampleFailure()];
  removals = [];
}

export function privacyRoute(method: string, path: string, body: Record<string, unknown>): unknown | undefined {
  if (method === 'GET' && path === '/admin/email-outbox/failed') {
    requireAdministrator();
    return failed.filter((row) => row.status !== 'sent');
  }
  if (method === 'POST' && /^\/admin\/email-outbox\/[^/]+\/resend$/.test(path)) {
    requireAdministrator();
    const id = path.split('/')[3] ?? '';
    const row = failed.find((item) => item.id === id);
    if (!row || row.status === 'sent') throw new ApiError('not_found', 'That message was not found.', 404);
    row.status = 'sent';
    row.lastError = null;
    row.attempts = 1;
    return { id, delivered: true };
  }
  if (method === 'GET' && path === '/admin/trainee-removals') {
    requireAdministrator();
    return removals.filter((row) => row.database.status !== 'deleted' || row.items.some((item) => item.status === 'failed'));
  }
  if (method === 'POST' && /^\/admin\/trainee-removals\/[^/]+\/retry$/.test(path)) {
    requireAdministrator();
    const id = path.split('/')[3] ?? '';
    const row = removals.find((item) => item.removalId === id);
    if (!row) throw new ApiError('not_found', 'That removal was not found.', 404);
    row.items = row.items.map((item) => ({ ...item, status: 'deleted', error: null, attempts: item.attempts + 1 }));
    row.database = { status: 'deleted', error: null };
    return row;
  }
  if (method === 'GET' && /^\/admin\/trainees\/[^/]+\/export$/.test(path)) {
    requireAdministrator();
    const id = path.split('/')[3] ?? '';
    const trainee = getState().trainees.find((item) => item.id === id);
    if (!trainee) throw new ApiError('not_found', 'Trainee not found.', 404);
    const text = `${JSON.stringify({
      exportedAt: '2026-10-30T12:00:00.000Z',
      profile: { email: trainee.email, display_name: trainee.displayName },
      consents: [],
      skills: [],
      labs: [],
      projects: [],
      events: [],
      milestones: [],
      contactRequests: [],
      cvRequests: [],
      emailOutbox: [],
      cv: { fileName: null, includedFile: null, error: null },
    }, null, 2)}\n`;
    return { filename: `trainee-${id}-data.json`, text };
  }
  if (method === 'POST' && /^\/admin\/trainees\/[^/]+\/erase$/.test(path)) {
    requireAdministrator();
    const id = path.split('/')[3] ?? '';
    const trainee = getState().trainees.find((item) => item.id === id);
    if (!trainee) throw new ApiError('not_found', 'Trainee not found.', 404);
    const confirmation = typeof body.confirmation === 'string' ? body.confirmation.trim() : '';
    if (confirmation !== trainee.displayName.trim()) {
      throw new ApiError('validation', 'Check the highlighted fields.', 422, {
        confirmation: 'Type the trainee’s display name to confirm.',
      });
    }
    const report: RemovalReportRow = {
      removalId: `removal-${id}`,
      traineeId: id,
      displayName: trainee.displayName,
      database: { status: 'deleted', error: null },
      items: [
        { id: 'cv-1', kind: 'cv', label: 'CV file', status: 'deleted', error: null, attempts: 1 },
        { id: 'photo-1', kind: 'profile_photo', label: 'Profile photo', status: 'deleted', error: null, attempts: 1 },
      ],
    };
    removals = [report, ...removals.filter((item) => item.traineeId !== id)];
    updateState((state) => ({ ...state, trainees: state.trainees.filter((item) => item.id !== id) }));
    return report;
  }
  return undefined;
}

function sampleFailure(): FailedEmailRow {
  return {
    id: 'mail-1',
    traineeId: '1',
    kind: 'verification',
    to: 'trainee01@example.test',
    subject: 'Confirm your Maxim Nyansa trainee account',
    status: 'failed',
    attempts: 5,
    maxAttempts: 5,
    lastError: 'The mail provider refused the message.',
    nextAttemptAt: null,
    createdAt: '2026-10-30T08:00:00.000Z',
    updatedAt: '2026-10-30T09:00:00.000Z',
  };
}

function requireAdministrator(): void {
  const session = readActiveSession();
  if (!session) throw new ApiError('unauthenticated', 'Sign in to continue.', 401);
  const record = getState().users.find((user) => user.id === session.user.id);
  if (!record || record.role !== 'administrator') {
    throw new ApiError('forbidden', 'You do not have access to that.', 403);
  }
}
