export const PORTFOLIO_KINDS = ['project', 'lab', 'case_study'] as const;
export type PortfolioKind = (typeof PORTFOLIO_KINDS)[number];

export const KIND_LABEL: Record<PortfolioKind, string> = {
  project: 'Project',
  lab: 'Lab',
  case_study: 'Case study',
};

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

export interface ParsedVideoLink {
  provider: 'youtube' | 'vimeo' | 'loom';
  externalId: string;
}

/** Whole-host allow-list. A name that only contains youtube, vimeo, or loom is refused. */
export function parseVideoLink(raw: string): ParsedVideoLink | undefined {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500) return undefined;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return undefined;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const parts = url.pathname.split('/').filter(Boolean);
  if (YOUTU_BE_HOSTS.has(host)) {
    const externalId = parts[0] ?? '';
    return YOUTUBE_ID.test(externalId) ? { provider: 'youtube', externalId } : undefined;
  }
  if (YOUTUBE_HOSTS.has(host)) {
    const fromQuery = url.searchParams.get('v') ?? '';
    if (YOUTUBE_ID.test(fromQuery)) return { provider: 'youtube', externalId: fromQuery };
    const head = parts[0] ?? '';
    if ((head === 'embed' || head === 'shorts' || head === 'live' || head === 'v') && YOUTUBE_ID.test(parts[1] ?? '')) {
      return { provider: 'youtube', externalId: parts[1] ?? '' };
    }
    return undefined;
  }
  if (VIMEO_HOSTS.has(host)) {
    const externalId = host === 'player.vimeo.com' ? (parts[0] === 'video' ? parts[1] : '') : parts[parts.length - 1];
    return externalId && VIMEO_ID.test(externalId) ? { provider: 'vimeo', externalId } : undefined;
  }
  if (LOOM_HOSTS.has(host) && parts.length === 2 && (parts[0] === 'share' || parts[0] === 'embed') && LOOM_ID.test(parts[1] ?? '')) {
    return { provider: 'loom', externalId: parts[1] ?? '' };
  }
  return undefined;
}

/** Official privacy-friendly embed built from the stored id, never from the typed address. */
export function videoEmbedUrl(provider: string, externalId: string): string | null {
  if (provider === 'youtube' && YOUTUBE_ID.test(externalId)) return `https://www.youtube-nocookie.com/embed/${externalId}`;
  if (provider === 'vimeo' && VIMEO_ID.test(externalId)) return `https://player.vimeo.com/video/${externalId}?dnt=1`;
  if (provider === 'loom' && LOOM_ID.test(externalId)) return `https://www.loom.com/embed/${externalId}`;
  return null;
}

export interface PortfolioMedia {
  id: string;
  kind: 'image' | 'video_file' | 'video_link';
  alt: string;
  url: string | null;
  provider: string | null;
  externalId: string | null;
  sortOrder: number;
}

export interface PortfolioFields {
  kind: PortfolioKind;
  title: string;
  summary: string;
  skills: string[];
  startedOn: string | null;
  completedOn: string | null;
  repositoryUrl: string | null;
  demoUrl: string | null;
}

export interface PortfolioContent extends PortfolioFields {
  media: PortfolioMedia[];
}

export interface PortfolioItem {
  id: string;
  sortOrder: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  rejectionReason: string;
  submittedAt: string | null;
  draft: PortfolioContent;
  live: PortfolioContent;
}

export interface PortfolioReviewShape {
  id: string;
  traineeId: string;
  email: string;
  traineeName: string;
  status: string;
  submittedAt: string | null;
  draft: PortfolioContent;
  live: PortfolioContent;
  consents: { publicProfile: boolean; publicPhoto: boolean };
}

export interface PublicPortfolioItem extends PortfolioFields {
  id: string;
  media: PortfolioMedia[];
}

export function isPortfolioKind(value: string): value is PortfolioKind {
  return (PORTFOLIO_KINDS as readonly string[]).includes(value);
}

export function readPublicPortfolio(value: unknown): PublicPortfolioItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.title !== 'string' || typeof row.kind !== 'string' || !isPortfolioKind(row.kind)) return [];
    return [{
      id: row.id,
      kind: row.kind,
      title: row.title,
      summary: typeof row.summary === 'string' ? row.summary : '',
      skills: Array.isArray(row.skills) ? row.skills.filter((skill): skill is string => typeof skill === 'string') : [],
      startedOn: typeof row.startedOn === 'string' ? row.startedOn : null,
      completedOn: typeof row.completedOn === 'string' ? row.completedOn : null,
      repositoryUrl: typeof row.repositoryUrl === 'string' ? row.repositoryUrl : null,
      demoUrl: typeof row.demoUrl === 'string' ? row.demoUrl : null,
      media: readMedia(row.media),
    }];
  });
}

export function safeHttps(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return value;
  } catch {
    return null;
  }
}

export function safeMediaUrl(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith('/api/v1/public/uploads/') || value.startsWith('data:image/') || value.startsWith('data:video/')) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname === 'res.cloudinary.com') return value;
  } catch {
    return null;
  }
  return null;
}

function readMedia(value: unknown): PortfolioMedia[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || (row.kind !== 'image' && row.kind !== 'video_file' && row.kind !== 'video_link')) return [];
    return [{
      id: row.id,
      kind: row.kind,
      alt: typeof row.alt === 'string' ? row.alt : '',
      url: typeof row.url === 'string' ? row.url : null,
      provider: typeof row.provider === 'string' ? row.provider : null,
      externalId: typeof row.externalId === 'string' ? row.externalId : null,
      sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : 0,
    }];
  });
}
