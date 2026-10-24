import type {
  AboutContent,
  BootcampEvent,
  DevUser,
  EnquiryRecord,
  HomepageContent,
  Lesson,
  MediaItem,
  Milestone,
  Project,
  SiteSettings,
  Trainee,
} from '@/domain/types';
import { ABOUT, buildEvents, buildLessons, buildMedia, buildMilestones, buildProjects, buildTrainees, DEV_USERS, HOMEPAGE, SETTINGS } from './fixtures';

export interface ContentState {
  lessons: Lesson[];
  trainees: Trainee[];
  projects: Project[];
  events: BootcampEvent[];
  media: MediaItem[];
  milestones: Milestone[];
  about: AboutContent;
  homepage: HomepageContent;
  settings: SiteSettings;
  users: DevUser[];
  enquiries: EnquiryRecord[];
}

type Listener = () => void;

let state: ContentState = createInitialState();
const listeners = new Set<Listener>();

export function createInitialState(): ContentState {
  return {
    lessons: buildLessons(),
    trainees: buildTrainees(),
    projects: buildProjects(),
    events: buildEvents(),
    media: buildMedia(),
    milestones: buildMilestones(),
    about: structuredClone(ABOUT),
    homepage: structuredClone(HOMEPAGE),
    settings: structuredClone(SETTINGS),
    users: structuredClone(DEV_USERS),
    enquiries: [],
  };
}

export function getState(): ContentState {
  return state;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateState(recipe: (current: ContentState) => ContentState): ContentState {
  state = recipe(state);
  listeners.forEach((listener) => listener());
  return state;
}

export function resetState(): void {
  state = createInitialState();
  listeners.forEach((listener) => listener());
}
