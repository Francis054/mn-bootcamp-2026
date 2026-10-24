import { isListing, isPublicationStatus } from '../curriculum/publication.js';
import { clockMessage, dateMessage } from './event-time.js';
import { isEventKind } from './event-types.js';
import { sourceUrlProblem } from './source-url.js';

export { clockMessage, dateMessage, sourceUrlProblem };

const PLACE = 'Enter a venue, or “Venue to be confirmed”.';

export function titleMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) return 'Give the event a name.';
  if (value.trim().length > 200) return 'Use at most 200 characters.';
  return undefined;
}

export function placeMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) return PLACE;
  if (value.trim().length > 200) return 'Use at most 200 characters.';
  return undefined;
}

export function summaryMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return 'Write a summary of at least 20 characters.';
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Write a summary of at least 20 characters.';
  if (trimmed.length < 20) return 'Use at least 20 characters.';
  if (trimmed.length > 5000) return 'Use at most 5000 characters.';
  return undefined;
}

export function kindMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !isEventKind(value.trim())) return 'Choose a kind.';
  return undefined;
}

export function plainTextMessage(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return 'Use plain text.';
  if (value.length > max) return `Use at most ${max} characters.`;
  return undefined;
}

export function booleanMessage(value: unknown, sentence: string): string | undefined {
  if (typeof value !== 'boolean') return sentence;
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
