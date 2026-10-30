import type { Listing, PublicationStatus } from '../curriculum/publication.js';
import { visiblePhotoUrl } from './profile-review.js';

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
  linkedin: string | null;
  portfolio: string | null;
  headline: string;
  location: string;
  githubUrl: string | null;
  photoConsent: boolean;
  contactConsent: boolean;
  publicLinks: boolean;
  profileReviewStatus: string;
  profileRejectionReason: string;
  photoUrl: string | null;
  /** Absent from the public profile. Used only to delete the stored object. */
  photoStorageKey: string | null;
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
  lessonIds: string[];
  slug: string | null;
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
  headline: string;
  location: string;
  photoUrl: string | null;
  linkedin?: string;
  githubUrl?: string;
  portfolio?: string;
  listing: Listing;
  publicationStatus: PublicationStatus;
  statusLabel: string;
  /** True when the trainee agreed that employers may write through the site. The address stays off this object. */
  contactAvailable: boolean;
  slug?: string;
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
    headline: row.headline,
    location: row.location,
    photoUrl: visiblePhotoUrl(row.photoUrl, row.photoConsent),
    ...(row.publicLinks && row.linkedin ? { linkedin: row.linkedin } : {}),
    ...(row.publicLinks && row.githubUrl ? { githubUrl: row.githubUrl } : {}),
    ...(row.publicLinks && row.portfolio ? { portfolio: row.portfolio } : {}),
    listing: row.listing,
    publicationStatus: row.publicationStatus,
    statusLabel: row.statusLabel,
    contactAvailable: row.contactConsent,
    ...(row.slug ? { slug: row.slug } : {}),
  };
}
