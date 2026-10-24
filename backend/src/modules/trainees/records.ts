import type { Listing, PublicationStatus } from '../curriculum/publication.js';

/**
 * The admin shape. It matches the website's `Trainee` and adds the consent
 * bookkeeping the public site never sees. `consentRecordedBy` is an account
 * id, not a mailbox.
 */
export interface TraineeRecord {
  id: string;
  displayName: string;
  initials: string;
  hue: number;
  email: string;
  track: string;
  focus: string;
  skills: string[];
  bio: string;
  quote: string;
  linkedin: string;
  portfolio: string;
  consentReceived: boolean;
  consentReceivedAt: string | null;
  consentRecordedBy: string | null;
  consentWithdrawnAt: string | null;
  linksShareConsent: boolean;
  linksShareConsentAt: string | null;
  linksShareConsentRecordedBy: string | null;
  linksShareConsentWithdrawnAt: string | null;
  listing: Listing;
  publicationStatus: PublicationStatus;
  statusLabel: string;
  internalNotes: string;
  updatedAt: string;
}

/** The website's `PublicTrainee`. Email, links, notes, and consent stay off. */
export interface PublicTrainee {
  id: string;
  displayName: string;
  initials: string;
  hue: number;
  track: string;
  focus: string;
  skills: string[];
  bio: string;
  quote: string;
  listing: Listing;
  publicationStatus: PublicationStatus;
  statusLabel: string;
}

export function toPublicTrainee(row: TraineeRecord): PublicTrainee {
  return {
    id: row.id,
    displayName: row.displayName,
    initials: row.initials,
    hue: row.hue,
    track: row.track,
    focus: row.focus,
    skills: row.skills,
    bio: row.bio,
    quote: row.quote,
    listing: row.listing,
    publicationStatus: row.publicationStatus,
    statusLabel: row.statusLabel,
  };
}
