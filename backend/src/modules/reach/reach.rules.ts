const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const CONTACT_SAVED =
  'Your message is saved and has been passed on. The trainee’s email address stays private.';
export const CONTACT_SAVED_NO_MAIL =
  'Your message is saved. Email is not set up on this site yet, so it was not sent. Staff can still read it. The trainee’s email address stays private.';
export const CV_REQUEST_SENT =
  'Your request is saved. A short download link was sent to your email. The trainee’s email address stays private.';
export const CV_REQUEST_SAVED_NO_MAIL =
  'Your request is saved. Email is not set up on this site yet, so the download link was not sent. Staff can send it when email is available. The trainee’s email address stays private.';

export const SENDER_HOUR_LIMIT = 3;
export const TRAINEE_DAY_LIMIT = 10;
export const IP_HOUR_LIMIT = 12;
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

export interface ReachFields {
  name: string;
  email: string;
  organisation: string;
  message: string;
}

export function parseReachForm(
  body: unknown,
  messageMin: number,
): { ok: true; fields: ReachFields } | { ok: false; problems: Record<string, string> } {
  if (!isRecord(body)) return { ok: false, problems: { form: 'Check the highlighted fields.' } };
  const problems: Record<string, string> = {};
  const name = text(body.name);
  const email = text(body.email).toLowerCase();
  const organisation = text(body.organisation);
  const message = text(body.message);

  if (!name) problems.name = 'Enter your name.';
  else if (name.length > 120) problems.name = 'Use at most 120 characters.';

  if (!email) problems.email = 'Enter your email address.';
  else if (email.length > 320 || !EMAIL.test(email)) {
    problems.email = 'Enter a valid email address, like name@example.com.';
  }

  if (organisation.length > 160) problems.organisation = 'Use at most 160 characters.';

  if (!message) problems.message = 'Write a short message.';
  else if (message.length < messageMin) problems.message = `Use at least ${messageMin} characters.`;
  else if (message.length > 2000) problems.message = 'Use at most 2000 characters.';

  if (Object.keys(problems).length > 0) return { ok: false, problems };
  return { ok: true, fields: { name, email, organisation, message } };
}

/** Saved, forwarded, or failed. A missing mail account stays "new" so staff can send it later. */
export function deliveryState(
  configured: boolean,
  delivered: boolean,
): 'new' | 'forwarded' | 'failed' {
  if (!configured) return 'new';
  return delivered ? 'forwarded' : 'failed';
}

export function contactMessage(status: 'new' | 'forwarded' | 'failed'): string {
  return status === 'forwarded' ? CONTACT_SAVED : CONTACT_SAVED_NO_MAIL;
}

export function cvRequestMessage(status: 'new' | 'sent' | 'failed'): string {
  return status === 'sent' ? CV_REQUEST_SENT : CV_REQUEST_SAVED_NO_MAIL;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
