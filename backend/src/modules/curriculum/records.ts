import type { Listing, PublicationStatus } from './publication.js';
import type { ScheduleStatus } from './schedule.js';

/** The class shape `web/src/domain/types.ts` calls `Lesson`. */
export interface LessonRecord {
  id: string;
  week: number;
  moduleId: string;
  title: string;
  slug: string;
  date: string;
  format: string;
  phase: 1 | 2 | 3;
  scheduleStatus: ScheduleStatus;
  publicationStatus: PublicationStatus;
  listing: Listing;
  room: string;
  summary: string;
  objectives: string[];
  lab: string;
  codeSample: string;
  cover: string;
  internalNotes: string;
  updatedAt: string;
}

export type PublicLesson = Omit<LessonRecord, 'internalNotes'>;

export function toPublicLesson(lesson: LessonRecord): PublicLesson {
  const { internalNotes: _notes, ...visible } = lesson;
  return visible;
}

export interface TrackRecord {
  id: string;
  name: string;
  summary: string;
  sortOrder: number;
  publicationStatus: PublicationStatus;
  listing: Listing;
  updatedAt: string;
}

/** What a public page needs. The name is the string a later trainee row will store. */
export interface PublicTrack {
  id: string;
  name: string;
  summary: string;
}

export interface ModuleRecord {
  id: string;
  name: string;
  short: string;
  icon: string;
  summary: string;
  sortOrder: number;
  publicationStatus: PublicationStatus;
  listing: Listing;
  updatedAt: string;
}

/** The same fields as the website's `ModuleInfo`. */
export interface PublicModule {
  id: string;
  name: string;
  short: string;
  icon: string;
  summary: string;
}

export interface PhaseRecord {
  id: number;
  name: string;
  months: string;
  summary: string;
  moduleIds: string[];
  modules: string[];
  publicationStatus: PublicationStatus;
  listing: Listing;
  updatedAt: string;
}

/** The same fields as the website's phase constant. `modules` is the display names. */
export interface PublicPhase {
  id: number;
  name: string;
  months: string;
  summary: string;
  modules: string[];
}
