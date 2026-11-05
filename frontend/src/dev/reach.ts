import { ApiError } from '@/domain/types';
import { can } from '@/domain/permissions';
import { newId } from '@/domain/format';
import { isPubliclyListable } from '@/domain/publish';
import { cvRequestAllowed, readPublicCv } from '@/domain/cv';
import { toPublicTrainee } from '@/domain/publicView';
import { readActiveSession } from './session';
import { getState } from './store';
import { publicCvFor } from './cv';

interface StoredContact {
  id: string;
  traineeId: string;
  traineeName: string;
  fromName: string;
  fromOrg: string;
  fromEmail: string;
  message: string;
  status: 'new' | 'forwarded' | 'blocked' | 'failed';
  forwardedAt: string | null;
  createdAt: string;
}

interface StoredCvRequest {
  id: string;
  traineeId: string;
  traineeName: string;
  fromName: string;
  fromOrg: string;
  fromEmail: string;
  message: string;
  status: 'new' | 'sent' | 'blocked' | 'failed';
  sentAt: string | null;
  createdAt: string;
}

const contacts: StoredContact[] = [];
const cvRequests: StoredCvRequest[] = [];
const blocked = new Set<string>();

const SAVED = 'Your message is saved. Email is not set up in this preview, so it was not sent. Staff can still read it. The trainee’s email address stays private.';

export function resetReachDev(): void {
  contacts.splice(0, contacts.length);
  cvRequests.splice(0, cvRequests.length);
  blocked.clear();
}

export function reachRoute(method: string, path: string, body: Record<string, unknown>): unknown | undefined {
  const contact = /^\/public\/trainees\/([^/]+)\/contact$/.exec(path);
  if (contact && method === 'POST') return saveContact(decodeURIComponent(contact[1] ?? ''), body);
  const cv = /^\/public\/trainees\/([^/]+)\/cv-request$/.exec(path);
  if (cv && method === 'POST') return saveCv(decodeURIComponent(cv[1] ?? ''), body);
  if (path === '/admin/contact-requests' && method === 'GET') {
    requireStaff();
    return contacts.map(withoutTraineeEmail);
  }
  const block = /^\/admin\/contact-requests\/([^/]+)\/block$/.exec(path);
  if (block && method === 'POST') return blockSender(decodeURIComponent(block[1] ?? ''));
  if (path === '/admin/cv-requests' && method === 'GET') {
    requireStaff();
    return cvRequests.map(withoutTraineeEmail);
  }
  const send = /^\/admin\/cv-requests\/([^/]+)\/send$/.exec(path);
  if (send && method === 'POST') return markSent(decodeURIComponent(send[1] ?? ''));
  return undefined;
}

function saveContact(traineeId: string, body: Record<string, unknown>) {
  if (honeypot(body)) return { saved: true, delivered: false, message: SAVED };
  const fields = readFields(body, 20);
  const trainee = publicTrainee(traineeId);
  if (!trainee.contactAvailable) fail('This trainee is not accepting messages through the site.');
  if (blocked.has(fields.email)) return { saved: true, delivered: false, message: SAVED };
  contacts.unshift({
    id: newId('contact'),
    traineeId: trainee.id,
    traineeName: trainee.displayName,
    fromName: fields.name,
    fromOrg: fields.organisation,
    fromEmail: fields.email,
    message: fields.message,
    status: 'new',
    forwardedAt: null,
    createdAt: new Date().toISOString(),
  });
  return { saved: true, delivered: false, message: SAVED };
}

function saveCv(traineeId: string, body: Record<string, unknown>) {
  if (honeypot(body)) return { saved: true, delivered: false, message: SAVED };
  const fields = readFields(body, 10);
  const trainee = publicTrainee(traineeId);
  const cv = readPublicCv(publicCvFor(trainee.id));
  if (!cvRequestAllowed(cv)) fail('That CV is not available to request.');
  if (blocked.has(fields.email)) return { saved: true, delivered: false, message: SAVED };
  cvRequests.unshift({
    id: newId('cvreq'),
    traineeId: trainee.id,
    traineeName: trainee.displayName,
    fromName: fields.name,
    fromOrg: fields.organisation,
    fromEmail: fields.email,
    message: fields.message,
    status: 'new',
    sentAt: null,
    createdAt: new Date().toISOString(),
  });
  return { saved: true, delivered: false, message: SAVED };
}

function blockSender(id: string) {
  requireWrite();
  const row = contacts.find((item) => item.id === id);
  if (!row) fail('That message was not found.');
  row.status = 'blocked';
  blocked.add(row.fromEmail);
  return withoutTraineeEmail(row);
}

function markSent(id: string) {
  requireWrite();
  const row = cvRequests.find((item) => item.id === id);
  if (!row) fail('That request was not found.');
  return withoutTraineeEmail(row);
}

function publicTrainee(id: string) {
  const row = getState().trainees.find((item) => item.id === id || item.slug === id);
  if (!row || !isPubliclyListable(row)) fail('That page is not available.');
  const pub = toPublicTrainee(row);
  if ('email' in pub) delete (pub as { email?: string }).email;
  return pub;
}

function readFields(body: Record<string, unknown>, messageMin: number) {
  const problems: Record<string, string> = {};
  const name = text(body.name);
  const email = text(body.email).toLowerCase();
  const organisation = text(body.organisation);
  const message = text(body.message);
  if (!name) problems.name = 'Enter your name.';
  else if (name.length > 120) problems.name = 'Use at most 120 characters.';
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.email = 'Enter a valid email address, like name@example.com.';
  if (organisation.length > 160) problems.organisation = 'Use at most 160 characters.';
  if (!message) problems.message = 'Write a short message.';
  else if (message.length < messageMin) problems.message = `Use at least ${messageMin} characters.`;
  else if (message.length > 2000) problems.message = 'Use at most 2000 characters.';
  if (Object.keys(problems).length) {
    throw new ApiError('validation', 'Check the highlighted fields.', 422, problems);
  }
  return { name, email, organisation, message };
}

function honeypot(body: Record<string, unknown>): boolean {
  const company = body.company;
  return typeof company === 'string' ? company.trim().length > 0 : company != null && company !== '';
}

function withoutTraineeEmail<T extends object>(row: T): T {
  const copy = { ...row } as T & { email?: string };
  delete copy.email;
  return copy;
}

function requireStaff(): void {
  const session = readActiveSession();
  if (!session) throw new ApiError('unauthenticated', 'Sign in to continue.', 401);
  if (!can(session.user.role, 'content.read')) throw new ApiError('forbidden', 'You do not have access to that.', 403);
}

function requireWrite(): void {
  requireStaff();
  const session = readActiveSession();
  if (!session || !can(session.user.role, 'content.write')) {
    throw new ApiError('forbidden', 'You do not have access to that.', 403);
  }
}

function fail(message: string): never {
  throw new ApiError('not_found', message, 404);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
