import type { Listing, PublicationStatus } from '../curriculum/publication.js';
import type { StorageLabel } from '../gallery/media.entity.js';

/** The administrator shape. The storage key stays on the row and off this object. */
export interface WorkPhotoRecord {
  id: string;
  traineeId: string;
  projectId: string | null;
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  publicationStatus: PublicationStatus;
  listing: Listing;
  storageProvider: StorageLabel;
  uploadedBy: string | null;
  updatedAt: string;
}

/** What a public trainee or project page may render. Workflow and storage stay off. */
export interface PublicWorkPhoto {
  id: string;
  traineeId: string;
  projectId: string | null;
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
}

export function toPublicWorkPhoto(row: WorkPhotoRecord): PublicWorkPhoto {
  return {
    id: row.id,
    traineeId: row.traineeId,
    projectId: row.projectId,
    src: row.src,
    width: row.width,
    height: row.height,
    alt: row.alt,
    caption: row.caption,
  };
}
