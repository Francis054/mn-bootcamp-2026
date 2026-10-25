import { isListing, isPublicationStatus } from '../curriculum/publication.js';
import { isTraineeTrack } from './tracks.js';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const HTTP_URL = /^https?:\/\/\S+\.\S+/;

export function displayNameMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return 'Enter a display name.';
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Enter a display name.';
  if (trimmed.length > 120) return 'Use at most 120 characters.';
  return undefined;
}

export function emailMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return 'Enter your email address.';
  const email = value.trim();
  if (email.length > 320 || !EMAIL.test(email)) {
    return 'Enter a valid email address, like name@example.com.';
  }
  return undefined;
}

export function trackMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !isTraineeTrack(value.trim())) {
    return 'Choose Blue team, Red team, or GRC & Awareness.';
  }
  return undefined;
}

export function focusMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(value.trim())) {
    return 'Choose a module.';
  }
  return undefined;
}

/** Optional link. Blank and null are allowed. A value must be an http or https URL, matching the form. */
export function optionalHttpUrlMessage(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return 'Enter a full link starting with https://';
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > 500 || !HTTP_URL.test(trimmed)) {
    return 'Enter a full link starting with https://';
  }
  return undefined;
}

export function skillsMessage(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return 'Enter skills as a list.';
  }
  if (value.length > 20) return 'Use at most 20 skills.';
  if (value.some((item: string) => item.length > 80)) {
    return 'Use at most 80 characters for each skill.';
  }
  return undefined;
}

export function plainTextMessage(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return 'Use plain text.';
  if (value.length > max) return `Use at most ${max} characters.`;
  return undefined;
}

export function consentMessage(value: unknown): string | undefined {
  if (typeof value !== 'boolean') return 'Choose whether consent was received.';
  return undefined;
}

export function linkConsentMessage(value: unknown): string | undefined {
  if (typeof value !== 'boolean') return 'Choose whether the trainee agreed to share links.';
  return undefined;
}

export function hueMessage(value: unknown): string | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 359) {
    return 'Choose a colour from 0 to 359.';
  }
  return undefined;
}

export function initialsMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return 'Use initials of at most 8 characters.';
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 8) return 'Use initials of at most 8 characters.';
  return undefined;
}

export function publicationMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !isPublicationStatus(value)) return 'Choose a workflow state.';
  return undefined;
}

export function listingMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !isListing(value)) return 'Choose a listing.';
  return undefined;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
