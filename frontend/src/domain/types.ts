/** Frontend models for the `/api/v1` contract. The live client sends cookies, not stored tokens. */

export type Role = 'trainee' | 'trainer' | 'viewer' | 'editor' | 'administrator';

export type Permission =
  | 'content.read'
  | 'content.write'
  | 'media.upload'
  | 'media.write'
  | 'users.read'
  | 'users.manage'
  | 'settings.manage'
  | 'account.manage';

export type PublicationStatus = 'draft' | 'in_review' | 'scheduled' | 'published';

/** sample = labelled placeholder that may appear on the public site.
 *  public = intended for publication (still requires publicationStatus).
 *  hidden = administrative only.
 */
export type Listing = 'hidden' | 'sample' | 'public';

export type ScheduleStatus = 'done' | 'now' | 'upcoming';

export type ModuleId = 'network' | 'ethical' | 'vuln' | 'forensics' | 'awareness' | 'incident';

export type AlbumId = 'anniversary' | 'hackathon' | 'community';

export interface ModuleInfo {
  id: ModuleId;
  name: string;
  short: string;
  icon: string;
  summary: string;
}

export interface Lesson {
  id: string;
  week: number;
  moduleId: ModuleId;
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

export type PublicLesson = Omit<Lesson, 'internalNotes'>;

export interface Trainee {
  id: string;
  displayName: string;
  initials: string;
  hue: number;
  email: string;
  track: string;
  focus: ModuleId;
  skills: string[];
  bio: string;
  quote: string;
  linkedin: string | null;
  portfolio: string | null;
  consentReceived: boolean;
  listing: Listing;
  publicationStatus: PublicationStatus;
  statusLabel: string;
  internalNotes: string;
  lessonIds?: string[];
}

export type PublicTrainee = Omit<Trainee, 'email' | 'internalNotes' | 'linkedin' | 'portfolio' | 'consentReceived' | 'lessonIds'>;

export interface Project {
  id: string;
  title: string;
  slug: string;
  type: string;
  moduleId: ModuleId;
  cover: string;
  image: string;
  abstract: string;
  tools: string;
  steps: string[];
  team: string[];
  traineeIds?: string[];
  lessonIds?: string[];
  repositoryUrl: string;
  demoUrl: string;
  labOnlyConfirmed: boolean;
  shareAgreed: boolean;
  publicationStatus: PublicationStatus;
  listing: Listing;
  internalNotes: string;
}

export type PublicProject = Omit<Project, 'internalNotes' | 'repositoryUrl' | 'demoUrl' | 'shareAgreed' | 'labOnlyConfirmed' | 'traineeIds' | 'lessonIds'> & {
  /** Present only when every linked trainee has agreed to share the link. */
  repositoryUrl?: string;
  demoUrl?: string;
};

export type EventBody =
  | { kind: 'callout'; tone: 'lime' | 'warn' | 'plain'; title: string; text: string }
  | { kind: 'steps'; title: string; steps: string[]; note?: string }
  | { kind: 'placeholder'; text: string };

export interface BootcampEvent {
  id: string;
  title: string;
  date: string;
  dateTbc: boolean;
  whenLabel: string;
  place: string;
  kind: 'Milestone' | 'Anniversary' | 'Partner event';
  verified: boolean;
  sample: boolean;
  summary: string;
  body: EventBody;
  source: string;
  sourceUrl: string;
  image: string;
  showOnAnniversary: boolean;
  calendarDownload: boolean;
  startTime: string;
  endTime: string;
  publicationStatus: PublicationStatus;
  listing: Listing;
  internalNotes: string;
  lessonIds?: string[];
  projectIds?: string[];
  mediaIds?: string[];
}

export type PublicEvent = Omit<BootcampEvent, 'internalNotes' | 'lessonIds' | 'projectIds' | 'mediaIds'>;

export interface MediaItem {
  id: string;
  file: string;
  src: string;
  width: number;
  height: number;
  caption: string;
  alt: string;
  album: AlbumId;
  consent: 'verified' | 'pending' | 'withdrawn';
  publicationStatus: PublicationStatus;
  listing: Listing;
  uploadedBy?: string | null;
}

export interface Milestone {
  id: string;
  year: string;
  title: string;
  description: string;
  source: string;
}

export interface AboutContent {
  mission: string;
  vision: string;
  values: string[];
  address: string;
  email: string;
  website: string;
  figuresPermission: boolean;
  publicationStatus?: PublicationStatus;
}

export interface HomepageContent {
  eyebrow: string;
  headline: string;
  lead: string;
  ctaLabel: string;
  ctaHref: string;
  theme: 'dark' | 'light';
  announcement: string;
  showAnnouncement: boolean;
  footerCtaHeading: string;
  footerCtaHref: string;
  publicationStatus?: PublicationStatus;
}

export interface FoundationStat {
  id: string;
  label: string;
  value: number;
  suffix: string;
}

export interface DevUser {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  hue: number;
  role: Role;
  lastActiveLabel?: string;
  fixture?: true;
}

export interface EnquiryRecord {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  createdAt: string;
  handled?: boolean;
  notified?: boolean;
  delivered?: false;
}

export interface SiteSettings {
  siteName: string;
  timeZone: string;
  contactEmail: string;
  accent: string;
  reduceMotion: boolean;
  notifications: { projects: boolean; consent: boolean; digest: boolean };
  foundationStats?: FoundationStat[];
  publicationStatus?: PublicationStatus;
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  hue: number;
  role: Role;
}

export interface DevSession {
  mode: 'development' | 'cookie';
  user: SessionUser;
  expiresAt: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ListQuery {
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  dir?: 'asc' | 'desc';
  filters?: Record<string, string>;
}

export interface SearchHit {
  type: string;
  id: string;
  title: string;
  href: string;
}

export type ApiErrorCode =
  | 'validation'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'server'
  | 'pending';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(code: ApiErrorCode, message: string, status: number, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
