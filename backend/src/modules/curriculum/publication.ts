export const PUBLICATION_STATUSES = ['draft', 'in_review', 'scheduled', 'published'] as const;
export const LISTINGS = ['hidden', 'sample', 'public'] as const;

export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
export type Listing = (typeof LISTINGS)[number];

export function isPublicationStatus(value: string): value is PublicationStatus {
  return (PUBLICATION_STATUSES as readonly string[]).includes(value);
}

export function isListing(value: string): value is Listing {
  return (LISTINGS as readonly string[]).includes(value);
}

/**
 * The live public rule. A sample label does not publish a draft, and a hidden
 * row stays off the public site even after it is marked published.
 */
export function isPublicRecord(row: {
  publicationStatus: PublicationStatus;
  listing: Listing;
}): boolean {
  return row.publicationStatus === 'published' && row.listing !== 'hidden';
}
