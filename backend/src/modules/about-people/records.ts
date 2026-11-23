import type { AboutPersonGroup } from './about-person.entity.js';

/** What an editor sees. The storage key stays in the database. */
export interface AboutPersonRecord {
  id: string;
  group: AboutPersonGroup;
  name: string;
  title: string;
  description: string;
  photoUrl: string | null;
  width: number;
  height: number;
  displayOrder: number;
  published: boolean;
  updatedAt: string;
}

/** What a visitor sees. Unpublished rows are not in this list. */
export interface PublicAboutPerson {
  id: string;
  group: AboutPersonGroup;
  name: string;
  title: string;
  description: string;
  photoUrl: string | null;
  width: number;
  height: number;
  displayOrder: number;
}

export function toPublicAboutPerson(row: AboutPersonRecord): PublicAboutPerson {
  return {
    id: row.id,
    group: row.group,
    name: row.name,
    title: row.title,
    description: row.description,
    photoUrl: row.photoUrl,
    width: row.width,
    height: row.height,
    displayOrder: row.displayOrder,
  };
}
