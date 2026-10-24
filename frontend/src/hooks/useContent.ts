import { useMemo, useSyncExternalStore } from 'react';
import { api } from '@/api/client';
import { usesMockApi } from '@/config/runtime';
import { isPubliclyListable } from '@/domain/publish';
import { toPublicEvent, toPublicLesson, toPublicProject, toPublicTrainee } from '@/domain/publicView';
import type { AboutContent, FoundationStat, HomepageContent, MediaItem, Milestone, PublicEvent, PublicLesson, PublicProject, PublicTrainee } from '@/domain/types';
import { isApiError } from '@/domain/types';
import { FOUNDATION_STATS } from '@/dev/fixtures';
import { getState, subscribe } from '@/dev/store';
import { useAsync } from './useAsync';

export interface PublicMediaView {
  id: string;
  file: string;
  src: string;
  width: number;
  height: number;
  caption: string;
  alt: string;
  album: string;
  consent?: MediaItem['consent'];
}

export interface PublicSite {
  loading: boolean;
  error: string | null;
  homepage: HomepageContent | null;
  about: AboutContent | null;
  milestones: Milestone[];
  lessons: PublicLesson[];
  trainees: PublicTrainee[];
  projects: PublicProject[];
  events: PublicEvent[];
  media: PublicMediaView[];
  foundationStats: FoundationStat[];
}

const EMPTY: PublicSite = {
  loading: false,
  error: null,
  homepage: null,
  about: null,
  milestones: [],
  lessons: [],
  trainees: [],
  projects: [],
  events: [],
  media: [],
  foundationStats: [],
};

/** The admin overview still reads the fixture store in mock mode. */
export function useContent() {
  return useSyncExternalStore(subscribe, getState, getState);
}

async function readPublished<T>(path: string): Promise<T | null> {
  try {
    return await api<T>({ method: 'GET', path });
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}

async function loadLivePublic(): Promise<Omit<PublicSite, 'loading' | 'error'>> {
  const [homepage, about, milestones, lessons, trainees, projects, events, media, foundationStats] = await Promise.all([
    readPublished<HomepageContent>('/public/home'),
    readPublished<AboutContent>('/public/about'),
    api<Milestone[]>({ method: 'GET', path: '/public/milestones' }),
    api<PublicLesson[]>({ method: 'GET', path: '/public/classes' }),
    api<PublicTrainee[]>({ method: 'GET', path: '/public/trainees' }),
    api<PublicProject[]>({ method: 'GET', path: '/public/projects' }),
    api<PublicEvent[]>({ method: 'GET', path: '/public/events' }),
    api<PublicMediaView[]>({ method: 'GET', path: '/public/media' }),
    api<FoundationStat[]>({ method: 'GET', path: '/public/foundation-stats' }),
  ]);
  return { homepage, about, milestones, lessons, trainees, projects, events, media, foundationStats };
}

/** Mock mode keeps the labelled fixture projection. Live mode shows only published API rows. */
export function usePublicContent(): PublicSite {
  const mock = usesMockApi();
  const state = useContent();
  const remote = useAsync('live-public', loadLivePublic, !mock);
  return useMemo(() => {
    if (mock) {
      return {
        loading: false,
        error: null,
        homepage: state.homepage,
        about: state.about,
        milestones: state.milestones,
        lessons: state.lessons.filter(isPubliclyListable).map(toPublicLesson),
        trainees: state.trainees.filter(isPubliclyListable).map(toPublicTrainee),
        projects: state.projects.filter(isPubliclyListable).map(toPublicProject),
        events: state.events.filter(isPubliclyListable).map(toPublicEvent),
        media: state.media.filter(isPubliclyListable),
        foundationStats: FOUNDATION_STATS,
      };
    }
    if (remote.loading || !remote.data) return { ...EMPTY, loading: remote.loading, error: remote.error?.message ?? null };
    return { ...remote.data, loading: false, error: remote.error?.message ?? null };
  }, [mock, state, remote.data, remote.loading, remote.error]);
}
