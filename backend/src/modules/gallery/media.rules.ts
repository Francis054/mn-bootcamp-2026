import { isListing, isPublicationStatus } from '../curriculum/publication.js';

export const ALBUMS = ['anniversary', 'hackathon', 'community'] as const;
export type AlbumId = (typeof ALBUMS)[number];

const ALT = 'Describe the image without naming anyone.';

export function isAlbum(value: string): value is AlbumId {
  return (ALBUMS as readonly string[]).includes(value);
}

export function altMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) return ALT;
  if (value.trim().length > 300) return 'Use at most 300 characters.';
  return undefined;
}

export function captionMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return 'Use plain text.';
  if (value.length > 500) return 'Use at most 500 characters.';
  return undefined;
}

export function albumMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !isAlbum(value.trim())) return 'Choose an album.';
  return undefined;
}

export function fileMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^[A-Za-z0-9-]{1,80}$/.test(value.trim())) {
    return 'Use a short file name.';
  }
  return undefined;
}

export function dimensionMessage(value: unknown): string | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 20_000) {
    return 'Use a width and height between 1 and 20000.';
  }
  return undefined;
}

export function consentMessage(value: unknown): string | undefined {
  if (value === 'pending' || value === 'verified') return undefined;
  if (value === 'withdrawn') return 'Use the withdrawal action to remove consent.';
  return 'Choose pending or verified.';
}

export function publicationMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !isPublicationStatus(value)) return 'Choose a workflow state.';
  return undefined;
}

export function listingMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !isListing(value)) return 'Choose a listing.';
  return undefined;
}

export function imageSizeMessage(maxBytes: number): string {
  const megabytes = maxBytes / (1024 * 1024);
  if (Number.isInteger(megabytes)) return `Use an image of at most ${megabytes} MB.`;
  return `Use an image of at most ${maxBytes} bytes.`;
}
