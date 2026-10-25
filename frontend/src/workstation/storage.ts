import { BANNER, defaultFlags, defaultObjectives, isAppId, isMode, type AppId, type LabFlags, type ObjectiveId, type TermLine, type WorkstationSnapshot } from './lab';

const KEY = 'mn-workstation-lab';
const LESSON_ID = /^[A-Za-z0-9_-]{1,80}$/;

export function safeLessonId(value: string | null | undefined): string {
  if (!value || !LESSON_ID.test(value)) return '';
  return value;
}

export function loadWorkstation(): WorkstationSnapshot | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return repair(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function saveWorkstation(state: WorkstationSnapshot): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ v: 1, state }));
  } catch {
    // A private window or a full store still runs the practice until reload.
  }
}

function repair(value: unknown): WorkstationSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const envelope = value as { v?: unknown; state?: unknown };
  if (envelope.v !== 1 || !envelope.state || typeof envelope.state !== 'object') return null;
  const source = envelope.state as Partial<WorkstationSnapshot>;
  const fallback: AppId[] = ['notes', 'map', 'lab', 'progress'];
  const open = Array.isArray(source.open) ? uniqueApps(source.open) : fallback;
  const requested = typeof source.active === 'string' && isAppId(source.active) ? source.active : null;
  const active = requested && open.includes(requested) ? requested : (open[open.length - 1] ?? null);
  const lines = repairLines(source.lines);
  const finding = source.finding === 'Anonymous FTP (port 21)' ? source.finding : '';
  const objectives = repairObjectives(source.objectives, finding !== '');
  const findingTone = finding ? 'ok' : source.findingTone === 'warn' || source.findingTone === 'ok' ? source.findingTone : '';
  return {
    mode: typeof source.mode === 'string' && isMode(source.mode) ? source.mode : 'learn',
    open,
    active,
    lines,
    nextLineId: lines.length + 1,
    history: repairHistory(source.history),
    hintsShown: clampInt(source.hintsShown, 3),
    finding,
    findingNote: clip(source.findingNote, 500),
    findingTone: finding ? 'ok' : findingTone === 'ok' ? '' : findingTone,
    flags: repairFlags(source.flags),
    objectives,
    returnLessonId: safeLessonId(typeof source.returnLessonId === 'string' ? source.returnLessonId : ''),
  };
}

function uniqueApps(value: unknown[]): AppId[] {
  const open: AppId[] = [];
  for (const item of value) {
    if (typeof item === 'string' && isAppId(item) && !open.includes(item)) open.push(item);
  }
  return open;
}

function repairLines(value: unknown): TermLine[] {
  const kinds = new Set(['banner', 'in', 'out', 'err']);
  const cleaned: Array<Pick<TermLine, 'kind' | 'text'>> = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== 'object') continue;
      const row = item as { kind?: unknown; text?: unknown };
      if (typeof row.kind !== 'string' || !kinds.has(row.kind) || typeof row.text !== 'string') continue;
      cleaned.push({ kind: row.kind as TermLine['kind'], text: row.text.slice(0, 2000) });
    }
  }
  const kept = cleaned.slice(-180);
  if (!kept.some((line) => line.kind === 'banner')) kept.unshift({ kind: 'banner', text: BANNER });
  return kept.map((line, index) => ({ id: index + 1, kind: line.kind, text: line.text }));
}

function repairHistory(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, 160)).slice(-30);
}

function repairFlags(value: unknown): LabFlags {
  const flags = defaultFlags();
  if (!value || typeof value !== 'object') return flags;
  const source = value as Partial<LabFlags>;
  (Object.keys(flags) as Array<keyof LabFlags>).forEach((key) => {
    flags[key] = source[key] === true;
  });
  return flags;
}

function repairObjectives(value: unknown, named: boolean): Record<ObjectiveId, boolean> {
  const objectives = defaultObjectives();
  if (value && typeof value === 'object') {
    const source = value as Partial<Record<ObjectiveId, boolean>>;
    (Object.keys(objectives) as ObjectiveId[]).forEach((key) => {
      objectives[key] = source[key] === true;
    });
  }
  if (named) objectives.name = true;
  return objectives;
}

function clampInt(value: unknown, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return 0;
  return Math.min(max, Math.max(0, value));
}

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}
