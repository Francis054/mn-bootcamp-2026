import type { Listing, PublicationStatus } from '../curriculum/publication.js';
import type { EventBody } from './event-types.js';

/**
 * The admin shape. It matches the website's `BootcampEvent` and adds the
 * time the row was last saved. `dateTbc` means the date is not confirmed.
 */
export interface EventRecord {
  id: string;
  title: string;
  date: string;
  dateTbc: boolean;
  whenLabel: string;
  place: string;
  kind: string;
  verified: boolean;
  sample: boolean;
  summary: string;
  body: EventBody;
  source: string;
  sourceUrl: string;
  image: string;
  showOnAnniversary: boolean;
  calendarDownload: boolean;
  startTime: string;
  endTime: string;
  publicationStatus: PublicationStatus;
  listing: Listing;
  internalNotes: string;
  updatedAt: string;
}

/** The website's public event. Internal notes stay on the admin response. */
export type PublicEvent = Omit<EventRecord, 'internalNotes' | 'updatedAt'>;

export function toPublicEvent(row: EventRecord): PublicEvent {
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
  };
}
