import { ABOUT_PERSON_GROUPS, type AboutPersonGroup } from './about-person.entity.js';

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function isAboutPersonGroup(value: string): value is AboutPersonGroup {
  return (ABOUT_PERSON_GROUPS as readonly string[]).includes(value);
}

export function groupMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !isAboutPersonGroup(value)) {
    return 'Choose Founder, Team, or Partners.';
  }
  return undefined;
}

export function nameMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) return 'Enter a name.';
  if (value.trim().length > 120) return 'Use at most 120 characters.';
  return undefined;
}

/** Blank is allowed. The public page then shows the photo, name, and title only. */
export function titleMessage(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return 'Use plain text.';
  if (value.trim().length > 160) return 'Use at most 160 characters.';
  return undefined;
}

/** Blank is allowed. The public page then shows the photo, name, and title only. */
export function descriptionMessage(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return 'Use plain text.';
  if (value.trim().length > 2000) return 'Use at most 2000 characters.';
  return undefined;
}

export function displayOrderMessage(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 10_000) {
    return 'Use a whole number from 0 to 10000.';
  }
  return undefined;
}

export function publishedMessage(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') return 'Choose whether this person is published.';
  return undefined;
}

export function personIdMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !ID.test(value)) return 'That person was not found.';
  return undefined;
}

export function reorderIdsMessage(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.length === 0) return 'Choose the order.';
  if (value.length > 200) return 'That list is too long.';
  if (!value.every((item) => typeof item === 'string' && ID.test(item))) {
    return 'Choose people from this group.';
  }
  if (new Set(value).size !== value.length) return 'Each person can appear only once.';
  return undefined;
}
