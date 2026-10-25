import { buildApiUrl } from './liveTransport';

/**
 * How long a saved public page counts as fresh.
 * Older copies still show immediately while a refresh runs in the background.
 */
export const PUBLIC_CACHE_FRESH_MS = 8 * 60 * 1000;

const STORAGE_PREFIX = 'mn-public-cache:';
const CHANNEL_NAME = 'mn-public-cache';
const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface CacheEntry {
  storedAt: number;
  data: unknown;
}

const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();
const listeners = new Set<() => void>();

let revision = 0;
let clearCount = 0;
let generation = 0;
let channel: BroadcastChannel | null = null;

function cacheChannel(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data === 'clear') clearPublicCache({ announce: false });
    };
  } catch {
    channel = null;
  }
  return channel;
}

function notify(): void {
  revision += 1;
  for (const listener of listeners) listener();
}

function storageKey(url: string): string {
  return `${STORAGE_PREFIX}${url}`;
}

function isFreshStored(storedAt: number, now: number): boolean {
  return now - storedAt <= PUBLIC_CACHE_FRESH_MS;
}

function readStorage(url: string): CacheEntry | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(storageKey(url));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const storedAt = 'storedAt' in parsed ? parsed.storedAt : undefined;
    if (typeof storedAt !== 'number') return null;
    const data = 'data' in parsed ? parsed.data : undefined;
    const entry = { storedAt, data };
    memory.set(url, entry);
    return entry;
  } catch {
    return null;
  }
}

function readEntry(url: string): CacheEntry | null {
  return memory.get(url) ?? readStorage(url);
}

function writeEntry(url: string, data: unknown, storedAt = Date.now()): void {
  let copy: unknown;
  try {
    copy = JSON.parse(JSON.stringify(data)) as unknown;
  } catch {
    return;
  }
  const entry = { storedAt, data: copy };
  memory.set(url, entry);
  try {
    sessionStorage.setItem(storageKey(url), JSON.stringify(entry));
  } catch {
    // A full or blocked tab still keeps the copy in memory for this visit.
  }
  notify();
}

function removeStoredCopies(): void {
  if (typeof sessionStorage === 'undefined') return;
  const keys: string[] = [];
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index);
    if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
  }
  for (const key of keys) sessionStorage.removeItem(key);
}

export function publicRequestUrl(path: string): string {
  const withPrefix = path.startsWith('/api/v1/')
    ? path
    : `/api/v1${path.startsWith('/') ? path : `/${path}`}`;
  return buildApiUrl(withPrefix);
}

export function isCacheablePublicGet(method: string, path: string): boolean {
  if (method !== 'GET') return false;
  const pathname = path.split('?')[0] ?? path;
  return pathname.startsWith('/api/v1/public/');
}

/** Publish, unpublish, and other admin edits should drop the saved public pages in this browser. */
export function isAdminWrite(method: string, path: string): boolean {
  if (!WRITES.has(method)) return false;
  const pathname = path.split('?')[0] ?? path;
  return pathname === '/api/v1/admin' || pathname.startsWith('/api/v1/admin/');
}

export function readPublicCache<T>(url: string, now = Date.now()): { data: T; storedAt: number; fresh: boolean } | null {
  const entry = readEntry(url);
  if (!entry) return null;
  return { data: entry.data as T, storedAt: entry.storedAt, fresh: isFreshStored(entry.storedAt, now) };
}

export function writePublicCache(url: string, data: unknown, storedAt = Date.now()): void {
  writeEntry(url, data, storedAt);
}

export function isPublicCacheFresh(url: string, now = Date.now()): boolean {
  const entry = readEntry(url);
  return entry !== null && isFreshStored(entry.storedAt, now);
}

export function getPublicCacheVersion(): number {
  return revision;
}

export function getPublicCacheClearCount(): number {
  return clearCount;
}

export function subscribePublicCache(listener: () => void): () => void {
  cacheChannel();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearPublicCache(options?: { announce?: boolean }): void {
  generation += 1;
  clearCount += 1;
  inflight.clear();
  memory.clear();
  removeStoredCopies();
  if (options?.announce !== false) {
    try {
      cacheChannel()?.postMessage('clear');
    } catch {
      // Another tab can keep its copy until it refreshes on its own.
    }
  }
  notify();
}

export function resetPublicCacheForTests(): void {
  clearPublicCache({ announce: false });
}

function startFetch<T>(url: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflight.get(url);
  if (existing) return existing as Promise<T>;
  const ticket = generation;
  const pending = fetcher()
    .then((data) => {
      if (ticket === generation) writeEntry(url, data);
      return data;
    })
    .finally(() => {
      if (inflight.get(url) === pending) inflight.delete(url);
    });
  inflight.set(url, pending);
  return pending;
}

/**
 * Fresh copies return without a request. Stale copies return immediately and refresh behind the scenes.
 * A missing copy waits for the network. Failures and 404s are not stored.
 */
export async function readThroughPublicCache<T>(url: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = readEntry(url);
  const pending = cached !== null && isFreshStored(cached.storedAt, Date.now()) ? null : startFetch(url, fetcher);
  if (cached) {
    if (pending) void pending.then(() => undefined, () => undefined);
    return cached.data as T;
  }
  if (!pending) return startFetch(url, fetcher);
  return pending;
}

/** Resolves when the background refresh for this URL finishes, including a failed one. */
export function settlePublicCache(url: string): Promise<void> {
  const pending = inflight.get(url);
  if (!pending) return Promise.resolve();
  return pending.then(() => undefined, () => undefined);
}
