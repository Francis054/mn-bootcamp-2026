import type { Listing, PublicationStatus } from '../curriculum/publication.js';
import type { MediaConsent, StorageLabel } from './media.entity.js';
import type { AlbumId } from './media.rules.js';

/**
 * Labelled placeholders. They are not photographs of people, and they stay
 * off the public gallery until an editor verifies consent and publishes.
 */

const NOTE = 'Sample image. Not a photograph of a person.';

interface SampleMedia {
  id: string;
  file: string;
  src: string;
  width: number;
  height: number;
  caption: string;
  alt: string;
  album: AlbumId;
  consent: MediaConsent;
  consentVerifiedAt: null;
  consentRecordedBy: null;
  consentWithdrawnAt: null;
  publicationStatus: PublicationStatus;
  listing: Listing;
  storageProvider: StorageLabel;
  storageKey: string;
  uploadedBy: null;
}

export function buildSampleMedia(): SampleMedia[] {
  return [
    row('sample-banner', 'community', 'A labelled banner for the sample gallery.'),
    row('sample-bench', 'hackathon', 'A labelled drawing of a work bench.'),
    row('sample-mark', 'anniversary', 'A labelled mark for the sample anniversary album.'),
  ];
}

function row(id: string, album: AlbumId, caption: string): SampleMedia {
  return {
    id,
    file: id,
    src: '',
    width: 1600,
    height: 1066,
    caption,
    alt: `${caption} ${NOTE}`,
    album,
    consent: 'pending',
    consentVerifiedAt: null,
    consentRecordedBy: null,
    consentWithdrawnAt: null,
    publicationStatus: 'draft',
    listing: 'hidden',
    storageProvider: 'static',
    storageKey: '',
    uploadedBy: null,
  };
}
