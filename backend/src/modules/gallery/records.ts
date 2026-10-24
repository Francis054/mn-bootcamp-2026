import type { Listing, PublicationStatus } from '../curriculum/publication.js';
import type { MediaConsent, StorageLabel } from './media.entity.js';

/**
 * The admin shape. It matches the website's `MediaItem` and adds withdrawn
 * consent plus the bookkeeping the public gallery does not see.
 */
export interface MediaRecord {
  id: string;
  file: string;
  src: string;
  width: number;
  height: number;
  caption: string;
  alt: string;
  album: string;
  consent: MediaConsent;
  consentVerifiedAt: string | null;
  consentRecordedBy: string | null;
  consentWithdrawnAt: string | null;
  publicationStatus: PublicationStatus;
  listing: Listing;
  storageProvider: StorageLabel;
  updatedAt: string;
}

/** The live public photo. Consent and workflow stay on the admin response. */
export interface PublicMedia {
  id: string;
  file: string;
  src: string;
  width: number;
  height: number;
  caption: string;
  alt: string;
  album: string;
}

export function toPublicMedia(row: MediaRecord): PublicMedia {
  return {
    id: row.id,
    file: row.file,
    src: row.src,
    width: row.width,
    height: row.height,
    caption: row.caption,
    alt: row.alt,
    album: row.album,
  };
}
