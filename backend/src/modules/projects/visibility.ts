import { isPublicRecord, type Listing, type PublicationStatus } from '../curriculum/publication.js';

export const REPOSITORY_LINK_NOTE = 'That repository link stays off the public page.';

/**
 * The project can be public without its links. Links need publication and
 * consent from every linked trainee. No linked trainee means the links stay off.
 */
export function linksArePublic(input: {
  publicationStatus: PublicationStatus;
  listing: Listing;
  traineeConsents: readonly boolean[];
}): boolean {
  return (
    isPublicRecord(input) &&
    input.traineeConsents.length > 0 &&
    input.traineeConsents.every((consent) => consent)
  );
}

export function visibleProjectLinks(input: {
  allowed: boolean;
  repositoryUrl: string;
  demoUrl: string;
  repositoryIsPublic: boolean;
}): { repositoryUrl?: string; demoUrl?: string; repositoryLinkNote: string | null } {
  if (!input.allowed) return { repositoryLinkNote: null };
  const showRepository = input.repositoryUrl !== '' && input.repositoryIsPublic;
  const note =
    input.repositoryUrl !== '' && !input.repositoryIsPublic ? REPOSITORY_LINK_NOTE : null;
  const links: { repositoryUrl?: string; demoUrl?: string; repositoryLinkNote: string | null } = {
    repositoryLinkNote: note,
  };
  if (showRepository) links.repositoryUrl = input.repositoryUrl;
  if (input.demoUrl !== '') links.demoUrl = input.demoUrl;
  return links;
}
