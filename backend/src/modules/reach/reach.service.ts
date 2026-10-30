import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { ApiError } from '../../shared/errors/api-error.js';
import { companyField, honeypotFilled } from '../enquiries/enquiry.rules.js';
import type { AuditRepository } from '../auth/audit.repository.js';
import type { EmailProvider } from '../mail/email-provider.js';
import type { CvService } from '../documents/cv.service.js';
import type { DocumentRepository } from '../documents/document.repository.js';
import { cvRequestAllowed, HIDDEN_CV, publicCvFrom } from '../documents/cv-rules.js';
import { cvRateLimit } from '../documents/cv-rate-limit.js';
import type { TraineeService } from '../trainees/trainee.service.js';
import { buildProfilePdf, profilePdfInput } from './profile-pdf.js';
import type { ReachRepository } from './reach.repository.js';
import {
  contactMessage,
  cvRequestMessage,
  DAY_MS,
  deliveryState,
  HOUR_MS,
  IP_HOUR_LIMIT,
  parseReachForm,
  SENDER_HOUR_LIMIT,
  TRAINEE_DAY_LIMIT,
} from './reach.rules.js';

const CHECK = 'Check the highlighted fields.';
const QUIET = 'Your message is saved. The trainee’s email address stays private.';
const TOO_MANY = 'Too many requests. Wait and try again.';

export interface ReachResult {
  saved: true;
  delivered: boolean;
  message: string;
}

export interface ContactAdminRow {
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

export interface CvRequestAdminRow {
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

/**
 * Employer contact and CV requests. Responses name the trainee and never include the trainee's email.
 */
export class ReachService {
  readonly publicLimit: RequestHandler;

  constructor(
    private readonly reach: ReachRepository,
    private readonly trainees: TraineeService,
    private readonly documents: DocumentRepository,
    private readonly cvs: CvService,
    private readonly mail: EmailProvider,
    private readonly audit: AuditRepository,
    private readonly secret: string | undefined,
    private readonly siteUrl: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.publicLimit = cvRateLimit({
      windowMs: HOUR_MS,
      max: 30,
      message: TOO_MANY,
    });
  }

  async profilePdf(slugOrId: string): Promise<Uint8Array> {
    const trainee = await this.trainees.getPublic(slugOrId);
    const base = this.siteUrl.replace(/\/$/, '');
    const profileUrl = `${base}/trainees/${trainee.slug || trainee.id}`;
    const generatedOn = this.now().toISOString().slice(0, 10);
    return buildProfilePdf(profilePdfInput(trainee, profileUrl, generatedOn));
  }

  async contact(input: {
    slugOrId: string;
    body: unknown;
    ip: string;
    requestId: string;
  }): Promise<ReachResult> {
    if (honeypotFilled(companyField(input.body))) {
      return { saved: true, delivered: false, message: QUIET };
    }
    const parsed = parseReachForm(input.body, 20);
    if (!parsed.ok) throw new ApiError('validation', CHECK, parsed.problems);
    const fields = parsed.fields;
    const row = await this.trainees.requirePublic(input.slugOrId);
    if (!row.contactConsent) {
      throw new ApiError('not_found', 'This trainee is not accepting messages through the site.');
    }
    if (await this.reach.senderBlocked(fields.email)) {
      return { saved: true, delivered: false, message: QUIET };
    }
    await this.guardContact(fields.email, row.id, input.ip);
    const status = await this.forwardContact(row.email, row.displayName, fields);
    const id = await this.reach.insertContact({
      traineeId: row.id,
      fromName: fields.name,
      fromOrg: fields.organisation,
      fromEmail: fields.email,
      message: fields.message,
      status,
      forwardedAt: status === 'forwarded' ? this.now() : null,
      ipHash: this.hashIp(input.ip),
    });
    await this.audit.record({
      action: 'contact.created',
      actorUserId: null,
      ip: input.ip.slice(0, 64),
      requestId: input.requestId.slice(0, 80),
      subjectType: 'contact_request',
      subjectId: id,
    });
    return {
      saved: true,
      delivered: status === 'forwarded',
      message: contactMessage(status),
    };
  }

  async requestCv(input: {
    slugOrId: string;
    body: unknown;
    ip: string;
    requestId: string;
  }): Promise<ReachResult> {
    if (honeypotFilled(companyField(input.body))) {
      return { saved: true, delivered: false, message: QUIET };
    }
    const parsed = parseReachForm(input.body, 10);
    if (!parsed.ok) throw new ApiError('validation', CHECK, parsed.problems);
    const fields = parsed.fields;
    const row = await this.trainees.requirePublic(input.slugOrId);
    const current = await this.documents.current(this.documents.manager(), row.id);
    const offered = current ? publicCvFrom(current.visibility, current.reviewStatus) : HIDDEN_CV;
    if (!current || !cvRequestAllowed(offered)) {
      throw new ApiError('not_found', 'That CV is not available to request.');
    }
    if (await this.reach.senderBlocked(fields.email)) {
      return { saved: true, delivered: false, message: QUIET };
    }
    await this.guardCv(fields.email, row.id, input.ip);
    const sent = await this.emailCvLink(row.id, fields.email, row.displayName);
    const status = sent.delivered ? 'sent' : this.mail.configured ? 'failed' : 'new';
    const id = await this.reach.insertCvRequest({
      traineeId: row.id,
      documentId: current.id,
      fromName: fields.name,
      fromOrg: fields.organisation,
      fromEmail: fields.email,
      message: fields.message,
      status,
      sentAt: sent.delivered ? this.now() : null,
      ipHash: this.hashIp(input.ip),
    });
    if (sent.delivered) {
      await this.notifyTraineeOfCv(row.email, fields);
    }
    await this.audit.record({
      action: 'cv.request.created',
      actorUserId: null,
      ip: input.ip.slice(0, 64),
      requestId: input.requestId.slice(0, 80),
      subjectType: 'cv_request',
      subjectId: id,
    });
    return {
      saved: true,
      delivered: sent.delivered,
      message: cvRequestMessage(
        status === 'sent' ? 'sent' : status === 'failed' ? 'failed' : 'new',
      ),
    };
  }

  async listContacts(): Promise<ContactAdminRow[]> {
    const rows = await this.reach.listContacts();
    return rows.map((row) => ({
      id: row.id,
      traineeId: row.traineeId,
      traineeName: row.traineeName,
      fromName: row.fromName,
      fromOrg: row.fromOrg,
      fromEmail: row.fromEmail,
      message: row.message,
      status: row.status,
      forwardedAt: row.forwardedAt ? row.forwardedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async blockContact(
    id: string,
    actorId: string,
    ip: string,
    requestId: string,
  ): Promise<ContactAdminRow> {
    const blocked = await this.reach.blockContact(id);
    if (!blocked) throw new ApiError('not_found', 'That message was not found.');
    await this.audit.record({
      action: 'contact.blocked',
      actorUserId: actorId,
      ip: ip.slice(0, 64),
      requestId: requestId.slice(0, 80),
      subjectType: 'contact_request',
      subjectId: id,
    });
    const rows = await this.listContacts();
    const found = rows.find((row) => row.id === id);
    if (!found) throw new ApiError('not_found', 'That message was not found.');
    return found;
  }

  async listCvRequests(): Promise<CvRequestAdminRow[]> {
    const rows = await this.reach.listCvRequests();
    return rows.map(toCvAdmin);
  }

  async sendCvRequest(
    id: string,
    actorId: string,
    ip: string,
    requestId: string,
  ): Promise<CvRequestAdminRow> {
    const row = await this.reach.findCvRequest(id);
    if (!row || row.status === 'blocked')
      throw new ApiError('not_found', 'That request was not found.');
    const trainee = await this.trainees.requirePublic(row.traineeId);
    const sent = await this.emailCvLink(trainee.id, row.fromEmail, trainee.displayName);
    if (sent.delivered) await this.reach.markCvRequest(id, 'sent', this.now());
    else if (this.mail.configured) await this.reach.markCvRequest(id, 'failed', null);
    await this.audit.record({
      action: 'cv.request.sent',
      actorUserId: actorId,
      ip: ip.slice(0, 64),
      requestId: requestId.slice(0, 80),
      subjectType: 'cv_request',
      subjectId: id,
    });
    const next = await this.reach.findCvRequest(id);
    if (!next) throw new ApiError('not_found', 'That request was not found.');
    return toCvAdmin(next);
  }

  private async forwardContact(
    traineeEmail: string,
    traineeName: string,
    fields: { name: string; email: string; organisation: string; message: string },
  ): Promise<'new' | 'forwarded' | 'failed'> {
    if (!this.mail.configured || !traineeEmail) return 'new';
    const org = fields.organisation ? ` from ${fields.organisation}` : '';
    try {
      const result = await this.mail.send({
        to: traineeEmail,
        replyTo: fields.email,
        subject: 'A message through the bootcamp site',
        text: [
          `${fields.name}${org} sent a message about ${traineeName} through the public profile.`,
          `Their address is ${fields.email}. The profile address was not shown to them.`,
          '',
          fields.message,
          '',
          'Reply to this message to answer them. Do not copy a private address into a public page.',
        ].join('\n'),
      });
      return deliveryState(true, result.delivered);
    } catch {
      return 'failed';
    }
  }

  private async emailCvLink(
    traineeId: string,
    to: string,
    traineeName: string,
  ): Promise<{ delivered: boolean }> {
    if (!this.mail.configured) return { delivered: false };
    let link: { url: string; expiresAt: string };
    try {
      link = await this.cvs.mintRequestLink(traineeId);
    } catch {
      return { delivered: false };
    }
    try {
      const result = await this.mail.send({
        to,
        subject: 'CV download link',
        text: [
          `${traineeName} is sharing a CV through the Maxim Nyansa Bootcamp site.`,
          'The link works for a limited time and then stops.',
          'It does not include the trainee’s email address.',
          '',
          link.url,
          '',
          `The link stops at ${link.expiresAt}.`,
          'If you did not ask for this, you can ignore this message.',
        ].join('\n'),
      });
      return { delivered: result.delivered };
    } catch {
      return { delivered: false };
    }
  }

  private async notifyTraineeOfCv(
    traineeEmail: string,
    fields: { name: string; email: string; organisation: string; message: string },
  ): Promise<void> {
    if (!this.mail.configured || !traineeEmail) return;
    const org = fields.organisation ? ` (${fields.organisation})` : '';
    try {
      await this.mail.send({
        to: traineeEmail,
        subject: 'Someone asked for your CV',
        text: [
          `${fields.name}${org} asked for your CV through the bootcamp site.`,
          `Their address is ${fields.email}. This note does not include the download link.`,
          '',
          fields.message,
          '',
          'You can change who can receive your CV from your portal.',
        ].join('\n'),
      });
    } catch {
      // The requester already has the outcome. A missed notice is not a failure of the request.
    }
  }

  private async guardContact(email: string, traineeId: string, ip: string): Promise<void> {
    const now = this.now();
    const hour = new Date(now.getTime() - HOUR_MS);
    const day = new Date(now.getTime() - DAY_MS);
    const bySender = await this.reach.countContacts('lower(from_email) = $1 AND created_at >= $2', [
      email,
      hour,
    ]);
    if (bySender >= SENDER_HOUR_LIMIT) throw new ApiError('rate_limited', TOO_MANY);
    const byTrainee = await this.reach.countContacts('trainee_id = $1 AND created_at >= $2', [
      traineeId,
      day,
    ]);
    if (byTrainee >= TRAINEE_DAY_LIMIT) throw new ApiError('rate_limited', TOO_MANY);
    const byIp = await this.reach.countContacts('ip_hash = $1 AND created_at >= $2', [
      this.hashIp(ip),
      hour,
    ]);
    if (byIp >= IP_HOUR_LIMIT) throw new ApiError('rate_limited', TOO_MANY);
  }

  private async guardCv(email: string, traineeId: string, ip: string): Promise<void> {
    const now = this.now();
    const hour = new Date(now.getTime() - HOUR_MS);
    const day = new Date(now.getTime() - DAY_MS);
    const bySender = await this.reach.countCvRequests(
      'lower(from_email) = $1 AND created_at >= $2',
      [email, hour],
    );
    if (bySender >= SENDER_HOUR_LIMIT) throw new ApiError('rate_limited', TOO_MANY);
    const byTrainee = await this.reach.countCvRequests('trainee_id = $1 AND created_at >= $2', [
      traineeId,
      day,
    ]);
    if (byTrainee >= TRAINEE_DAY_LIMIT) throw new ApiError('rate_limited', TOO_MANY);
    const byIp = await this.reach.countCvRequests('ip_hash = $1 AND created_at >= $2', [
      this.hashIp(ip),
      hour,
    ]);
    if (byIp >= IP_HOUR_LIMIT) throw new ApiError('rate_limited', TOO_MANY);
  }

  private hashIp(ip: string): string {
    const material = `${this.secret ?? 'reach'}\n${ip.slice(0, 64)}`;
    return createHash('sha256').update(material).digest('hex');
  }
}

function toCvAdmin(row: {
  id: string;
  traineeId: string;
  traineeName: string;
  fromName: string;
  fromOrg: string;
  fromEmail: string;
  message: string;
  status: CvRequestAdminRow['status'];
  sentAt: Date | null;
  createdAt: Date;
}): CvRequestAdminRow {
  return {
    id: row.id,
    traineeId: row.traineeId,
    traineeName: row.traineeName,
    fromName: row.fromName,
    fromOrg: row.fromOrg,
    fromEmail: row.fromEmail,
    message: row.message,
    status: row.status,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
