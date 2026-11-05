import type { PublicTrainee } from './types';

export const DIRECTORY_TRACKS = ['Blue team', 'Red team', 'GRC & Awareness'] as const;

export interface DirectoryFilters {
  q: string;
  track: string;
  focus: string;
  skill: string;
}

/** Same rules as the API: public fields only, and search does not read an email. */
export function filterDirectory(rows: readonly PublicTrainee[], filters: DirectoryFilters): PublicTrainee[] {
  const q = filters.q.trim().toLowerCase();
  const skill = filters.skill.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.track && row.track !== filters.track) return false;
    if (filters.focus && row.focus !== filters.focus) return false;
    if (skill && !(row.skills ?? []).some((item) => item.trim().toLowerCase() === skill)) return false;
    if (!q) return true;
    const haystack = [row.displayName, row.headline ?? '', row.track, row.focus, row.location ?? '', row.bio, row.quote, ...(row.skills ?? [])]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function directorySkills(rows: readonly PublicTrainee[]): string[] {
  const names = new Set<string>();
  for (const row of rows) {
    for (const skill of row.skills ?? []) {
      const trimmed = skill.trim();
      if (trimmed) names.add(trimmed);
    }
  }
  return [...names].sort((left, right) => left.localeCompare(right));
}
