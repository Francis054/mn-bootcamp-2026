import { randomUUID } from 'node:crypto';
import type { AuditRepository } from '../auth/audit.repository.js';
import type { AuditAction } from '../auth/audit-event.entity.js';
import type { Actor } from '../curriculum/actor.js';
import { isoTimestamp } from '../curriculum/actor.js';
import { ApiError } from '../../shared/errors/api-error.js';
import { storeProfilePhoto } from '../trainees/profile-photo.js';
import { isReviewStatus, statusAfterEdit, type ReviewStatus } from '../trainees/profile-review.js';
import type { TraineeEntity } from '../trainees/trainee.entity.js';
import type { TraineeRepository } from '../trainees/trainee.repository.js';
import { isPublicTrainee } from '../trainees/visibility.js';
import type { UserRepository } from '../users/user.repository.js';
import type { CloudinaryStorage } from '../storage/cloudinary-storage.js';
import type { StorageProvider } from '../storage/storage-provider.js';
import { clearPending, liveContent, pendingContent, writeLive, writePending } from './portfolio-content.js';
import type { PortfolioMediaEntity } from './portfolio-media.entity.js';
import type { PortfolioItemEntity } from './portfolio-item.entity.js';
import type { PortfolioRepository } from './portfolio.repository.js';
import {
  MAX_PORTFOLIO_IMAGES,
  MAX_PORTFOLIO_ITEMS,
  MAX_PORTFOLIO_VIDEOS,
  PORTFOLIO_ALT_MAX,
  applyItemPatch,
  approveItem,
  emptyItem,
  itemDateProblem,
  readItemWrite,
  readReorderIds,
  rejectItem,
  submitItem,
  type ItemContent,
  type PortfolioKind,
} from './portfolio-rules.js';
import { acceptedCloudinaryVideoFormat, sniffVideo, videoByteProblem, videoMimeProblem, videoSizeMessage } from './video-bytes.js';
import { VIDEO_LINK_MESSAGE, parseVideoLink } from './video-url.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCAL_PREFIX = '/api/v1/public/uploads/';
const GRANT_TTL_MS = 15 * 60 * 1000;
const MISSING = 'That portfolio item is not available.';
const NOT_WAITING = 'That item is not waiting for review.';

export interface PortfolioMediaView {
  id: string;
  kind: 'image' | 'video_file' | 'video_link';
  alt: string;
  url: string | null;
  provider: string | null;
  externalId: string | null;
  sortOrder: number;
}

export interface PortfolioContentView extends ItemContent {
  media: PortfolioMediaView[];
}

export interface PortfolioItemView {
  id: string;
  sortOrder: number;
  status: ReviewStatus;
  rejectionReason: string;
  submittedAt: string | null;
  draft: PortfolioContentView;
  live: PortfolioContentView;
}

export interface PublicPortfolioItem extends ItemContent {
  id: string;
  media: PortfolioMediaView[];
}

export interface PortfolioReviewItem {
  id: string;
  traineeId: string;
  email: string;
  traineeName: string;
  status: ReviewStatus;
  submittedAt: string | null;
  draft: PortfolioContentView;
  live: PortfolioContentView;
  consents: { publicProfile: boolean; publicPhoto: boolean };
}

export interface VideoGrantView {
  grantId: string;
  mode: 'cloudinary' | 'api';
  expiresAt: string;
  maxBytes: number;
  uploadUrl?: string;
  fields?: Record<string, string>;
}

/**
 * A trainee's own projects, labs, and case studies.
 * The trainee id comes from the session. A body cannot name another trainee.
 * The live columns stay public until an administrator approves a newer draft.
 */
export class PortfolioService {
  constructor(
    private readonly portfolio: PortfolioRepository,
    private readonly users: UserRepository,
    private readonly trainees: TraineeRepository,
    private readonly auditLog: AuditRepository,
    private readonly storage: StorageProvider,
    private readonly videos: CloudinaryStorage | null,
    private readonly maxImageBytes: number,
    private readonly maxVideoBytes: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listOwn(userId: string): Promise<PortfolioItemView[]> {
    const trainee = await this.ownTrainee(userId);
    return this.viewsFor(await this.portfolio.listForTrainee(trainee.id));
  }

  async getOwn(userId: string, itemId: string): Promise<PortfolioItemView> {
    const { row } = await this.ownItem(userId, itemId);
    return this.one(row);
  }

  async createOwn(userId: string, body: unknown): Promise<PortfolioItemView> {
    const trainee = await this.ownTrainee(userId);
    const content = this.readContent(body, 'create', emptyItem());
    const existing = await this.portfolio.listForTrainee(trainee.id);
    if (existing.length >= MAX_PORTFOLIO_ITEMS) {
      throw new ApiError('validation', 'You can keep at most 30 portfolio items.');
    }
    const sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
    const row = this.portfolio.createItem({
      traineeId: trainee.id,
      kind: content.kind,
      sortOrder,
      reviewStatus: 'draft',
      rejectionReason: '',
      submittedAt: null,
      reviewedAt: null,
      reviewedBy: null,
      title: '',
      summary: '',
      skills: [],
      startedOn: null,
      completedOn: null,
      repositoryUrl: null,
      demoUrl: null,
      hasPending: true,
    });
    writePending(row, content);
    return this.one(await this.portfolio.saveItem(row));
  }

  async updateOwn(userId: string, itemId: string, body: unknown): Promise<PortfolioItemView> {
    const { row } = await this.ownItem(userId, itemId);
    await this.ensurePending(row);
    const content = this.readContent(body, 'patch', pendingContent(row));
    writePending(row, content);
    row.reviewStatus = statusAfterEdit(statusOf(row));
    return this.one(await this.portfolio.saveItem(row));
  }

  async deleteOwn(userId: string, itemId: string, actor: Actor): Promise<{ id: string }> {
    const { row } = await this.ownItem(userId, itemId);
    return this.remove(row, actor);
  }

  async reorderOwn(userId: string, body: unknown): Promise<PortfolioItemView[]> {
    const trainee = await this.ownTrainee(userId);
    const ids = readReorderIds(body);
    const rows = await this.portfolio.listForTrainee(trainee.id);
    if (!ids || !sameIds(ids, rows.map((row) => row.id))) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        ids: 'Include every portfolio item once.',
      });
    }
    for (const [index, id] of ids.entries()) {
      const row = rows.find((item) => item.id === id);
      if (!row) continue;
      row.sortOrder = index;
      await this.portfolio.saveItem(row);
    }
    return this.viewsFor(await this.portfolio.listForTrainee(trainee.id));
  }

  async addImage(userId: string, itemId: string, bytes: Buffer, alt: string): Promise<PortfolioItemView> {
    const { row } = await this.ownItem(userId, itemId);
    const caption = alt.trim();
    if (!caption) {
      throw new ApiError('validation', 'Check the highlighted fields.', { image: 'Describe the picture.' });
    }
    if (caption.length > PORTFOLIO_ALT_MAX) {
      throw new ApiError('validation', 'Check the highlighted fields.', { image: 'Use at most 200 characters.' });
    }
    const media = await this.prepareMedia(row, 'image');
    const stored = await this.storeImage(bytes);
    await this.portfolio.saveMedia(
      this.portfolio.createMedia({
        itemId: row.id,
        traineeId: row.traineeId,
        slot: 'pending',
        kind: 'image',
        sortOrder: nextOrder(media),
        alt: caption,
        storageKey: stored.storageKey,
        publicUrl: stored.photoUrl,
        mime: null,
        byteSize: bytes.length,
        provider: null,
        externalId: null,
      }),
    );
    await this.markEdited(row);
    return this.one(row);
  }

  async removeImage(userId: string, itemId: string, mediaId: string): Promise<PortfolioItemView> {
    return this.removeMedia(userId, itemId, mediaId, 'image');
  }

  async addVideoLink(userId: string, itemId: string, body: unknown): Promise<PortfolioItemView> {
    const { row } = await this.ownItem(userId, itemId);
    const raw = isRecord(body) && typeof body.url === 'string' ? body.url : '';
    const parsed = parseVideoLink(raw);
    if (!parsed) {
      throw new ApiError('validation', 'Check the highlighted fields.', { video: VIDEO_LINK_MESSAGE });
    }
    const media = await this.prepareMedia(row, 'video');
    await this.portfolio.saveMedia(
      this.portfolio.createMedia({
        itemId: row.id,
        traineeId: row.traineeId,
        slot: 'pending',
        kind: 'video_link',
        sortOrder: nextOrder(media),
        alt: '',
        storageKey: null,
        publicUrl: null,
        mime: null,
        byteSize: null,
        provider: parsed.provider,
        externalId: parsed.externalId,
      }),
    );
    await this.markEdited(row);
    return this.one(row);
  }

  async createVideoGrant(userId: string, itemId: string, body: unknown): Promise<VideoGrantView> {
    const { row } = await this.ownItem(userId, itemId);
    const mime = isRecord(body) && typeof body.mime === 'string' ? body.mime : '';
    const bytes = isRecord(body) && typeof body.bytes === 'number' ? body.bytes : Number.NaN;
    const errors: Record<string, string> = {};
    const mimeProblem = videoMimeProblem(mime);
    const sizeProblem = videoByteProblem(bytes, this.maxVideoBytes);
    if (mimeProblem) errors.video = mimeProblem;
    if (sizeProblem) errors.video = sizeProblem;
    if (Object.keys(errors).length) throw new ApiError('validation', 'Check the highlighted fields.', errors);
    await this.prepareMedia(row, 'video');
    const mode = this.delivery();
    if (mode === 'unavailable') {
      throw new ApiError('server', 'Video upload is not configured. Paste a YouTube, Vimeo, or Loom link instead.');
    }
    const expiresAt = new Date(this.now().getTime() + GRANT_TTL_MS);
    const publicId = `mn-video-${randomUUID()}`;
    const grant = await this.portfolio.saveGrant(
      this.portfolio.createGrant({
        itemId: row.id,
        traineeId: row.traineeId,
        publicId,
        mime: mime.trim().toLowerCase(),
        maxBytes: this.maxVideoBytes,
        expiresAt,
        consumedAt: null,
      }),
    );
    const view: VideoGrantView = {
      grantId: grant.id,
      mode,
      expiresAt: expiresAt.toISOString(),
      maxBytes: this.maxVideoBytes,
    };
    if (mode === 'cloudinary' && this.videos) {
      const signed = this.videos.signVideoUpload(publicId, this.now().getTime());
      view.uploadUrl = signed.uploadUrl;
      view.fields = signed.fields;
    }
    return view;
  }

  async addVideoFile(userId: string, itemId: string, grantId: string, bytes: Buffer): Promise<PortfolioItemView> {
    if (this.delivery() !== 'api') {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        video: 'Upload this video directly to storage, then confirm it.',
      });
    }
    const { row } = await this.ownItem(userId, itemId);
    const grant = await this.openGrant(row, grantId);
    const sizeProblem = videoByteProblem(bytes.length, Math.min(grant.maxBytes, this.maxVideoBytes));
    if (sizeProblem) throw new ApiError('validation', 'Check the highlighted fields.', { video: sizeProblem });
    const sniffed = sniffVideo(bytes);
    if (!sniffed || sniffed !== grant.mime) {
      throw new ApiError('validation', 'Check the highlighted fields.', { video: 'Use an MP4, WebM, or MOV video.' });
    }
    await this.prepareMedia(row, 'video');
    let stored: { key: string; publicUrl: string };
    try {
      stored = await this.storage.put({ bytes, mime: sniffed });
    } catch (error) {
      throw storageFailure(error);
    }
    const publicUrl = stored.publicUrl.startsWith('memory:') ? `${LOCAL_PREFIX}${stored.key}` : stored.publicUrl;
    await this.portfolio.saveMedia(
      this.portfolio.createMedia({
        itemId: row.id,
        traineeId: row.traineeId,
        slot: 'pending',
        kind: 'video_file',
        sortOrder: nextOrder(await this.portfolio.listMedia(row.id)),
        alt: '',
        storageKey: stored.key,
        publicUrl,
        mime: sniffed,
        byteSize: bytes.length,
        provider: 'upload',
        externalId: null,
      }),
    );
    grant.consumedAt = this.now();
    await this.portfolio.saveGrant(grant);
    await this.markEdited(row);
    return this.one(row);
  }

  async completeVideo(userId: string, itemId: string, body: unknown): Promise<PortfolioItemView> {
    if (!this.videos || this.delivery() !== 'cloudinary') {
      throw new ApiError('validation', 'Check the highlighted fields.', { video: 'Start the upload again.' });
    }
    const { row } = await this.ownItem(userId, itemId);
    const grantId = isRecord(body) && typeof body.grantId === 'string' ? body.grantId : '';
    const grant = await this.openGrant(row, grantId);
    const described = await this.videos.describeVideo(grant.publicId);
    if (!described || described.resourceType !== 'video' || !Number.isInteger(described.bytes) || described.bytes < 1) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        video: 'The video upload did not finish. Try it again.',
      });
    }
    if (!acceptedCloudinaryVideoFormat(described.format)) {
      await this.videos.deleteVideo(grant.publicId).catch(() => undefined);
      throw new ApiError('validation', 'Check the highlighted fields.', { video: 'Use an MP4, WebM, or MOV video.' });
    }
    if (described.bytes > this.maxVideoBytes) {
      await this.videos.deleteVideo(grant.publicId).catch(() => undefined);
      throw new ApiError('validation', 'Check the highlighted fields.', { video: videoSizeMessage(this.maxVideoBytes) });
    }
    try {
      await this.prepareMedia(row, 'video');
    } catch (error) {
      await this.videos.deleteVideo(grant.publicId).catch(() => undefined);
      throw error;
    }
    await this.portfolio.saveMedia(
      this.portfolio.createMedia({
        itemId: row.id,
        traineeId: row.traineeId,
        slot: 'pending',
        kind: 'video_file',
        sortOrder: nextOrder(await this.portfolio.listMedia(row.id)),
        alt: '',
        storageKey: grant.publicId,
        publicUrl: described.publicUrl,
        mime: described.format,
        byteSize: described.bytes,
        provider: 'upload',
        externalId: null,
      }),
    );
    grant.consumedAt = this.now();
    await this.portfolio.saveGrant(grant);
    await this.markEdited(row);
    return this.one(row);
  }

  async removeVideo(userId: string, itemId: string, mediaId: string): Promise<PortfolioItemView> {
    return this.removeMedia(userId, itemId, mediaId, 'video');
  }

  async reorderMedia(userId: string, itemId: string, body: unknown): Promise<PortfolioItemView> {
    const { row } = await this.ownItem(userId, itemId);
    const ids = readReorderIds(body);
    const media = await this.portfolio.listMedia(row.id);
    const pending = media.filter((item) => item.slot === 'pending');
    const live = media.filter((item) => item.slot === 'live');
    if (ids && row.hasPending && sameIds(ids, pending.map((item) => item.id))) {
      await this.writeOrder(pending, ids);
    } else if (ids && !row.hasPending && sameIds(ids, live.map((item) => item.id))) {
      writePending(row, liveContent(row));
      for (const [index, id] of ids.entries()) {
        const source = live.find((item) => item.id === id);
        if (!source) continue;
        await this.portfolio.saveMedia(
          this.portfolio.createMedia({ ...this.copyMedia(source), sortOrder: index }),
        );
      }
    } else {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        ids: 'Include every picture and video once.',
      });
    }
    await this.markEdited(row);
    return this.one(row);
  }

  async submit(userId: string, itemId: string): Promise<PortfolioItemView> {
    const { trainee, row } = await this.ownItem(userId, itemId);
    if (!row.hasPending) writePending(row, liveContent(row));
    const decision = submitItem(statusOf(row), trainee.consentReceived);
    if (!decision.ok) throw new ApiError('validation', decision.message);
    row.reviewStatus = decision.status;
    row.submittedAt = this.now();
    row.rejectionReason = '';
    return this.one(await this.portfolio.saveItem(row));
  }

  async listQueue(): Promise<PortfolioReviewItem[]> {
    const rows = await this.portfolio.listPending();
    const media = await this.portfolio.listMediaForItems(rows.map((row) => row.id));
    const result: PortfolioReviewItem[] = [];
    for (const row of rows) {
      const trainee = await this.trainees.findById(row.traineeId);
      if (!trainee) continue;
      const view = this.view(row, media.filter((item) => item.itemId === row.id));
      result.push({
        id: row.id,
        traineeId: trainee.id,
        email: trainee.email,
        traineeName: trainee.displayName,
        status: 'pending',
        submittedAt: view.submittedAt,
        draft: view.draft,
        live: view.live,
        consents: { publicProfile: trainee.consentReceived, publicPhoto: trainee.photoConsent },
      });
    }
    return result;
  }

  async editPending(itemId: string, body: unknown, actor: Actor): Promise<PortfolioReviewItem> {
    const row = await this.requirePending(itemId);
    const content = this.readContent(body, 'patch', pendingContent(row));
    writePending(row, content);
    await this.portfolio.saveItem(row);
    await this.audit(actor, 'portal.portfolio.admin_updated', row.id);
    return this.reviewItem(row);
  }

  async approve(itemId: string, actor: Actor): Promise<PortfolioReviewItem> {
    const row = await this.requirePending(itemId);
    const decision = approveItem(statusOf(row));
    if (!decision.ok) throw new ApiError('validation', decision.message);
    const next = pendingContent(row);
    const media = await this.portfolio.listMedia(row.id);
    const pending = media.filter((item) => item.slot === 'pending');
    const live = media.filter((item) => item.slot === 'live');
    const pendingKeys = new Set(pending.map((item) => item.storageKey).filter((key): key is string => Boolean(key)));
    const doomed = live.filter((item) => item.storageKey && !pendingKeys.has(item.storageKey));
    for (const item of live) await this.portfolio.deleteMedia(item.id);
    for (const item of pending) {
      item.slot = 'live';
      await this.portfolio.saveMedia(item);
    }
    writeLive(row, next);
    clearPending(row);
    row.reviewStatus = 'approved';
    row.rejectionReason = '';
    row.reviewedAt = this.now();
    row.reviewedBy = actor.userId;
    await this.portfolio.saveItem(row);
    await this.deleteStored(doomed);
    await this.audit(actor, 'portal.portfolio.approved', row.id);
    return this.reviewItem(row);
  }

  async reject(itemId: string, body: unknown, actor: Actor): Promise<PortfolioReviewItem> {
    const row = await this.requirePending(itemId);
    const reason = isRecord(body) && typeof body.reason === 'string' ? body.reason : '';
    const decision = rejectItem(statusOf(row), reason);
    if (!decision.ok) {
      throw new ApiError('validation', decision.message, { reason: decision.message });
    }
    row.reviewStatus = 'rejected';
    row.rejectionReason = decision.reason;
    row.reviewedAt = this.now();
    row.reviewedBy = actor.userId;
    await this.portfolio.saveItem(row);
    await this.audit(actor, 'portal.portfolio.rejected', row.id);
    return this.reviewItem(row);
  }

  async deleteByAdmin(itemId: string, actor: Actor): Promise<{ id: string }> {
    if (!UUID.test(itemId)) throw new ApiError('not_found', MISSING);
    const row = await this.portfolio.findItem(itemId);
    if (!row) throw new ApiError('not_found', MISSING);
    return this.remove(row, actor);
  }

  async listPublic(traineeId: string): Promise<PublicPortfolioItem[]> {
    const trainee = await this.trainees.findById(traineeId);
    if (!trainee || !isPublicTrainee(trainee)) throw new ApiError('not_found', 'That page is not available.');
    const rows = (await this.portfolio.listForTrainee(trainee.id)).filter((row) => row.title.trim().length > 0);
    const media = await this.portfolio.listMediaForItems(rows.map((row) => row.id));
    const showMedia = trainee.consentReceived && trainee.photoConsent;
    return rows.map((row) => ({
      id: row.id,
      ...liveContent(row),
      media: showMedia
        ? media.filter((item) => item.itemId === row.id && item.slot === 'live').map((item) => this.mediaView(item))
        : [],
    }));
  }

  private readContent(body: unknown, mode: 'create' | 'patch', current: ItemContent): ItemContent {
    const parsed = readItemWrite(body, mode);
    if (Object.keys(parsed.errors).length) {
      throw new ApiError('validation', 'Check the highlighted fields.', parsed.errors);
    }
    const content = applyItemPatch(current, parsed.value);
    const dates = itemDateProblem(content);
    if (dates) throw new ApiError('validation', 'Check the highlighted fields.', { completedOn: dates });
    if (mode === 'create' && !content.title) {
      throw new ApiError('validation', 'Check the highlighted fields.', { title: 'Enter a title.' });
    }
    return content;
  }

  private async ownTrainee(userId: string): Promise<TraineeEntity> {
    const user = await this.users.findById(userId);
    if (!user?.traineeId) throw new ApiError('not_found', 'Your login is not linked to a trainee record yet.');
    const trainee = await this.trainees.findById(user.traineeId);
    if (!trainee) throw new ApiError('not_found', 'Your login is not linked to a trainee record yet.');
    return trainee;
  }

  private async ownItem(userId: string, itemId: string): Promise<{ trainee: TraineeEntity; row: PortfolioItemEntity }> {
    const trainee = await this.ownTrainee(userId);
    if (!UUID.test(itemId)) throw new ApiError('not_found', MISSING);
    const row = await this.portfolio.findItem(itemId);
    if (!row || row.traineeId !== trainee.id) throw new ApiError('not_found', MISSING);
    return { trainee, row };
  }

  private async requirePending(itemId: string): Promise<PortfolioItemEntity> {
    if (!UUID.test(itemId)) throw new ApiError('not_found', NOT_WAITING);
    const row = await this.portfolio.findItem(itemId);
    if (!row || statusOf(row) !== 'pending' || !row.hasPending) throw new ApiError('not_found', NOT_WAITING);
    return row;
  }

  /** Copies the approved gallery into the draft. The map sends a live id to its new draft id. */
  private async ensurePending(row: PortfolioItemEntity): Promise<Map<string, string>> {
    const copied = new Map<string, string>();
    if (row.hasPending) return copied;
    writePending(row, liveContent(row));
    const live = (await this.portfolio.listMedia(row.id)).filter((item) => item.slot === 'live');
    for (const item of live) {
      const saved = await this.portfolio.saveMedia(this.portfolio.createMedia(this.copyMedia(item)));
      copied.set(item.id, saved.id);
    }
    await this.portfolio.saveItem(row);
    return copied;
  }

  private async prepareMedia(row: PortfolioItemEntity, kind: 'image' | 'video'): Promise<PortfolioMediaEntity[]> {
    await this.ensurePending(row);
    const media = await this.portfolio.listMedia(row.id);
    const pending = media.filter((item) => item.slot === 'pending');
    if (kind === 'image' && pending.filter((item) => item.kind === 'image').length >= MAX_PORTFOLIO_IMAGES) {
      throw new ApiError('validation', 'Check the highlighted fields.', { image: 'You can add at most 8 pictures.' });
    }
    if (kind === 'video' && pending.filter((item) => item.kind !== 'image').length >= MAX_PORTFOLIO_VIDEOS) {
      throw new ApiError('validation', 'Check the highlighted fields.', { video: 'You can add at most 3 videos.' });
    }
    return pending;
  }

  private async removeMedia(
    userId: string,
    itemId: string,
    mediaId: string,
    kind: 'image' | 'video',
  ): Promise<PortfolioItemView> {
    const { row } = await this.ownItem(userId, itemId);
    const copied = await this.ensurePending(row);
    const pendingId = copied.get(mediaId) ?? mediaId;
    const media = await this.portfolio.listMedia(row.id);
    const target = media.find((item) => item.id === pendingId && item.slot === 'pending');
    const matches = target && (kind === 'image' ? target.kind === 'image' : target.kind !== 'image');
    if (!target || !matches) throw new ApiError('not_found', MISSING);
    await this.portfolio.deleteMedia(target.id);
    if (target.storageKey && !media.some((item) => item.id !== target.id && item.storageKey === target.storageKey)) {
      await this.deleteStored([target]);
    }
    await this.markEdited(row);
    return this.one(row);
  }

  private async markEdited(row: PortfolioItemEntity): Promise<void> {
    row.reviewStatus = statusAfterEdit(statusOf(row));
    await this.portfolio.saveItem(row);
  }

  private async openGrant(row: PortfolioItemEntity, grantId: string) {
    if (!UUID.test(grantId)) {
      throw new ApiError('validation', 'Check the highlighted fields.', { video: 'Start the upload again.' });
    }
    const grant = await this.portfolio.findGrant(grantId);
    if (!grant || grant.itemId !== row.id || grant.traineeId !== row.traineeId) {
      throw new ApiError('validation', 'Check the highlighted fields.', { video: 'Start the upload again.' });
    }
    if (grant.consumedAt) {
      throw new ApiError('validation', 'Check the highlighted fields.', { video: 'This upload has already been used.' });
    }
    if (grant.expiresAt.getTime() <= this.now().getTime()) {
      throw new ApiError('validation', 'Check the highlighted fields.', {
        video: 'This upload link has expired. Start the upload again.',
      });
    }
    return grant;
  }

  private delivery(): 'cloudinary' | 'api' | 'unavailable' {
    if (this.videos) return 'cloudinary';
    if (this.storage.name === 'memory') return 'api';
    return 'unavailable';
  }

  private copyMedia(media: PortfolioMediaEntity): Partial<PortfolioMediaEntity> {
    return {
      itemId: media.itemId,
      traineeId: media.traineeId,
      slot: 'pending',
      kind: media.kind,
      sortOrder: media.sortOrder,
      alt: media.alt,
      storageKey: media.storageKey,
      publicUrl: media.publicUrl,
      mime: media.mime,
      byteSize: media.byteSize,
      provider: media.provider,
      externalId: media.externalId,
    };
  }

  private async writeOrder(rows: PortfolioMediaEntity[], ids: string[]): Promise<void> {
    for (const [index, id] of ids.entries()) {
      const row = rows.find((item) => item.id === id);
      if (!row) continue;
      row.sortOrder = index;
      await this.portfolio.saveMedia(row);
    }
  }

  private async remove(row: PortfolioItemEntity, actor: Actor): Promise<{ id: string }> {
    const media = await this.portfolio.listMedia(row.id);
    await this.portfolio.deleteItem(row.id);
    const unique = media.filter((item, index) => {
      if (!item.storageKey) return false;
      return media.findIndex((other) => other.storageKey === item.storageKey) === index;
    });
    await this.deleteStored(unique);
    await this.audit(actor, 'portal.portfolio.deleted', row.id);
    return { id: row.id };
  }

  private async viewsFor(rows: PortfolioItemEntity[]): Promise<PortfolioItemView[]> {
    const media = await this.portfolio.listMediaForItems(rows.map((row) => row.id));
    return rows.map((row) => this.view(row, media.filter((item) => item.itemId === row.id)));
  }

  private async one(row: PortfolioItemEntity): Promise<PortfolioItemView> {
    return this.view(row, await this.portfolio.listMedia(row.id));
  }

  private async reviewItem(row: PortfolioItemEntity): Promise<PortfolioReviewItem> {
    const trainee = await this.trainees.findById(row.traineeId);
    if (!trainee) throw new ApiError('not_found', NOT_WAITING);
    const view = await this.one(row);
    return {
      id: row.id,
      traineeId: trainee.id,
      email: trainee.email,
      traineeName: trainee.displayName,
      status: view.status,
      submittedAt: view.submittedAt,
      draft: view.draft,
      live: view.live,
      consents: { publicProfile: trainee.consentReceived, publicPhoto: trainee.photoConsent },
    };
  }

  private view(row: PortfolioItemEntity, media: PortfolioMediaEntity[]): PortfolioItemView {
    const draftRows = media.filter((item) => item.slot === (row.hasPending ? 'pending' : 'live'));
    const liveRows = media.filter((item) => item.slot === 'live');
    return {
      id: row.id,
      sortOrder: row.sortOrder,
      status: statusOf(row),
      rejectionReason: row.rejectionReason,
      submittedAt: stamp(row.submittedAt),
      draft: { ...pendingContent(row), media: draftRows.map((item) => this.mediaView(item)) },
      live: { ...liveContent(row), media: liveRows.map((item) => this.mediaView(item)) },
    };
  }

  private mediaView(row: PortfolioMediaEntity): PortfolioMediaView {
    return {
      id: row.id,
      kind: row.kind,
      alt: row.alt,
      url: row.kind === 'video_link' ? null : row.publicUrl,
      provider: row.provider,
      externalId: row.externalId,
      sortOrder: row.sortOrder,
    };
  }

  private async storeImage(bytes: Buffer): Promise<{ photoUrl: string; storageKey: string }> {
    try {
      return await storeProfilePhoto(bytes, this.storage, this.maxImageBytes);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors?.photoUrl) {
        const { photoUrl, ...rest } = error.fieldErrors;
        throw new ApiError(error.code, error.message, { ...rest, image: photoUrl });
      }
      throw error;
    }
  }

  private async deleteStored(rows: PortfolioMediaEntity[]): Promise<void> {
    for (const row of rows) {
      if (!row.storageKey) continue;
      try {
        if (row.kind === 'video_file' && this.videos) await this.videos.deleteVideo(row.storageKey);
        else await this.storage.delete(row.storageKey);
      } catch (error) {
        throw storageFailure(error);
      }
    }
  }

  private audit(actor: Actor, action: AuditAction, itemId: string): Promise<void> {
    return this.auditLog.record({
      action,
      actorUserId: actor.userId,
      ip: actor.ip,
      requestId: actor.requestId,
      subjectType: 'portfolio_item',
      subjectId: itemId,
    });
  }
}

function statusOf(row: PortfolioItemEntity): ReviewStatus {
  return isReviewStatus(row.reviewStatus) ? row.reviewStatus : 'draft';
}

function nextOrder(rows: PortfolioMediaEntity[]): number {
  return rows.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
}

function sameIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const wanted = new Set(right);
  if (wanted.size !== right.length) return false;
  return left.every((id) => wanted.has(id)) && new Set(left).size === left.length;
}

function stamp(value: Date | null): string | null {
  return value ? isoTimestamp(value) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function storageFailure(error: unknown): ApiError {
  const message = error instanceof Error ? error.message : '';
  if (message === 'Image storage is not configured.') {
    return new ApiError('server', 'Image storage is not configured.');
  }
  return new ApiError('server', 'The file could not be stored.');
}

export type { PortfolioKind };
