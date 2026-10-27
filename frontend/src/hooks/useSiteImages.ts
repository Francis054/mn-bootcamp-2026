import { useEffect, useSyncExternalStore } from 'react';
import { api } from '@/api/client';
import { getPublicCacheClearCount, subscribePublicCache } from '@/api/publicCache';
import {
  indexSiteImages,
  resolveSiteImage,
  type ResolvedSiteImage,
  type SiteImageKey,
} from '@/domain/siteImages';

type RemoteMap = ReturnType<typeof indexSiteImages>;

const EMPTY: RemoteMap = new Map();
let snapshot: RemoteMap = EMPTY;
let loaded = false;
let loading: Promise<void> | null = null;
let generation = 0;
let hooked = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function hookCache(): void {
  if (hooked) return;
  hooked = true;
  subscribePublicCache(() => {
    generation += 1;
    loaded = false;
    loading = null;
    snapshot = EMPTY;
    if (listeners.size === 0) return;
    void loadSiteImages();
  });
}

export function loadSiteImages(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loading) return loading;
  const ticket = generation;
  loading = api<unknown>({ method: 'GET', path: '/public/site-images' })
    .then((body) => {
      if (ticket !== generation) return;
      snapshot = indexSiteImages(body);
      loaded = true;
    })
    .catch(() => {
      if (ticket !== generation) return;
      snapshot = EMPTY;
      loaded = true;
    })
    .finally(() => {
      if (ticket !== generation) return;
      loading = null;
      emit();
    });
  return loading;
}

/** Drop the saved list so the next read picks up an edit from this tab. */
export function refreshSiteImages(): void {
  generation += 1;
  loaded = false;
  loading = null;
  void loadSiteImages();
}

export function resetSiteImagesForTests(): void {
  generation += 1;
  loaded = false;
  loading = null;
  snapshot = EMPTY;
}

export function subscribeSiteImages(listener: () => void): () => void {
  hookCache();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSiteImageMap(): RemoteMap {
  return snapshot;
}

export function useSiteImage(key: SiteImageKey): ResolvedSiteImage {
  const map = useSyncExternalStore(subscribeSiteImages, getSiteImageMap, () => EMPTY);
  const clears = useSyncExternalStore(subscribePublicCache, getPublicCacheClearCount, () => 0);
  useEffect(() => {
    void loadSiteImages();
  }, [clears]);
  return resolveSiteImage(key, map.get(key));
}
