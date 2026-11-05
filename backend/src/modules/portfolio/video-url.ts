const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const YOUTU_BE_HOSTS = new Set(['youtu.be', 'www.youtu.be']);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);
const LOOM_HOSTS = new Set(['loom.com', 'www.loom.com']);

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;
const LOOM_ID = /^[A-Za-z0-9]{16,64}$/;

export const VIDEO_LINK_MESSAGE = 'Use a YouTube, Vimeo, or Loom link.';

export type VideoProvider = 'youtube' | 'vimeo' | 'loom';

export interface ParsedVideoLink {
  provider: VideoProvider;
  externalId: string;
}

/**
 * Accept only the official hosts, compared as whole hostnames.
 * A name that merely contains "youtube", "vimeo", or "loom" is refused.
 * The stored value is the provider and the id. The page builds the embed.
 */
export function parseVideoLink(raw: string): ParsedVideoLink | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 500) return undefined;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') return undefined;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (YOUTU_BE_HOSTS.has(host)) {
    const externalId = firstSegment(url);
    return YOUTUBE_ID.test(externalId) ? { provider: 'youtube', externalId } : undefined;
  }
  if (YOUTUBE_HOSTS.has(host)) {
    const externalId = youtubeId(url);
    return externalId ? { provider: 'youtube', externalId } : undefined;
  }
  if (VIMEO_HOSTS.has(host)) {
    const externalId = vimeoId(url, host);
    return externalId ? { provider: 'vimeo', externalId } : undefined;
  }
  if (LOOM_HOSTS.has(host)) {
    const externalId = loomId(url);
    return externalId ? { provider: 'loom', externalId } : undefined;
  }
  return undefined;
}

/** Official privacy-friendly embed. Returns nothing for an id that failed the allow-list. */
export function videoEmbedUrl(provider: string, externalId: string): string | null {
  if (provider === 'youtube' && YOUTUBE_ID.test(externalId)) {
    return `https://www.youtube-nocookie.com/embed/${externalId}`;
  }
  if (provider === 'vimeo' && VIMEO_ID.test(externalId)) {
    return `https://player.vimeo.com/video/${externalId}?dnt=1`;
  }
  if (provider === 'loom' && LOOM_ID.test(externalId)) {
    return `https://www.loom.com/embed/${externalId}`;
  }
  return null;
}

function youtubeId(url: URL): string | undefined {
  const fromQuery = url.searchParams.get('v') ?? '';
  if (YOUTUBE_ID.test(fromQuery)) return fromQuery;
  const parts = segments(url);
  const head = parts[0] ?? '';
  if (head === 'embed' || head === 'shorts' || head === 'live' || head === 'v') {
    const externalId = parts[1] ?? '';
    if (YOUTUBE_ID.test(externalId)) return externalId;
  }
  return undefined;
}

function vimeoId(url: URL, host: string): string | undefined {
  const parts = segments(url);
  if (host === 'player.vimeo.com') {
    if (parts[0] !== 'video') return undefined;
    return VIMEO_ID.test(parts[1] ?? '') ? parts[1] : undefined;
  }
  const externalId = parts[parts.length - 1] ?? '';
  return VIMEO_ID.test(externalId) ? externalId : undefined;
}

function loomId(url: URL): string | undefined {
  const parts = segments(url);
  if (parts.length !== 2) return undefined;
  if (parts[0] !== 'share' && parts[0] !== 'embed') return undefined;
  return LOOM_ID.test(parts[1] ?? '') ? parts[1] : undefined;
}

function firstSegment(url: URL): string {
  return segments(url)[0] ?? '';
}

function segments(url: URL): string[] {
  return url.pathname.split('/').filter((part) => part.length > 0);
}
