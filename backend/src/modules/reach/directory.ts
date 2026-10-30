import type { PublicTrainee } from '../trainees/records.js';

export interface DirectoryQuery {
  q: string;
  track: string;
  focus: string;
  skill: string;
}

const MAX_Q = 80;
const MAX_TRACK = 40;
const MAX_FOCUS = 40;
const MAX_SKILL = 60;

/** Public list filters. They never read an email address. */
export function readDirectoryQuery(query: unknown): DirectoryQuery {
  const source = isRecord(query) ? query : {};
  return {
    q: clip(source.q, MAX_Q).toLowerCase(),
    track: clip(source.track, MAX_TRACK),
    focus: clip(source.focus, MAX_FOCUS),
    skill: clip(source.skill, MAX_SKILL).toLowerCase(),
  };
}

export function matchesDirectory(row: PublicTrainee, query: DirectoryQuery): boolean {
  if (query.track && row.track !== query.track) return false;
  if (query.focus && row.focus !== query.focus) return false;
  if (query.skill) {
    const wanted = query.skill;
    const hit = row.skills.some((skill) => skill.trim().toLowerCase() === wanted);
    if (!hit) return false;
  }
  if (!query.q) return true;
  return haystack(row).includes(query.q);
}

function haystack(row: PublicTrainee): string {
  return [
    row.displayName,
    row.headline,
    row.track,
    row.focus,
    row.location,
    row.bio,
    row.quote,
    ...row.skills,
  ]
    .join(' ')
    .toLowerCase();
}

function clip(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
