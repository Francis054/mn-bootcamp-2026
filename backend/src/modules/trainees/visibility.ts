import { isPublicRecord, type Listing, type PublicationStatus } from '../curriculum/publication.js';

export const CONSENT_REQUIRED = 'Consent is required before this profile can be published.';

/**
 * A public profile needs the same publication rule as a class, plus consent.
 * A sample label does not publish a draft, and a hidden listing stays hidden.
 */
export function isPublicTrainee(row: {
  publicationStatus: PublicationStatus;
  listing: Listing;
  consentReceived: boolean;
}): boolean {
  return isPublicRecord(row) && row.consentReceived;
}

export interface ConsentWrite {
  publicationStatus: PublicationStatus;
  /** True when consent is being cleared. That forces draft in the same write. */
  withdrawing: boolean;
}

/**
 * Clearing consent unpublishes immediately, even if the same body asks to
 * publish. Asking to publish while consent is false is refused.
 */
export function consentWrite(input: {
  currentConsent: boolean;
  requestedConsent: boolean;
  requestedStatus: PublicationStatus;
}): ConsentWrite | 'refused' {
  const withdrawing = input.currentConsent && !input.requestedConsent;
  if (withdrawing) {
    return { publicationStatus: 'draft', withdrawing: true };
  }
  if (input.requestedStatus === 'published' && !input.requestedConsent) {
    return 'refused';
  }
  return { publicationStatus: input.requestedStatus, withdrawing: false };
}
