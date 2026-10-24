import type { Listing, PublicationStatus } from '../curriculum/publication.js';

/**
 * The admin shape. It matches the website's `Project` and adds the trainee
 * relation plus a note when a repository link will stay off the public page.
 * `shareAgreed` is the form checkbox. It does not publish the links.
 */
export interface ProjectRecord {
  id: string;
  title: string;
  slug: string;
  type: string;
  moduleId: string;
  cover: string;
  image: string;
  abstract: string;
  tools: string;
  steps: string[];
  team: string[];
  traineeIds: string[];
  repositoryUrl: string;
  demoUrl: string;
  labOnlyConfirmed: boolean;
  shareAgreed: boolean;
  publicationStatus: PublicationStatus;
  listing: Listing;
  internalNotes: string;
  repositoryLinkNote: string | null;
  updatedAt: string;
}

/** The website's public project, plus the two links only when they may be shown. */
export interface PublicProject {
  id: string;
  title: string;
  slug: string;
  type: string;
  moduleId: string;
  cover: string;
  image: string;
  abstract: string;
  tools: string;
  steps: string[];
  team: string[];
  publicationStatus: PublicationStatus;
  listing: Listing;
  repositoryUrl?: string;
  demoUrl?: string;
}

export function toPublicProject(
  row: ProjectRecord,
  links: { repositoryUrl?: string; demoUrl?: string },
): PublicProject {
  const visible: PublicProject = {
    id: row.id,
    title: row.title,
    slug: row.slug,
    type: row.type,
    moduleId: row.moduleId,
    cover: row.cover,
    image: row.image,
    abstract: row.abstract,
    tools: row.tools,
    steps: row.steps,
    team: row.team,
    publicationStatus: row.publicationStatus,
    listing: row.listing,
  };
  if (links.repositoryUrl !== undefined) visible.repositoryUrl = links.repositoryUrl;
  if (links.demoUrl !== undefined) visible.demoUrl = links.demoUrl;
  return visible;
}
