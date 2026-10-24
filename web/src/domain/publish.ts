import type { Listing, PublicationStatus } from './types';

export interface Listable {
  listing: Listing;
  publicationStatus: PublicationStatus;
}

/** Public pages may receive only records that pass this predicate.
 *  Sample listings are labelled placeholders. Hidden and unpublished
 *  non-sample records stay on the administrative side.
 */
export function isPubliclyListable(item: Listable): boolean {
  if (item.listing === 'hidden') return false;
  if (item.listing === 'sample') return true;
  return item.publicationStatus === 'published' || item.publicationStatus === 'scheduled';
}

export function stripKeys<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
  const copy: Partial<T> = { ...value };
  for (const key of keys) delete copy[key];
  return copy as Omit<T, K>;
}
