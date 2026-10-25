import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { api } from '@/api/client';
import { getPublicCacheClearCount, getPublicCacheVersion, isPublicCacheFresh, publicRequestUrl, readPublicCache, subscribePublicCache } from '@/api/publicCache';
import { usesMockApi } from '@/config/runtime';
import { isPubliclyListable } from '@/domain/publish';
import { normalizeAbout, normalizeEvents, normalizeHomepage, normalizeLessons, normalizeMedia, normalizeMilestones, normalizeProjects, normalizeStats, normalizeTrainees, type SafePublicMedia } from '@/domain/publicContract';
import { toPublicEvent, toPublicLesson, toPublicProject, toPublicTrainee } from '@/domain/publicView';
import type { AboutContent, FoundationStat, HomepageContent, Milestone, PublicEvent, PublicLesson, PublicProject, PublicTrainee } from '@/domain/types';
import { isApiError } from '@/domain/types';
import { FOUNDATION_STATS } from '@/dev/fixtures';
import { getState, subscribe } from '@/dev/store';

export type PublicMediaView = SafePublicMedia;

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

type PublicSnapshot = Omit<PublicSite, 'loading' | 'error'>;

/** Published pages the public site reads. Detail URLs are cached when a page asks for one. */
const PUBLIC_SITE_PATHS = [
  '/public/home',
  '/public/about',
  '/public/events',
  '/public/projects',
  '/public/classes',
  '/public/trainees',
  '/public/milestones',
  '/public/media',
  '/public/foundation-stats',
] as const;

const OPTIONAL_PUBLIC_PATHS = new Set<string>(['/public/home', '/public/about']);

function readCachedPublicSite(): PublicSnapshot | null {
  const present = PUBLIC_SITE_PATHS.some((path) => readPublicCache(publicRequestUrl(path)) !== null);
  if (!present) return null;
  const read = (path: string) => readPublicCache(publicRequestUrl(path))?.data;
  return {
    homepage: normalizeHomepage(read('/public/home')),
    about: normalizeAbout(read('/public/about')),
    milestones: normalizeMilestones(read('/public/milestones')),
    lessons: normalizeLessons(read('/public/classes')),
    trainees: normalizeTrainees(read('/public/trainees')),
    projects: normalizeProjects(read('/public/projects')),
    events: normalizeEvents(read('/public/events')),
    media: normalizeMedia(read('/public/media')),
    foundationStats: normalizeStats(read('/public/foundation-stats')),
  };
}

async function loadPublicPath(path: string): Promise<void> {
  try {
    await api({ method: 'GET', path });
  } catch (error) {
    if (OPTIONAL_PUBLIC_PATHS.has(path) && isApiError(error) && error.status === 404) return;
    throw error;
  }
}

function failureMessage(error: unknown): string {
  if (isApiError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'The published site could not be loaded.';
}

/** Mock mode keeps the labelled fixture projection. Live mode shows a saved copy, then refreshes it in place. */
export function usePublicContent(): PublicSite {
  const mock = usesMockApi();
  const state = useContent();
  const revision = useSyncExternalStore(subscribePublicCache, getPublicCacheVersion, getPublicCacheVersion);
  const clears = useSyncExternalStore(subscribePublicCache, getPublicCacheClearCount, getPublicCacheClearCount);
  // revision is the signal that a saved response changed. Reading storage on that render keeps the page in place.
  const cached = !mock && revision >= 0 ? readCachedPublicSite() : null;
  const [showCached, setShowCached] = useState(() => readCachedPublicSite() !== null);
  const [booting, setBooting] = useState(() => readCachedPublicSite() === null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (mock) return;
    let cancel = false;
    const stale = PUBLIC_SITE_PATHS.filter((path) => !isPublicCacheFresh(publicRequestUrl(path)));
    if (stale.length === 0) {
      setBooting(false);
      setShowCached(readCachedPublicSite() !== null);
      setFailure(null);
      return;
    }
    if (readCachedPublicSite() === null) {
      setShowCached(false);
      setBooting(true);
    }
    void Promise.allSettled(stale.map((path) => loadPublicPath(path))).then((results) => {
      if (cancel) return;
      setBooting(false);
      if (readCachedPublicSite() !== null) {
        setShowCached(true);
        setFailure(null);
        return;
      }
      const rejected = results.find((result) => result.status === 'rejected');
      setShowCached(false);
      setFailure(failureMessage(rejected && rejected.status === 'rejected' ? rejected.reason : null));
    });
    return () => {
      cancel = true;
    };
  }, [mock, clears]);

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
    if (showCached && cached) return { ...cached, loading: false, error: null };
    if (booting) return { ...EMPTY, loading: true, error: null };
    return { ...EMPTY, loading: false, error: failure };
  }, [mock, state, showCached, cached, booting, failure]);
}
