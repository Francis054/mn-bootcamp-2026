import { randomUUID } from 'node:crypto';

export const ENQUIRY_TOPICS = [
  'The 2026 bootcamp',
  'Partnering or volunteering',
  'Media and photos',
  'Something else',
] as const;

export type EnquiryTopic = (typeof ENQUIRY_TOPICS)[number];

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SAVED_NO_MAIL = 'The message is saved. No email was sent.';
export const SAVED = 'The message is saved.';

export interface EnquiryFields {
  name: string;
  email: string;
  topic: EnquiryTopic;
  message: string;
}

export type EnquiryParse =
  { ok: true; fields: EnquiryFields } | { ok: false; problems: Record<string, string> };

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** A filled `company` field is the honeypot. The real form does not send it. */
export function honeypotFilled(company: unknown): boolean {
  if (company === undefined || company === null) return false;
  if (typeof company === 'string') return company.trim().length > 0;
  return true;
}

export function companyField(body: unknown): unknown {
  if (!isRecord(body) || !Object.prototype.hasOwnProperty.call(body, 'company')) return undefined;
  return body.company;
}

export function parseEnquiry(body: unknown): EnquiryParse {
  if (!isRecord(body)) return { ok: false, problems: { form: 'Check the highlighted fields.' } };
  const problems: Record<string, string> = {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (name.length === 0) problems.name = 'Enter your name.';
  else if (name.length > 120) problems.name = 'Use at most 120 characters.';

  if (email.length === 0) problems.email = 'Enter your email address.';
  else if (email.length > 320 || !EMAIL.test(email)) {
    problems.email = 'Enter a valid email address, like name@example.com.';
  }

  if (!isTopic(topic)) problems.topic = 'Choose a topic.';

  if (message.length === 0) problems.message = 'Write a short message.';
  else if (message.length < 20) problems.message = 'Use at least 20 characters.';
  else if (message.length > 5000) problems.message = 'Use at most 5000 characters.';

  if (body.consent !== true) {
    problems.consent = 'Tick to confirm you understand this message is not delivered.';
  }

  if (Object.keys(problems).length > 0 || !isTopic(topic)) {
    return { ok: false, problems };
  }
  return { ok: true, fields: { name, email, topic, message } };
}

export function newEnquiryId(): string {
  return randomUUID();
}

function isTopic(value: string): value is EnquiryTopic {
  return ENQUIRY_TOPICS.some((topic) => topic === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
