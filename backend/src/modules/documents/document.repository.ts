import { randomUUID } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import { ApiError } from '../../shared/errors/api-error.js';
import type { CvReviewStatus, CvVisibility } from './cv-rules.js';

export interface CvRow {
  id: string;
  traineeId: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  storageProvider: string;
  storageKey: string;
  visibility: CvVisibility;
  reviewStatus: CvReviewStatus;
  rejectionReason: string;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  createdAt: Date;
  traineeName: string;
}

export interface NewCvRow {
  traineeId: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  storageProvider: string;
  storageKey: string;
  visibility: CvVisibility;
  uploadedBy: string;
}

const SELECT_ROW = `
  d.id,
  d.trainee_id AS "traineeId",
  d.file_name AS "fileName",
  d.size_bytes AS "sizeBytes",
  d.sha256,
  d.storage_provider AS "storageProvider",
  d.storage_key AS "storageKey",
  d.visibility,
  d.review_status AS "reviewStatus",
  d.rejection_reason AS "rejectionReason",
  d.submitted_at AS "submittedAt",
  d.reviewed_at AS "reviewedAt",
  d.created_at AS "createdAt",
  COALESCE(t.display_name, '') AS "traineeName"
`;

export class DocumentRepository {
  constructor(private readonly dataSource: DataSource) {}

  /** Reads that do not need a lock. Writes go through `transaction`. */
  manager(): EntityManager {
    return this.dataSource.manager;
  }

  async transaction<T>(run: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(run);
  }

  async lockTrainee(manager: EntityManager, traineeId: string): Promise<boolean> {
    const rows = await this.query(manager, `SELECT id FROM trainees WHERE id = $1 FOR UPDATE`, [
      traineeId,
    ]);
    return rows.length > 0;
  }

  current(manager: EntityManager, traineeId: string): Promise<CvRow | null> {
    return this.one(
      manager,
      `SELECT ${SELECT_ROW}
       FROM trainee_documents d
       JOIN trainees t ON t.id = d.trainee_id
       WHERE t.id = $1 AND t.current_cv_id = d.id`,
      [traineeId],
    );
  }

  byId(manager: EntityManager, id: string): Promise<CvRow | null> {
    return this.one(
      manager,
      `SELECT ${SELECT_ROW}
       FROM trainee_documents d
       JOIN trainees t ON t.id = d.trainee_id AND t.current_cv_id = d.id
       WHERE d.id = $1`,
      [id],
    );
  }

  async insert(manager: EntityManager, input: NewCvRow): Promise<string> {
    const id = randomUUID();
    await this.query(
      manager,
      `INSERT INTO trainee_documents (
         id, trainee_id, kind, file_name, mime, size_bytes, sha256, storage_provider, storage_key,
         visibility, review_status, rejection_reason, submitted_at, uploaded_by
       ) VALUES ($1, $2, 'cv', $3, 'application/pdf', $4, $5, $6, $7, $8, 'pending', '', now(), $9)`,
      [
        id,
        input.traineeId,
        input.fileName,
        input.sizeBytes,
        input.sha256,
        input.storageProvider,
        input.storageKey,
        input.visibility,
        input.uploadedBy,
      ],
    );
    await this.query(manager, `UPDATE trainees SET current_cv_id = $1 WHERE id = $2`, [
      id,
      input.traineeId,
    ]);
    return id;
  }

  async replaceFile(manager: EntityManager, id: string, input: NewCvRow): Promise<void> {
    await this.query(
      manager,
      `UPDATE trainee_documents SET
         file_name = $2,
         mime = 'application/pdf',
         size_bytes = $3,
         sha256 = $4,
         storage_provider = $5,
         storage_key = $6,
         visibility = $7,
         review_status = 'pending',
         rejection_reason = '',
         submitted_at = now(),
         reviewed_at = NULL,
         reviewed_by = NULL,
         uploaded_by = $8,
         updated_at = now()
       WHERE id = $1`,
      [
        id,
        input.fileName,
        input.sizeBytes,
        input.sha256,
        input.storageProvider,
        input.storageKey,
        input.visibility,
        input.uploadedBy,
      ],
    );
  }

  async setVisibility(manager: EntityManager, id: string, visibility: CvVisibility): Promise<void> {
    await this.query(
      manager,
      `UPDATE trainee_documents SET visibility = $2, updated_at = now() WHERE id = $1`,
      [id, visibility],
    );
  }

  async review(
    manager: EntityManager,
    id: string,
    status: 'approved' | 'rejected',
    reason: string,
    reviewerId: string,
  ): Promise<void> {
    await this.query(
      manager,
      `UPDATE trainee_documents SET
         review_status = $2,
         rejection_reason = $3,
         reviewed_at = now(),
         reviewed_by = $4,
         updated_at = now()
       WHERE id = $1`,
      [id, status, reason, reviewerId],
    );
  }

  async clearCurrent(manager: EntityManager, traineeId: string, id: string): Promise<void> {
    await this.query(
      manager,
      `UPDATE trainees SET current_cv_id = NULL WHERE id = $1 AND current_cv_id = $2`,
      [traineeId, id],
    );
    await this.query(manager, `DELETE FROM trainee_documents WHERE id = $1`, [id]);
  }

  async listPending(manager: EntityManager): Promise<CvRow[]> {
    const rows = await this.query(
      manager,
      `SELECT ${SELECT_ROW}
       FROM trainee_documents d
       JOIN trainees t ON t.id = d.trainee_id AND t.current_cv_id = d.id
       WHERE d.review_status = 'pending'
       ORDER BY d.submitted_at ASC NULLS LAST, d.created_at ASC`,
      [],
    );
    return rows.map((row) => parseRow(row));
  }

  async publicRows(
    manager: EntityManager,
    traineeIds: readonly string[],
  ): Promise<Array<{ traineeId: string; visibility: CvVisibility; reviewStatus: CvReviewStatus }>> {
    if (traineeIds.length === 0) return [];
    const rows = await this.query(
      manager,
      `SELECT t.id AS "traineeId", d.visibility, d.review_status AS "reviewStatus"
       FROM trainees t
       JOIN trainee_documents d ON d.id = t.current_cv_id
       WHERE t.id = ANY($1::varchar[])`,
      [traineeIds],
    );
    return rows.flatMap((row) => {
      if (!isRecord(row) || typeof row.traineeId !== 'string') return [];
      if (!isVisibility(row.visibility) || !isReview(row.reviewStatus)) return [];
      return [
        { traineeId: row.traineeId, visibility: row.visibility, reviewStatus: row.reviewStatus },
      ];
    });
  }

  async recordConsent(
    manager: EntityManager,
    input: {
      traineeId: string;
      scope: 'cv_public' | 'cv_on_request';
      granted: boolean;
      source: 'self' | 'admin';
      policyVersion: string;
      wording: string;
      recordedBy: string;
    },
  ): Promise<void> {
    await this.query(
      manager,
      `INSERT INTO trainee_consents (trainee_id, scope, granted, source, policy_version, wording, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.traineeId,
        input.scope,
        input.granted,
        input.source,
        input.policyVersion,
        input.wording,
        input.recordedBy,
      ],
    );
  }

  private async one(manager: EntityManager, sql: string, params: unknown[]): Promise<CvRow | null> {
    const rows = await this.query(manager, sql, params);
    const first = rows[0];
    if (!first) return null;
    return parseRow(first);
  }

  private async query(manager: EntityManager, sql: string, params: unknown[]): Promise<unknown[]> {
    const value: unknown = await manager.query(sql, params);
    if (!Array.isArray(value)) return [];
    const rows: unknown[] = [];
    for (const entry of value) {
      const item: unknown = entry;
      rows.push(item);
    }
    return rows;
  }
}

function parseRow(value: unknown): CvRow {
  if (!isRecord(value)) throw new ApiError('server', 'The CV could not be read.');
  const id = text(value.id);
  const traineeId = text(value.traineeId);
  const fileName = text(value.fileName);
  const sha256 = text(value.sha256);
  const storageProvider = text(value.storageProvider);
  const storageKey = text(value.storageKey);
  const traineeName = typeof value.traineeName === 'string' ? value.traineeName : '';
  if (!id || !traineeId || !fileName || !sha256 || !storageProvider || !storageKey) {
    throw new ApiError('server', 'The CV could not be read.');
  }
  if (!isVisibility(value.visibility) || !isReview(value.reviewStatus)) {
    throw new ApiError('server', 'The CV could not be read.');
  }
  return {
    id,
    traineeId,
    fileName,
    sizeBytes: asInt(value.sizeBytes),
    sha256,
    storageProvider,
    storageKey,
    visibility: value.visibility,
    reviewStatus: value.reviewStatus,
    rejectionReason: typeof value.rejectionReason === 'string' ? value.rejectionReason : '',
    submittedAt: asDate(value.submittedAt),
    reviewedAt: asDate(value.reviewedAt),
    createdAt: asDate(value.createdAt) ?? new Date(0),
    traineeName,
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) return Number(value);
  throw new ApiError('server', 'The CV could not be read.');
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function isVisibility(value: unknown): value is CvVisibility {
  return value === 'private' || value === 'on_request' || value === 'public';
}

function isReview(value: unknown): value is CvReviewStatus {
  return value === 'pending' || value === 'approved' || value === 'rejected';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
