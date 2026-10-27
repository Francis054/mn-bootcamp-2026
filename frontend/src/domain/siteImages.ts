/** Built-in pictures. Keys, labels, and addresses match the API catalogue. */

export const DEFAULT_BADGE_TAGLINE = 'STRONGER TOGETHER';

export const SITE_IMAGE_SLOTS = [
  {
    key: 'community-logo',
    label: 'Community logo',
    description: 'White-hat community mark: a photograph of a person in a white cap at a laptop, graded in forest and lime inside a round badge. Header, footer, sign-in, admin sidebar, seals, empty states, and the favicon. An uploaded image replaces it. The tagline sits under the larger seals.',
    url: '/assets/logo/community-badge.webp',
    alt: 'Cyber Bootcamp community logo',
    width: 1024,
    height: 1024,
    fit: 'contain',
    tagline: 'STRONGER TOGETHER',
  },
  {
    key: 'foundation-logo',
    label: 'Maxim Nyansa Foundation logo',
    description: 'Parent-organisation wordmark. Header and footer plate, sign-in form, admin sidebar, about page, and the loader footer. It is not the community logo. A larger PNG or WebP stays sharper. SVG files are not accepted.',
    url: '/assets/logo/maxim-nyansa-foundation-logo.png',
    alt: 'Maxim Nyansa Foundation logo',
    width: 200,
    height: 41,
    fit: 'contain',
  },
  { key: 'home-hero-main', label: 'Homepage hero, main photo', description: 'The large photo on the homepage hero. The frame stays wide so a group photo is not cropped.', url: '/assets/img/participant-portrait-1600.webp', alt: 'The Maxim Nyansa Foundation group in white 10-year shirts, posed in front of the anniversary banner', width: 1600, height: 756, fit: 'contain' },
  { key: 'home-hero-side', label: 'Homepage hero, side photo', description: 'The upper small photo on the homepage hero.', url: '/assets/img/hack-coding-team-1600.webp', alt: 'A team working together at a laptop', width: 1600, height: 1066, fit: 'cover' },
  { key: 'home-hero-accent', label: 'Homepage hero, accent photo', description: 'The lower small photo on the homepage hero.', url: '/assets/img/vr-headset-moment-1600.webp', alt: 'Trying out a VR headset at an event', width: 1600, height: 1066, fit: 'cover' },
  { key: 'home-class-peek-1', label: 'Homepage class row, first hover photo', description: 'The picture that follows the pointer on the first featured class. Later rows repeat these four pictures.', url: '/assets/img/electronics-lab-1600.webp', alt: 'Hands-on work at a Foundation build table', width: 1600, height: 1066, fit: 'cover' },
  { key: 'home-class-peek-2', label: 'Homepage class row, second hover photo', description: 'The pointer picture for the second featured class row.', url: '/assets/img/hack-coding-team-1600.webp', alt: 'A team working together at a laptop', width: 1600, height: 1066, fit: 'cover' },
  { key: 'home-class-peek-3', label: 'Homepage class row, third hover photo', description: 'The pointer picture for the third featured class row.', url: '/assets/img/vr-demo-group-1600.webp', alt: 'A group gathered around a VR demonstration', width: 1600, height: 1066, fit: 'cover' },
  { key: 'home-class-peek-4', label: 'Homepage class row, fourth hover photo', description: 'The pointer picture for the fourth featured class row.', url: '/assets/img/presenters-yellow-room-1600.webp', alt: 'Presenters speaking in a yellow room', width: 1600, height: 1066, fit: 'cover' },
  { key: 'bootcamp-banner', label: 'Bootcamp overview banner', description: 'The wide photo under the facts on the bootcamp overview page.', url: '/assets/img/electronics-lab-1600.webp', alt: 'Hands-on work at a Foundation build table', width: 1600, height: 1066, fit: 'cover' },
  { key: 'about-banner', label: 'About page banner', description: 'The wide photo under the introduction on the about page.', url: '/assets/img/anniversary-group-outdoor-1600.webp', alt: 'An outdoor group photo at a Foundation event', width: 1600, height: 1067, fit: 'cover' },
  { key: 'sign-in-panel', label: 'Sign-in panel photo', description: 'The photograph behind the words on the sign-in page.', url: '/assets/img/electronics-lab-1600.webp', alt: 'Hands-on work at a Foundation build table', width: 1600, height: 1067, fit: 'cover' },
] as const;

export type SiteImageKey = (typeof SITE_IMAGE_SLOTS)[number]['key'];
export type SiteImageFit = 'cover' | 'contain';

export interface SiteImageSlot {
  key: SiteImageKey;
  label: string;
  description: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  fit: SiteImageFit;
  tagline?: string;
}

export interface SiteImageAdmin {
  key: string;
  label: string;
  description: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  fit: SiteImageFit;
  defaultUrl: string;
  defaultAlt: string;
  tagline: string;
  usingDefault: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

export interface ResolvedSiteImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  fit: SiteImageFit;
  fallbackSrc: string;
  srcSet?: string;
  fallbackSrcSet?: string;
  tagline: string;
  /** The community slot is still the bundled photograph, so the page draws the round badge and its tagline. */
  liveBadge: boolean;
}

const ASSET_PATH = /^\/assets\/(?:[a-z0-9][a-z0-9._-]*\/)*[a-z0-9][a-z0-9._-]*$/i;
const LOCAL_UPLOAD = /^\/api\/v1\/public\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA_IMAGE = /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/]+={0,2}$/i;
const PAIR = /^\/assets\/img\/([a-z0-9-]+)-1600\.webp$/i;

const BY_KEY = new Map(SITE_IMAGE_SLOTS.map((slot) => [slot.key, slot]));

export function slotTagline(slot: object | null | undefined): string {
  if (!slot || !('tagline' in slot)) return '';
  const value = slot.tagline;
  return typeof value === 'string' ? value : '';
}

export function siteImageSlot(key: string): SiteImageSlot | undefined {
  return BY_KEY.get(key as SiteImageKey);
}

export function isSiteImageKey(value: string): value is SiteImageKey {
  return BY_KEY.has(value as SiteImageKey);
}

/** An address an img tag may use. Anything else is ignored and the bundled file stays. */
export function safeSiteImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('..') || trimmed.includes('\\') || /\s/.test(trimmed)) return null;
  if (DATA_IMAGE.test(trimmed)) return trimmed.length <= 8_000_000 ? trimmed : null;
  if (trimmed.length > 1000) return null;
  if (ASSET_PATH.test(trimmed) || LOCAL_UPLOAD.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return trimmed;
  } catch {
    return null;
  }
}

export function bundledSrcSet(url: string): string | undefined {
  const name = PAIR.exec(url)?.[1];
  if (!name) return undefined;
  return `/assets/img/${name}-800.webp 800w, /assets/img/${name}-1600.webp 1600w`;
}

export function siteImageAltError(value: string): string | undefined {
  if (value.trim().length > 300) return 'Use at most 300 characters.';
  return undefined;
}

export function siteImageTaglineError(value: string): string | undefined {
  if (/[\r\n]/.test(value)) return 'Use a single line.';
  if (value.trim().length > 40) return 'Use at most 40 characters.';
  return undefined;
}

export function resolveSiteImage(key: SiteImageKey, remote?: { url?: unknown; alt?: unknown; width?: unknown; height?: unknown; fit?: unknown; tagline?: unknown } | null): ResolvedSiteImage {
  const fallback = BY_KEY.get(key);
  if (!fallback) {
    return { src: '', alt: '', width: 1, height: 1, fit: 'cover', fallbackSrc: '', tagline: '', liveBadge: false };
  }
  const remoteUrl = remote ? safeSiteImageUrl(remote.url) : null;
  const src = remoteUrl ?? fallback.url;
  const alt = remote && typeof remote.alt === 'string' && remote.alt.trim().length <= 300 ? remote.alt.trim() : fallback.alt;
  const tagline = remote && typeof remote.tagline === 'string' && remote.tagline.trim().length <= 40 && !/[\r\n]/.test(remote.tagline) ? remote.tagline.trim() : slotTagline(fallback);
  const width = positive(remote?.width) ?? fallback.width;
  const height = positive(remote?.height) ?? fallback.height;
  const fit: SiteImageFit = remote?.fit === 'contain' || remote?.fit === 'cover' ? remote.fit : fallback.fit;
  const srcSet = bundledSrcSet(src);
  const fallbackSrcSet = bundledSrcSet(fallback.url);
  return { src, alt, width, height, fit, fallbackSrc: fallback.url, tagline, liveBadge: key === 'community-logo' && src === fallback.url, ...(srcSet ? { srcSet } : {}), ...(fallbackSrcSet ? { fallbackSrcSet } : {}) };
}

export function indexSiteImages(body: unknown): Map<SiteImageKey, { url: string; alt: unknown; width: unknown; height: unknown; fit: unknown; tagline: unknown }> {
  const map = new Map<SiteImageKey, { url: string; alt: unknown; width: unknown; height: unknown; fit: unknown; tagline: unknown }>();
  if (!Array.isArray(body)) return map;
  for (const item of body) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (typeof record.key !== 'string' || !isSiteImageKey(record.key)) continue;
    const url = safeSiteImageUrl(record.url);
    if (!url) continue;
    map.set(record.key, { url, alt: record.alt, width: record.width, height: record.height, fit: record.fit, tagline: record.tagline });
  }
  return map;
}

export function defaultSiteImageRecords(updatedAt = '2026-10-01T00:00:00.000Z'): SiteImageAdmin[] {
  return SITE_IMAGE_SLOTS.map((slot) => ({ key: slot.key, label: slot.label, description: slot.description, url: slot.url, alt: slot.alt, width: slot.width, height: slot.height, fit: slot.fit, defaultUrl: slot.url, defaultAlt: slot.alt, tagline: slotTagline(slot), usingDefault: true, updatedAt, updatedBy: null }));
}

export function toPublicSiteImage(row: SiteImageAdmin) {
  return { key: row.key, label: row.label, description: row.description, url: safeSiteImageUrl(row.url) ?? row.defaultUrl, alt: row.alt, width: row.width, height: row.height, fit: row.fit, tagline: row.tagline, updatedAt: row.updatedAt };
}

export function readAdminSiteImages(body: unknown): SiteImageAdmin[] {
  if (!Array.isArray(body)) return [];
  const order = new Map(SITE_IMAGE_SLOTS.map((slot, index) => [slot.key, index]));
  const rows = body.flatMap((item) => {
    const row = readAdminRow(item);
    return row ? [row] : [];
  });
  return rows.sort((a, b) => (order.get(a.key as SiteImageKey) ?? 999) - (order.get(b.key as SiteImageKey) ?? 999) || a.key.localeCompare(b.key));
}

export function slotDefaults(key: string): { url: string; alt: string; width: number; height: number; fit: SiteImageFit; tagline: string } | undefined {
  const slot = siteImageSlot(key);
  if (!slot) return undefined;
  return { url: slot.url, alt: slot.alt, width: slot.width, height: slot.height, fit: slot.fit, tagline: slotTagline(slot) };
}

function readAdminRow(value: unknown): SiteImageAdmin | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  if (typeof row.key !== 'string' || !/^[a-z0-9-]{1,64}$/.test(row.key)) return undefined;
  if (typeof row.label !== 'string' || typeof row.description !== 'string') return undefined;
  const fallback = siteImageSlot(row.key);
  const url = safeSiteImageUrl(row.url) ?? fallback?.url;
  const defaultUrl = safeSiteImageUrl(row.defaultUrl) ?? fallback?.url ?? url;
  if (!url || !defaultUrl) return undefined;
  const fit: SiteImageFit = row.fit === 'contain' || row.fit === 'cover' ? row.fit : (fallback?.fit ?? 'cover');
  return {
    key: row.key,
    label: row.label,
    description: row.description,
    url,
    alt: typeof row.alt === 'string' ? row.alt.slice(0, 300) : (fallback?.alt ?? ''),
    width: positive(row.width) ?? fallback?.width ?? 1600,
    height: positive(row.height) ?? fallback?.height ?? 1066,
    fit,
    defaultUrl,
    defaultAlt: typeof row.defaultAlt === 'string' ? row.defaultAlt : (fallback?.alt ?? ''),
    tagline: typeof row.tagline === 'string' ? row.tagline.slice(0, 40) : (fallback?.tagline ?? ''),
    usingDefault: row.usingDefault === true,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : '',
    updatedBy: typeof row.updatedBy === 'string' ? row.updatedBy : null,
  };
}

function positive(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 20_000) return undefined;
  return value;
}
