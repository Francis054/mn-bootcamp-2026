import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { ApiError } from '../../shared/errors/api-error.js';
import type { AuditRepository } from '../auth/audit.repository.js';
import type { Actor } from '../curriculum/actor.js';
import type { DocumentStorage } from '../documents/document-storage.js';
import { zipStored } from '../mail/zip-store.js';
import type { CloudinaryStorage } from '../storage/cloudinary-storage.js';
import type { StorageProvider } from '../storage/storage-provider.js';

const CHECK = 'Check the highlighted fields.';
const CONFIRM = 'Type the trainee’s display name to confirm.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RemovalItemResult {
  id: string;
  kind: string;
  label: string;
  status: 'pending' | 'deleted' | 'failed';
  error: string | null;
  attempts: number;
}

export interface RemovalReport {
  removalId: string;
  traineeId: string;
  displayName: string;
  database: { status: 'pending' | 'deleted' | 'failed'; error: string | null };
  items: RemovalItemResult[];
}

interface AssetDraft {
  kind: RemovalKind;
  label: string;
  storageKey: string;
}

type RemovalKind =
  'profile_photo' | 'portfolio_image' | 'portfolio_video' | 'work_photo' | 'certificate' | 'cv';

/**
 * Administrator export and full removal for one trainee.
 * External deletes are recorded one by one. A failure stays visible
 * and can be retried. Nothing here runs on a schedule.
 */
export class TraineePrivacyService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: StorageProvider,
    private readonly videos: CloudinaryStorage | null,
    private readonly documents: DocumentStorage,
    private readonly audit: AuditRepository,
  ) {}

  async exportZip(traineeId: string, actor: Actor): Promise<{ filename: string; bytes: Buffer }> {
    const profile = await this.profile(traineeId);
    if (!profile) throw new ApiError('not_found', 'Trainee not found.');
    const email = text(profile.email);
    const [
      consents,
      skills,
      labs,
      projects,
      events,
      milestones,
      contactRequests,
      cvRequests,
      emailOutbox,
      login,
      pendingRegistrations,
      workPhotos,
      document,
    ] = await Promise.all([
      this.rows(
        `SELECT id, scope, granted, source, policy_version, wording, recorded_by, created_at
                   FROM trainee_consents WHERE trainee_id = $1 ORDER BY created_at`,
        [traineeId],
      ),
      this.rows(
        `SELECT id, slug, name, level, review_status, rejection_reason, evidence_item_id,
                        submitted_at, reviewed_at, created_at, updated_at
                   FROM trainee_skills WHERE trainee_id = $1 ORDER BY sort_order, created_at`,
        [traineeId],
      ),
      this.labs(traineeId),
      this.rows(
        `SELECT p.id, p.title, p."type", p.publication_status, p.listing
                   FROM projects p
                   JOIN project_trainees pt ON pt.project_id = p.id
                  WHERE pt.trainee_id = $1
                  ORDER BY p.title`,
        [traineeId],
      ),
      this.rows(
        `SELECT id, title, event_date, organiser, link, review_status, rejection_reason,
                        certificate_url, submitted_at, reviewed_at, created_at, updated_at
                   FROM trainee_events WHERE trainee_id = $1 ORDER BY sort_order, created_at`,
        [traineeId],
      ),
      this.rows(
        `SELECT id, title, summary, occurred_on, visibility, created_at, updated_at
                   FROM trainee_milestones WHERE trainee_id = $1 ORDER BY occurred_on, created_at`,
        [traineeId],
      ),
      this.rows(
        `SELECT id, from_name, from_org, from_email, message, status, forwarded_at, created_at
                   FROM contact_requests WHERE trainee_id = $1 ORDER BY created_at`,
        [traineeId],
      ),
      this.rows(
        `SELECT id, document_id, from_name, from_org, from_email, message, status, sent_at, created_at
                   FROM cv_requests WHERE trainee_id = $1 ORDER BY created_at`,
        [traineeId],
      ),
      this.rows(
        `SELECT id, kind, to_address, reply_to, subject, text_body, html_body, status, attempts,
                        max_attempts, last_error, next_attempt_at, sent_at, created_at
                   FROM email_outbox WHERE trainee_id = $1 ORDER BY created_at`,
        [traineeId],
      ),
      this.login(traineeId),
      email
        ? this.rows(
            `SELECT id, email, display_name, status, created_at, reviewed_at
                       FROM pending_registrations WHERE lower(email) = lower($1)`,
            [email],
          )
        : Promise.resolve([]),
      this.rows(
        `SELECT id, alt, caption, src, publication_status, listing, created_at
                   FROM work_photos WHERE trainee_id = $1 ORDER BY created_at`,
        [traineeId],
      ),
      this.one(
        `SELECT id, file_name, mime, size_bytes, visibility, review_status, storage_key, created_at
                  FROM trainee_documents WHERE trainee_id = $1 AND kind = 'cv'`,
        [traineeId],
      ),
    ]);
    let cvBytes: Buffer | null = null;
    let cvError: string | null = null;
    if (document) {
      try {
        cvBytes = await this.documents.read(text(document.storage_key));
      } catch (error) {
        cvError = safeExternal(error, 'The CV could not be read.');
      }
    }
    const body = {
      exportedAt: new Date().toISOString(),
      profile: publicProfile(profile),
      consents,
      skills,
      labs,
      projects,
      events,
      milestones,
      contactRequests,
      cvRequests,
      emailOutbox,
      login,
      pendingRegistrations,
      workPhotos,
      cv: {
        fileName: document ? text(document.file_name) : null,
        includedFile: cvBytes ? 'cv.pdf' : null,
        error: cvError,
      },
    };
    const files: { name: string; bytes: Buffer }[] = [
      { name: 'trainee.json', bytes: Buffer.from(`${JSON.stringify(body, null, 2)}\n`) },
    ];
    if (cvBytes) files.push({ name: 'cv.pdf', bytes: Buffer.from(cvBytes) });
    await this.audit.record({
      action: 'trainee.data.exported',
      actorUserId: actor.userId,
      ip: clip(actor.ip, 64),
      requestId: clip(actor.requestId, 80),
      subjectType: 'trainee',
      subjectId: traineeId,
    });
    return { filename: `${safeFileName(traineeId)}-data.zip`, bytes: zipStored(files) };
  }

  async erase(traineeId: string, body: unknown, actor: Actor): Promise<RemovalReport> {
    const trainee = await this.profile(traineeId);
    if (!trainee) throw new ApiError('not_found', 'Trainee not found.');
    const displayName = text(trainee.display_name);
    const confirmation = readConfirmation(body);
    if (confirmation !== displayName) {
      throw new ApiError('validation', CHECK, { confirmation: CONFIRM });
    }
    const open = await this.openRemoval(traineeId);
    const removalId = open ? text(open.id) : await this.openLedger(traineeId, displayName);
    const report = await this.run(removalId, displayName, actor, 'trainee.data.removed');
    return report;
  }

  async retry(removalId: string, actor: Actor): Promise<RemovalReport> {
    if (!UUID.test(removalId)) throw new ApiError('not_found', 'That removal was not found.');
    const row = await this.one(
      `SELECT id, trainee_id, display_name FROM trainee_removals WHERE id = $1`,
      [removalId],
    );
    if (!row) throw new ApiError('not_found', 'That removal was not found.');
    const trainee = await this.profile(text(row.trainee_id));
    const displayName = text(row.display_name) || text(trainee?.display_name);
    return this.run(removalId, displayName, actor, 'trainee.removal.retried');
  }

  recordResend(actor: Actor, id: string): Promise<void> {
    return this.audit.record({
      action: 'mail.outbox.resent',
      actorUserId: actor.userId,
      ip: clip(actor.ip, 64),
      requestId: clip(actor.requestId, 80),
      subjectType: 'email_outbox',
      subjectId: id.slice(0, 64),
    });
  }

  async listOpen(): Promise<RemovalReport[]> {
    const rows = await this.rows(
      `SELECT id, trainee_id, display_name
         FROM trainee_removals
        WHERE database_status <> 'deleted'
           OR EXISTS (
             SELECT 1 FROM trainee_removal_items
              WHERE removal_id = trainee_removals.id AND status = 'failed'
           )
        ORDER BY created_at DESC
        LIMIT 100`,
      [],
    );
    const reports: RemovalReport[] = [];
    for (const row of rows) {
      reports.push(await this.report(text(row.id), text(row.display_name) || text(row.trainee_id)));
    }
    return reports;
  }

  private async run(
    removalId: string,
    displayName: string,
    actor: Actor,
    action: 'trainee.data.removed' | 'trainee.removal.retried',
  ): Promise<RemovalReport> {
    const items = await this.rows(
      `SELECT id, kind, storage_key, status FROM trainee_removal_items
        WHERE removal_id = $1 AND status <> 'deleted'`,
      [removalId],
    );
    for (const item of items) {
      await this.deleteItem(item);
    }
    const header = await this.one(
      `SELECT trainee_id, database_status FROM trainee_removals WHERE id = $1`,
      [removalId],
    );
    if (header && text(header.database_status) !== 'deleted') {
      await this.deleteDatabase(text(header.trainee_id), removalId);
    }
    await this.finishIfClear(removalId);
    await this.audit.record({
      action,
      actorUserId: actor.userId,
      ip: clip(actor.ip, 64),
      requestId: clip(actor.requestId, 80),
      subjectType: 'trainee_removal',
      subjectId: removalId,
    });
    return this.report(removalId, displayName);
  }

  private async deleteItem(item: Record<string, unknown>): Promise<void> {
    const kind = text(item.kind);
    const key = text(item.storage_key);
    try {
      if (kind === 'cv') await this.documents.delete(key);
      else if (kind === 'portfolio_video' && this.videos) await this.videos.deleteVideo(key);
      else await this.storage.delete(key);
      await this.dataSource.query(
        `UPDATE trainee_removal_items
            SET status = 'deleted', error = NULL, attempts = attempts + 1, updated_at = now()
          WHERE id = $1`,
        [text(item.id)],
      );
    } catch (error) {
      await this.dataSource.query(
        `UPDATE trainee_removal_items
            SET status = 'failed', error = $2, attempts = attempts + 1, updated_at = now()
          WHERE id = $1`,
        [text(item.id), safeExternal(error, fallbackFor(kind))],
      );
    }
  }

  private async deleteDatabase(traineeId: string, removalId: string): Promise<void> {
    try {
      const trainee = await this.profile(traineeId);
      const email = trainee ? text(trainee.email) : '';
      await this.dataSource.transaction(async (manager) => {
        await manager.query(`DELETE FROM project_trainees WHERE trainee_id = $1`, [traineeId]);
        if (email) {
          await manager.query(`DELETE FROM pending_registrations WHERE lower(email) = lower($1)`, [
            email,
          ]);
        }
        await manager.query(`DELETE FROM users WHERE trainee_id = $1 AND role = 'trainee'`, [
          traineeId,
        ]);
        await manager.query(`DELETE FROM trainees WHERE id = $1`, [traineeId]);
      });
      const still = await this.profile(traineeId);
      if (still) {
        await this.markDatabase(removalId, 'failed', 'The trainee records could not be deleted.');
        return;
      }
      await this.markDatabase(removalId, 'deleted', null);
    } catch (error) {
      const code =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string'
          ? error.code
          : '';
      const message = /^[0-9A-Z]{5}$/.test(code)
        ? `The trainee records could not be deleted (${code}).`
        : 'The trainee records could not be deleted.';
      await this.markDatabase(removalId, 'failed', message);
    }
  }

  private async markDatabase(
    removalId: string,
    status: 'deleted' | 'failed',
    error: string | null,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE trainee_removals
          SET database_status = $2, database_error = $3, updated_at = now()
        WHERE id = $1`,
      [removalId, status, error],
    );
  }

  private async finishIfClear(removalId: string): Promise<void> {
    const failed = await this.rows(
      `SELECT id FROM trainee_removal_items WHERE removal_id = $1 AND status = 'failed'`,
      [removalId],
    );
    const header = await this.one(`SELECT database_status FROM trainee_removals WHERE id = $1`, [
      removalId,
    ]);
    if (failed.length === 0 && header && text(header.database_status) === 'deleted') {
      await this.dataSource.query(
        `UPDATE trainee_removals
            SET display_name = '', finished_at = now(), updated_at = now()
          WHERE id = $1`,
        [removalId],
      );
    }
  }

  private async openLedger(traineeId: string, displayName: string): Promise<string> {
    const id = randomUUID();
    const assets = await this.collectAssets(traineeId);
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO trainee_removals (id, trainee_id, display_name, database_status, created_at, updated_at)
         VALUES ($1, $2, $3, 'pending', now(), now())`,
        [id, traineeId, displayName.slice(0, 120)],
      );
      for (const asset of assets) {
        await manager.query(
          `INSERT INTO trainee_removal_items (id, removal_id, kind, label, storage_key, status, attempts, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'pending', 0, now())`,
          [randomUUID(), id, asset.kind, asset.label.slice(0, 120), asset.storageKey.slice(0, 500)],
        );
      }
    });
    return id;
  }

  private async collectAssets(traineeId: string): Promise<AssetDraft[]> {
    const seen = new Set<string>();
    const assets: AssetDraft[] = [];
    const add = (kind: RemovalKind, label: string, key: unknown) => {
      const storageKey = text(key).trim();
      if (!storageKey) return;
      const id = `${kind}:${storageKey}`;
      if (seen.has(id)) return;
      seen.add(id);
      assets.push({ kind, label, storageKey });
    };
    const trainee = await this.profile(traineeId);
    add('profile_photo', 'Profile photo', trainee?.photo_storage_key);
    add('profile_photo', 'Profile photo', trainee?.pending_photo_storage_key);
    const media = await this.rows(
      `SELECT kind, storage_key FROM portfolio_media WHERE trainee_id = $1`,
      [traineeId],
    );
    for (const row of media) {
      if (text(row.kind) === 'video_file')
        add('portfolio_video', 'Portfolio video', row.storage_key);
      else if (text(row.kind) === 'image')
        add('portfolio_image', 'Portfolio picture', row.storage_key);
    }
    const grants = await this.rows(
      `SELECT public_id FROM portfolio_video_grants WHERE trainee_id = $1 AND consumed_at IS NULL`,
      [traineeId],
    );
    for (const row of grants) add('portfolio_video', 'Portfolio video', row.public_id);
    const photos = await this.rows(
      `SELECT storage_key, storage_provider FROM work_photos WHERE trainee_id = $1`,
      [traineeId],
    );
    for (const row of photos) {
      if (text(row.storage_provider) === 'static') continue;
      add('work_photo', 'Work photo', row.storage_key);
    }
    const certificates = await this.rows(
      `SELECT certificate_storage_key, pending_certificate_storage_key
         FROM trainee_events WHERE trainee_id = $1`,
      [traineeId],
    );
    for (const row of certificates) {
      add('certificate', 'Event certificate', row.certificate_storage_key);
      add('certificate', 'Event certificate', row.pending_certificate_storage_key);
    }
    const documents = await this.rows(
      `SELECT storage_key FROM trainee_documents WHERE trainee_id = $1`,
      [traineeId],
    );
    for (const row of documents) add('cv', 'CV file', row.storage_key);
    return assets;
  }

  private async report(removalId: string, displayName: string): Promise<RemovalReport> {
    const header = await this.one(
      `SELECT trainee_id, display_name, database_status, database_error FROM trainee_removals WHERE id = $1`,
      [removalId],
    );
    if (!header) throw new ApiError('not_found', 'That removal was not found.');
    const items = await this.rows(
      `SELECT id, kind, label, status, error, attempts
         FROM trainee_removal_items WHERE removal_id = $1 ORDER BY label, id`,
      [removalId],
    );
    const databaseStatus = text(header.database_status);
    return {
      removalId,
      traineeId: text(header.trainee_id),
      displayName: displayName || text(header.display_name) || text(header.trainee_id),
      database: {
        status:
          databaseStatus === 'deleted' || databaseStatus === 'failed' ? databaseStatus : 'pending',
        error: optional(header.database_error),
      },
      items: items.map((item) => {
        const status = text(item.status);
        return {
          id: text(item.id),
          kind: text(item.kind),
          label: text(item.label),
          status: status === 'deleted' || status === 'failed' ? status : 'pending',
          error: optional(item.error),
          attempts: typeof item.attempts === 'number' ? item.attempts : Number(item.attempts ?? 0),
        };
      }),
    };
  }

  private async openRemoval(traineeId: string): Promise<Record<string, unknown> | null> {
    return this.one(
      `SELECT id FROM trainee_removals
        WHERE trainee_id = $1 AND database_status <> 'deleted'
        ORDER BY created_at DESC
        LIMIT 1`,
      [traineeId],
    );
  }

  private async profile(traineeId: string): Promise<Record<string, unknown> | null> {
    return this.one(`SELECT * FROM trainees WHERE id = $1`, [traineeId]);
  }

  private async login(traineeId: string): Promise<Record<string, unknown> | null> {
    return this.one(
      `SELECT id, email, display_name, email_verified_at, disabled_at, last_login_at, created_at
         FROM users WHERE trainee_id = $1 AND role = 'trainee'`,
      [traineeId],
    );
  }

  private async labs(traineeId: string): Promise<Record<string, unknown>[]> {
    const items = await this.rows(
      `SELECT id, kind, title, summary, skills, review_status, rejection_reason,
              repository_url, demo_url, started_on, completed_on, created_at, updated_at
         FROM portfolio_items WHERE trainee_id = $1 ORDER BY sort_order, created_at`,
      [traineeId],
    );
    const media = await this.rows(
      `SELECT id, item_id, kind, alt, public_url, sort_order
         FROM portfolio_media WHERE trainee_id = $1 ORDER BY sort_order`,
      [traineeId],
    );
    return items.map((item) => ({
      ...dates(item),
      media: media.filter((row) => text(row.item_id) === text(item.id)).map((row) => dates(row)),
    }));
  }

  private async rows(sql: string, params: unknown[]): Promise<Record<string, unknown>[]> {
    const value: unknown = await this.dataSource.query(sql, params);
    return asRecords(value).map((row) => dates(row));
  }

  private async one(sql: string, params: unknown[]): Promise<Record<string, unknown> | null> {
    const rows = await this.rows(sql, params);
    return rows[0] ?? null;
  }
}

function publicProfile(row: Record<string, unknown>): Record<string, unknown> {
  const copy = dates(row);
  delete copy.photo_storage_key;
  delete copy.pending_photo_storage_key;
  return copy;
}

function dates(row: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    copy[key] = value instanceof Date ? value.toISOString() : value;
  }
  return copy;
}

function readConfirmation(body: unknown): string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return '';
  const value = (body as Record<string, unknown>).confirmation;
  return typeof value === 'string' ? value.trim() : '';
}

function safeExternal(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : fallback;
  if (/bearer|api[_-]?key|secret|token=|service_role|eyJ[A-Za-z0-9_-]{8,}/i.test(raw))
    return fallback;
  const compact = raw.replace(/\s+/g, ' ').trim();
  return (compact || fallback).slice(0, 300);
}

function fallbackFor(kind: string): string {
  if (kind === 'cv') return 'The CV could not be removed.';
  if (kind === 'portfolio_video') return 'The video could not be removed.';
  return 'The picture could not be removed.';
}

function safeFileName(traineeId: string): string {
  const cleaned = traineeId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  return cleaned || 'trainee';
}

function clip(value: string | null, max: number): string | null {
  if (!value) return null;
  return value.slice(0, max);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function optional(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && !Array.isArray(item),
  );
}
