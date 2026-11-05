import { ApiError } from '../../shared/errors/api-error.js';
import type { AuditRepository } from '../auth/audit.repository.js';
import { TOO_MANY_REQUESTS } from '../auth/login-throttle.js';
import type { LoginThrottleRepository } from '../auth/login-throttle.repository.js';
import { readSettings } from '../content/content.rules.js';
import type { ContentRepository } from '../content/content.repository.js';
import type { EmailProvider } from '../mail/email-provider.js';
import { enquiryLetter } from '../mail/letters.js';
import type { EnquiryEntity } from './enquiry.entity.js';
import type { EnquiryRepository } from './enquiry.repository.js';
import {
  companyField,
  honeypotFilled,
  isUuid,
  newEnquiryId,
  parseEnquiry,
  SAVED,
  SAVED_NO_MAIL,
} from './enquiry.rules.js';

const CHECK = 'Check the highlighted fields.';
const MISSING = 'Enquiry not found.';

export interface EnquiryRecord {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  createdAt: string;
  handled: boolean;
  notified: boolean;
}

export interface EnquiryPublicResult {
  id: string;
  delivered: boolean;
  message: string;
}

/**
 * The public contact form and the administrator inbox.
 * A filled honeypot looks like success and is not stored.
 */
export class EnquiryService {
  constructor(
    private readonly enquiries: EnquiryRepository,
    private readonly content: ContentRepository,
    private readonly mail: EmailProvider,
    private readonly throttles: LoginThrottleRepository,
    private readonly audits: AuditRepository,
    private readonly limits: { failureLimit: number; lockMs: number },
  ) {}

  async create(input: {
    body: unknown;
    ip: string;
    requestId: string;
    now: Date;
  }): Promise<EnquiryPublicResult> {
    const ip = input.ip.slice(0, 64);
    await this.consume(ip, input.now);
    if (honeypotFilled(companyField(input.body))) {
      return { id: newEnquiryId(), delivered: false, message: SAVED_NO_MAIL };
    }
    const parsed = parseEnquiry(input.body);
    if (!parsed.ok) throw new ApiError('validation', CHECK, parsed.problems);
    const saved = await this.enquiries.insert({
      name: parsed.fields.name,
      email: parsed.fields.email,
      topic: parsed.fields.topic,
      message: parsed.fields.message,
      handled: false,
      notified: false,
    });
    const delivered = await this.notify(saved);
    if (delivered) await this.enquiries.setNotified(saved.id, true);
    await this.audits.record({
      action: 'enquiry.created',
      actorUserId: null,
      ip,
      requestId: input.requestId.slice(0, 80),
      subjectType: 'enquiry',
      subjectId: saved.id,
    });
    return {
      id: saved.id,
      delivered,
      message: delivered ? SAVED : SAVED_NO_MAIL,
    };
  }

  async list(): Promise<EnquiryRecord[]> {
    const rows = await this.enquiries.listNewest();
    return rows.map((row) => toRecord(row));
  }

  async setHandled(input: {
    id: string;
    body: unknown;
    actorId: string;
    ip: string;
    requestId: string;
  }): Promise<EnquiryRecord> {
    const row = await this.require(input.id);
    const handled = readHandled(input.body);
    await this.enquiries.setHandled(row.id, handled);
    const next = await this.enquiries.findById(row.id);
    if (!next) throw new ApiError('not_found', MISSING);
    await this.audits.record({
      action: 'enquiry.updated',
      actorUserId: input.actorId,
      ip: input.ip.slice(0, 64),
      requestId: input.requestId.slice(0, 80),
      subjectType: 'enquiry',
      subjectId: row.id,
    });
    return toRecord(next);
  }

  async remove(input: {
    id: string;
    actorId: string;
    ip: string;
    requestId: string;
  }): Promise<{ deleted: true; id: string }> {
    const row = await this.require(input.id);
    await this.enquiries.deleteById(row.id);
    await this.audits.record({
      action: 'enquiry.deleted',
      actorUserId: input.actorId,
      ip: input.ip.slice(0, 64),
      requestId: input.requestId.slice(0, 80),
      subjectType: 'enquiry',
      subjectId: row.id,
    });
    return { deleted: true, id: row.id };
  }

  private async require(id: string): Promise<EnquiryEntity> {
    if (!isUuid(id)) throw new ApiError('not_found', MISSING);
    const row = await this.enquiries.findById(id);
    if (!row) throw new ApiError('not_found', MISSING);
    return row;
  }

  private async consume(ip: string, now: Date): Promise<void> {
    const key = `enquiry:${ip}`;
    if (await this.throttles.isLocked(key, now)) {
      throw new ApiError('rate_limited', TOO_MANY_REQUESTS);
    }
    const state = await this.throttles.recordFailure(
      key,
      now,
      this.limits.failureLimit,
      this.limits.lockMs,
    );
    if (state === 'locked') throw new ApiError('rate_limited', TOO_MANY_REQUESTS);
  }

  private async notify(row: EnquiryEntity): Promise<boolean> {
    const to = await this.contactAddress();
    if (!to) return false;
    const letter = enquiryLetter(row.topic, row.message);
    try {
      const result = await this.mail.send({
        to,
        subject: letter.subject,
        text: letter.text,
        html: letter.html,
        kind: 'enquiry',
      });
      return result.delivered;
    } catch {
      return false;
    }
  }

  private async contactAddress(): Promise<string | null> {
    const row = await this.content.findById('settings');
    if (!row) return null;
    const settings = readSettings(row.draft);
    if (!settings) return null;
    const email = settings.contactEmail.trim().toLowerCase();
    return email.length > 0 ? email : null;
  }
}

function toRecord(row: EnquiryEntity): EnquiryRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    topic: row.topic,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    handled: row.handled,
    notified: row.notified,
  };
}

function readHandled(body: unknown): boolean {
  if (!isRecord(body) || typeof body.handled !== 'boolean') {
    throw new ApiError('validation', CHECK, { handled: 'Say whether the message is handled.' });
  }
  return body.handled;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
