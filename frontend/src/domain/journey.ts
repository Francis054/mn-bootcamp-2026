export const JOURNEY_KINDS = ['block', 'week', 'lab', 'project', 'event', 'skill', 'account', 'milestone'] as const;
export type JourneyKind = (typeof JOURNEY_KINDS)[number];

export const JOURNEY_STATES = ['done', 'now', 'upcoming', 'recorded'] as const;
export type JourneyState = (typeof JOURNEY_STATES)[number];

export interface JourneyItem {
  id: string;
  kind: JourneyKind;
  title: string;
  summary: string;
  occurredOn: string | null;
  visibility: 'public' | 'private';
  state: JourneyState;
  href: string | null;
  blockId: string | null;
  deliverables: string[];
  editable: boolean;
}

export interface JourneyBody {
  displayName: string;
  slug: string;
  today: string;
  startsOn: string | null;
  endsOn: string | null;
  items: JourneyItem[];
}

export const KIND_LABEL: Record<JourneyKind, string> = {
  block: 'Block',
  week: 'Week',
  lab: 'Lab',
  project: 'Project',
  event: 'Event',
  skill: 'Skill',
  account: 'Account',
  milestone: 'Milestone',
};

export const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'lab', label: 'Labs' },
  { id: 'project', label: 'Projects' },
  { id: 'skill', label: 'Skills' },
  { id: 'event', label: 'Events' },
  { id: 'milestone', label: 'Milestones' },
] as const;

export type JourneyFilter = (typeof FILTERS)[number]['id'];

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;

export function readJourney(value: unknown, audience: 'public' | 'portal'): JourneyBody {
  const record = isRecord(value) ? value : {};
  const items = Array.isArray(record.items) ? record.items.flatMap((item) => readItem(item, audience)) : [];
  return {
    displayName: text(record.displayName),
    slug: text(record.slug),
    today: text(record.today),
    startsOn: text(record.startsOn) || null,
    endsOn: text(record.endsOn) || null,
    items: audience === 'public' ? items.filter((item) => item.visibility === 'public') : items,
  };
}

export function filterJourney(items: JourneyItem[], filter: JourneyFilter): JourneyItem[] {
  if (filter === 'all') return items;
  const kinds: JourneyKind[] = filter === 'curriculum'
    ? ['block', 'week']
    : filter === 'milestone'
      ? ['milestone', 'account']
      : [filter];
  const matched = items.filter((item) => kinds.includes(item.kind));
  if (filter === 'curriculum') return matched;
  const blockIds = new Set(matched.map((item) => item.blockId).filter((id): id is string => Boolean(id)));
  const blocks = items.filter((item) => item.kind === 'block' && item.blockId && blockIds.has(item.blockId));
  return [...blocks, ...matched].sort((a, b) => items.indexOf(a) - items.indexOf(b));
}

function readItem(value: unknown, audience: 'public' | 'portal'): JourneyItem[] {
  if (!isRecord(value)) return [];
  const kind = text(value.kind);
  if (!isKind(kind)) return [];
  const visibility = value.visibility === 'private' ? 'private' : 'public';
  if (audience === 'public' && visibility !== 'public') return [];
  const title = clean(text(value.title));
  if (!title) return [];
  const href = safeHref(value.href);
  return [{
    id: text(value.id) || title,
    kind,
    title,
    summary: clean(text(value.summary)),
    occurredOn: text(value.occurredOn) || null,
    visibility,
    state: isState(value.state) ? value.state : 'recorded',
    href,
    blockId: text(value.blockId) || null,
    deliverables: Array.isArray(value.deliverables) ? value.deliverables.map((item) => clean(text(item))).filter(Boolean) : [],
    editable: audience === 'portal' && value.editable === true && kind === 'milestone',
  }];
}

function safeHref(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  if (value === '/admin' || value.startsWith('/admin/')) return null;
  return value;
}

function clean(value: string): string {
  return EMAIL.test(value) ? '' : value;
}

function isKind(value: string): value is JourneyKind {
  return (JOURNEY_KINDS as readonly string[]).includes(value);
}

function isState(value: unknown): value is JourneyState {
  return typeof value === 'string' && (JOURNEY_STATES as readonly string[]).includes(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
