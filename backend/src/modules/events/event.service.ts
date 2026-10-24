import { randomUUID } from 'node:crypto';
import type { AuditRepository } from '../auth/audit.repository.js';
import { curriculumAuditAction, type CurriculumVerb } from '../auth/audit-event.entity.js';
import type { Actor } from '../curriculum/actor.js';
import { isoTimestamp } from '../curriculum/actor.js';
import { pageOf, type Page } from '../curriculum/page.js';
import {
  isListing,
  isPublicationStatus,
  type Listing,
  type PublicationStatus,
} from '../curriculum/publication.js';
import { ApiError } from '../../shared/errors/api-error.js';
import type { EventCreateDto, EventPatchDto } from './event.dto.js';
import type { EventEntity } from './event.entity.js';
import type { EventRepository } from './event.repository.js';
import { scheduleProblems } from './event-time.js';
import { isPublicEvent } from './event-time.js';
import { isEventKind, placeholderBody, readEventBody, type EventBody } from './event-types.js';
import type { EventListQuery, EventSort } from './list-query.js';
import { toPublicEvent, type EventRecord, type PublicEvent } from './records.js';

const SOURCE_URL = 'Enter a full link starting with https://';

export class EventService {
  constructor(
    private readonly events: EventRepository,
    private readonly audit: AuditRepository,
    private readonly now: () => Date,
  ) {}

  async listPublic(): Promise<PublicEvent[]> {
    const now = this.now();
    const rows = (await this.events.findAll()).filter((row) => isPublicEvent(row, now));
    return rows.map((row) => toPublicEvent(this.toRecord(row)));
  }

  async getPublic(id: string): Promise<PublicEvent> {
    const row = await this.events.findById(id);
    if (!row || !isPublicEvent(row, this.now())) {
      throw new ApiError('not_found', 'That page is not available.');
    }
    return toPublicEvent(this.toRecord(row));
  }

  async listAdmin(query: EventListQuery): Promise<Page<EventRecord>> {
    let rows = (await this.events.findAll()).map((row) => this.toRecord(row));
    const needle = query.q.toLowerCase();
    if (needle) {
      rows = rows.filter((event) => `${event.title} ${event.place}`.toLowerCase().includes(needle));
    }
    if (query.filters.kind) {
      const kind = query.filters.kind;
      rows = rows.filter((event) => event.kind === kind);
    }
    if (query.filters.verification === 'verified') rows = rows.filter((event) => event.verified);
    if (query.filters.verification === 'sample') rows = rows.filter((event) => event.sample);
    if (query.filters.verification === 'tbc') {
      rows = rows.filter(
        (event) =>
          event.dateTbc || (event.internalNotes !== '' && !event.verified && !event.sample),
      );
    }
    const sort = query.sort ?? 'date';
    const factor = query.dir === 'desc' ? -1 : 1;
    rows.sort((left, right) => compareEvents(left, right, sort) * factor);
    return pageOf(rows, query.page, query.pageSize);
  }

  async getAdmin(id: string): Promise<EventRecord> {
    return this.toRecord(await this.requireEvent(id, 'Event not found.'));
  }

  async create(dto: EventCreateDto, actor: Actor): Promise<EventRecord> {
    const verified = dto.verified ?? false;
    const dateTbc = dto.dateTbc ?? false;
    const date = dto.date?.trim() ?? '';
    const startTime = dto.startTime?.trim() ?? '';
    const endTime = dto.endTime?.trim() ?? '';
    const sourceUrl = dto.sourceUrl?.trim() ?? '';
    const summary = dto.summary.trim();
    this.assertSchedule({ date, dateTbc, startTime, endTime });
    this.assertSource(verified, sourceUrl);
    const saved = await this.events.insert({
      id: randomUUID(),
      title: dto.title.trim(),
      date,
      dateTbc,
      whenLabel: dto.whenLabel?.trim() ?? '',
      place: dto.place.trim(),
      kind: kindOr(dto.kind, 'Milestone'),
      verified,
      sample: dto.sample ?? !verified,
      summary,
      body: this.bodyOr(dto.body, summary),
      source: dto.source?.trim() ?? '',
      sourceUrl,
      image: dto.image?.trim() || 'guests-seated',
      showOnAnniversary: dto.showOnAnniversary ?? false,
      calendarDownload: dto.calendarDownload ?? false,
      startTime,
      endTime,
      publicationStatus: statusOr(dto.publicationStatus, 'draft'),
      listing: listingOr(dto.listing, 'sample'),
      internalNotes: dto.internalNotes ?? '',
    });
    await this.writeAudit(actor, 'created', saved.id);
    return this.toRecord(saved);
  }

  async update(id: string, patch: EventPatchDto, actor: Actor): Promise<EventRecord> {
    const current = await this.requireEvent(id, 'Event not found.');
    const verified = patch.verified ?? current.verified;
    const dateTbc = patch.dateTbc ?? current.dateTbc;
    const date = patch.date !== undefined ? patch.date.trim() : current.date;
    const startTime = patch.startTime !== undefined ? patch.startTime.trim() : current.startTime;
    const endTime = patch.endTime !== undefined ? patch.endTime.trim() : current.endTime;
    const sourceUrl = patch.sourceUrl !== undefined ? patch.sourceUrl.trim() : current.sourceUrl;
    const summary = patch.summary?.trim() ?? current.summary;
    this.assertSchedule({ date, dateTbc, startTime, endTime });
    this.assertSource(verified, sourceUrl);
    current.title = patch.title?.trim() ?? current.title;
    current.date = date;
    current.dateTbc = dateTbc;
    if (patch.whenLabel !== undefined) current.whenLabel = patch.whenLabel.trim();
    current.place = patch.place?.trim() ?? current.place;
    current.kind = patch.kind !== undefined ? kindOr(patch.kind, current.kind) : current.kind;
    current.verified = verified;
    if (patch.sample !== undefined) current.sample = patch.sample;
    current.summary = summary;
    if (patch.body !== undefined) current.body = this.bodyOr(patch.body, summary);
    if (patch.source !== undefined) current.source = patch.source.trim();
    current.sourceUrl = sourceUrl;
    if (patch.image !== undefined) current.image = patch.image.trim() || 'guests-seated';
    if (patch.showOnAnniversary !== undefined) current.showOnAnniversary = patch.showOnAnniversary;
    if (patch.calendarDownload !== undefined) current.calendarDownload = patch.calendarDownload;
    current.startTime = startTime;
    current.endTime = endTime;
    if (patch.publicationStatus !== undefined) {
      current.publicationStatus = statusOr(patch.publicationStatus, current.publicationStatus);
    }
    if (patch.listing !== undefined) current.listing = listingOr(patch.listing, current.listing);
    if (patch.internalNotes !== undefined) current.internalNotes = patch.internalNotes;
    const saved = await this.events.save(current);
    await this.writeAudit(actor, 'updated', saved.id);
    return this.toRecord(saved);
  }

  async publish(id: string, actor: Actor): Promise<EventRecord> {
    const current = await this.requireEvent(id, 'Event not found.');
    if (current.publicationStatus !== 'published') {
      current.publicationStatus = 'published';
      await this.events.save(current);
      await this.writeAudit(actor, 'published', current.id);
    }
    return this.toRecord(current);
  }

  async unpublish(id: string, actor: Actor): Promise<EventRecord> {
    const current = await this.requireEvent(id, 'Event not found.');
    if (current.publicationStatus !== 'draft') {
      current.publicationStatus = 'draft';
      await this.events.save(current);
      await this.writeAudit(actor, 'unpublished', current.id);
    }
    return this.toRecord(current);
  }

  async remove(id: string, actor: Actor): Promise<{ deleted: true; id: string }> {
    const current = await this.requireEvent(id, 'Record not found.');
    await this.events.remove(current);
    await this.writeAudit(actor, 'deleted', id);
    return { deleted: true, id };
  }

  private bodyOr(value: unknown, summary: string): EventBody {
    return readEventBody(value) ?? placeholderBody(summary);
  }

  private assertSchedule(input: {
    date: string;
    dateTbc: boolean;
    startTime: string;
    endTime: string;
  }): void {
    const problems = scheduleProblems(input);
    if (Object.keys(problems).length > 0) {
      throw new ApiError('validation', 'Check the highlighted fields.', problems);
    }
  }

  private assertSource(verified: boolean, sourceUrl: string): void {
    if (verified && sourceUrl === '') {
      throw new ApiError('validation', 'Check the highlighted fields.', { sourceUrl: SOURCE_URL });
    }
  }

  private async requireEvent(id: string, message: string): Promise<EventEntity> {
    const row = await this.events.findById(id);
    if (!row) throw new ApiError('not_found', message);
    return row;
  }

  private toRecord(row: EventEntity): EventRecord {
    return {
      id: row.id,
      title: row.title,
      date: row.date,
      dateTbc: row.dateTbc,
      whenLabel: row.whenLabel,
      place: row.place,
      kind: row.kind,
      verified: row.verified,
      sample: row.sample,
      summary: row.summary,
      body: row.body,
      source: row.source,
      sourceUrl: row.sourceUrl,
      image: row.image,
      showOnAnniversary: row.showOnAnniversary,
      calendarDownload: row.calendarDownload,
      startTime: row.startTime,
      endTime: row.endTime,
      publicationStatus: row.publicationStatus,
      listing: row.listing,
      internalNotes: row.internalNotes,
      updatedAt: isoTimestamp(row.updatedAt),
    };
  }

  private writeAudit(actor: Actor, verb: CurriculumVerb, id: string): Promise<void> {
    return this.audit.record({
      action: curriculumAuditAction('event', verb),
      actorUserId: actor.userId,
      ip: actor.ip,
      requestId: actor.requestId,
      subjectType: 'event',
      subjectId: id,
    });
  }
}

function compareEvents(left: EventRecord, right: EventRecord, sort: EventSort): number {
  return left[sort].localeCompare(right[sort]);
}

function kindOr(value: string | undefined, fallback: string): string {
  if (value && isEventKind(value.trim())) return value.trim();
  return fallback;
}

function statusOr(value: string | undefined, fallback: PublicationStatus): PublicationStatus {
  if (value && isPublicationStatus(value)) return value;
  return fallback;
}

function listingOr(value: string | undefined, fallback: Listing): Listing {
  if (value && isListing(value)) return value;
  return fallback;
}
