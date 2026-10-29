import type { Listing, PublicationStatus } from '../curriculum/publication.js';
import type { ReviewStatus } from './profile-review.js';

/** Wording trainees see and that each consent row stores. No age or retention term. */
export const CONSENT_POLICY_VERSION = '2026-10-28';

export const CONSENT_SCOPES = [
  'public_profile',
  'public_photo',
  'contact_relay',
  'cv_public',
  'cv_on_request',
] as const;
export type ConsentScope = (typeof CONSENT_SCOPES)[number];

export const CONSENT_WORDING: Record<ConsentScope, string> = {
  public_profile:
    'I agree that my name, headline, short bio, location, and links may appear on the public bootcamp site after an administrator approves them.',
  public_photo:
    'I agree that my profile photo may appear on the public bootcamp site after an administrator approves it.',
  contact_relay:
    'I agree that employers may contact me through the bootcamp site. My email address stays hidden.',
  cv_public:
    'I agree that my CV may be downloaded from the public bootcamp site after an administrator approves it.',
  cv_on_request:
    'I agree that my CV may be shared when someone asks through the bootcamp site, after an administrator approves it. The file stays off the public page until I choose public.',
};

export function isConsentScope(value: string): value is ConsentScope {
  return (CONSENT_SCOPES as readonly string[]).includes(value);
}

/**
 * Public-profile consent. Withdrawing it unpublishes immediately.
 * Granting it publishes only an already approved profile that an administrator has not hidden.
 */
export function applyPublicProfileConsent(input: {
  granted: boolean;
  reviewStatus: ReviewStatus;
  listing: Listing;
  publicationStatus: PublicationStatus;
}): { consentReceived: boolean; publicationStatus: PublicationStatus; withdrawing: boolean } {
  if (!input.granted) {
    return { consentReceived: false, publicationStatus: 'draft', withdrawing: true };
  }
  if (input.reviewStatus === 'approved' && input.listing !== 'hidden') {
    return { consentReceived: true, publicationStatus: 'published', withdrawing: false };
  }
  return {
    consentReceived: true,
    publicationStatus: input.publicationStatus,
    withdrawing: false,
  };
}

export interface ConsentChoices {
  publicProfile?: boolean;
  publicPhoto?: boolean;
  contactRelay?: boolean;
}

export function readConsentChoices(body: unknown): {
  value: ConsentChoices;
  errors: Record<string, string>;
} {
  if (!isRecord(body)) return { value: {}, errors: { form: 'Check the highlighted fields.' } };
  const errors: Record<string, string> = {};
  const value: ConsentChoices = {};
  readFlag(body, 'publicProfile', errors, value);
  readFlag(body, 'publicPhoto', errors, value);
  readFlag(body, 'contactRelay', errors, value);
  if (!('publicProfile' in value) && !('publicPhoto' in value) && !('contactRelay' in value)) {
    errors.form = 'Choose the consent items you want to change.';
  }
  return { value, errors };
}

function readFlag(
  body: Record<string, unknown>,
  key: keyof ConsentChoices,
  errors: Record<string, string>,
  value: ConsentChoices,
): void {
  if (!(key in body)) return;
  if (typeof body[key] !== 'boolean') {
    errors[key] = 'Choose yes or no.';
    return;
  }
  value[key] = body[key];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
