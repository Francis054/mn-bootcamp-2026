import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';

export interface ContactRow {
  id: string;
  traineeId: string;
  traineeName: string;
  fromName: string;
  fromOrg: string;
  fromEmail: string;
  message: string;
  status: 'new' | 'forwarded' | 'blocked' | 'failed';
  forwardedAt: Date | null;
  createdAt: Date;
}

export interface CvRequestRow {
  id: string;
  traineeId: string;
  traineeName: string;
  documentId: string;
  fromName: string;
  fromOrg: string;
  fromEmail: string;
  message: string;
  status: 'new' | 'sent' | 'blocked' | 'failed';
  sentAt: Date | null;
  createdAt: Date;
}

export interface NewContact {
  traineeId: string;
  fromName: string;
  fromOrg: string;
  fromEmail: string;
  message: string;
  status: ContactRow['status'];
  forwardedAt: Date | null;
  ipHash: string;
}

export interface NewCvRequest {
  traineeId: string;
  documentId: string;
  fromName: string;
  fromOrg: string;
  fromEmail: string;
  message: string;
  status: CvRequestRow['status'];
  sentAt: Date | null;
  ipHash: string;
}

const CONTACT_LIST = `
  SELECT c.id,
         c.trainee_id AS "traineeId",
         t.display_name AS "traineeName",
         c.from_name AS "fromName",
         c.from_org AS "fromOrg",
         c.from_email AS "fromEmail",
         c.message,
         c.status,
         c.forwarded_at AS "forwardedAt",
         c.created_at AS "createdAt"
  FROM contact_requests c
  JOIN trainees t ON t.id = c.trainee_id
`;

const CV_LIST = `
  SELECT r.id,
         r.trainee_id AS "traineeId",
         t.display_name AS "traineeName",
         r.document_id AS "documentId",
         r.from_name AS "fromName",
         r.from_org AS "fromOrg",
         r.from_email AS "fromEmail",
         r.message,
         r.status,
         r.sent_at AS "sentAt",
         r.created_at AS "createdAt"
  FROM cv_requests r
  JOIN trainees t ON t.id = r.trainee_id
`;

/**
 * Employer messages and CV requests. Queries select the trainee's name, never the email.
 */
export class ReachRepository {
  constructor(private readonly dataSource: DataSource) {}

  async insertContact(input: NewContact): Promise<string> {
    const id = randomUUID();
    await this.dataSource.query(
      `INSERT INTO contact_requests
         (id, trainee_id, from_name, from_org, from_email, message, status, forwarded_at, ip_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        input.traineeId,
        input.fromName,
        input.fromOrg,
        input.fromEmail,
        input.message,
        input.status,
        input.forwardedAt,
        input.ipHash,
      ],
    );
    return id;
  }

  async listContacts(): Promise<ContactRow[]> {
    const rows: unknown = await this.dataSource.query(
      `${CONTACT_LIST} ORDER BY c.created_at DESC LIMIT 200`,
    );
    return asList(rows).map(contactRow);
  }

  async blockContact(id: string): Promise<boolean> {
    const rows: unknown = await this.dataSource.query(
      `UPDATE contact_requests SET status = 'blocked' WHERE id = $1 RETURNING id`,
      [id],
    );
    return asList(rows).length > 0;
  }

  async countContacts(where: string, params: unknown[]): Promise<number> {
    const rows: unknown = await this.dataSource.query(
      `SELECT count(*)::int AS count FROM contact_requests WHERE ${where}`,
      params,
    );
    return countOf(rows);
  }

  async insertCvRequest(input: NewCvRequest): Promise<string> {
    const id = randomUUID();
    await this.dataSource.query(
      `INSERT INTO cv_requests
         (id, trainee_id, document_id, from_name, from_org, from_email, message, status, sent_at, ip_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        input.traineeId,
        input.documentId,
        input.fromName,
        input.fromOrg,
        input.fromEmail,
        input.message,
        input.status,
        input.sentAt,
        input.ipHash,
      ],
    );
    return id;
  }

  async listCvRequests(): Promise<CvRequestRow[]> {
    const rows: unknown = await this.dataSource.query(
      `${CV_LIST} ORDER BY r.created_at DESC LIMIT 200`,
    );
    return asList(rows).map(cvRow);
  }

  async findCvRequest(id: string): Promise<CvRequestRow | null> {
    const rows: unknown = await this.dataSource.query(`${CV_LIST} WHERE r.id = $1`, [id]);
    const first = asList(rows)[0];
    return first ? cvRow(first) : null;
  }

  async markCvRequest(id: string, status: 'sent' | 'failed', sentAt: Date | null): Promise<void> {
    await this.dataSource.query(`UPDATE cv_requests SET status = $2, sent_at = $3 WHERE id = $1`, [
      id,
      status,
      sentAt,
    ]);
  }

  async countCvRequests(where: string, params: unknown[]): Promise<number> {
    const rows: unknown = await this.dataSource.query(
      `SELECT count(*)::int AS count FROM cv_requests WHERE ${where}`,
      params,
    );
    return countOf(rows);
  }

  async senderBlocked(email: string): Promise<boolean> {
    const rows: unknown = await this.dataSource.query(
      `SELECT 1 AS hit FROM contact_requests WHERE lower(from_email) = $1 AND status = 'blocked'
       UNION ALL
       SELECT 1 FROM cv_requests WHERE lower(from_email) = $1 AND status = 'blocked'
       LIMIT 1`,
      [email],
    );
    return asList(rows).length > 0;
  }
}

function contactRow(value: unknown): ContactRow {
  const row = record(value);
  return {
    id: text(row.id),
    traineeId: text(row.traineeId),
    traineeName: text(row.traineeName),
    fromName: text(row.fromName),
    fromOrg: text(row.fromOrg),
    fromEmail: text(row.fromEmail),
    message: text(row.message),
    status: contactStatus(row.status),
    forwardedAt: dateOrNull(row.forwardedAt),
    createdAt: dateOrNull(row.createdAt) ?? new Date(0),
  };
}

function cvRow(value: unknown): CvRequestRow {
  const row = record(value);
  return {
    id: text(row.id),
    traineeId: text(row.traineeId),
    traineeName: text(row.traineeName),
    documentId: text(row.documentId),
    fromName: text(row.fromName),
    fromOrg: text(row.fromOrg),
    fromEmail: text(row.fromEmail),
    message: text(row.message),
    status: cvStatus(row.status),
    sentAt: dateOrNull(row.sentAt),
    createdAt: dateOrNull(row.createdAt) ?? new Date(0),
  };
}

function contactStatus(value: unknown): ContactRow['status'] {
  if (value === 'forwarded' || value === 'blocked' || value === 'failed') return value;
  return 'new';
}

function cvStatus(value: unknown): CvRequestRow['status'] {
  if (value === 'sent' || value === 'blocked' || value === 'failed') return value;
  return 'new';
}

function countOf(value: unknown): number {
  const row = record(asList(value)[0]);
  const count = row.count;
  return typeof count === 'number' ? count : Number(count) || 0;
}

function dateOrNull(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
