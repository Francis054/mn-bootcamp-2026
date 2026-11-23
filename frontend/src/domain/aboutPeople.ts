import { displayPhotoUrl, profilePhotoFileProblem } from '@/domain/photo';
import type { AboutPerson, AboutPersonGroup, PublicAboutPerson } from '@/domain/types';

export const ABOUT_PERSON_GROUPS: Array<{
  id: AboutPersonGroup;
  label: string;
}> = [
  { id: 'founder', label: 'Founder' },
  { id: 'team', label: 'Team' },
  { id: 'partner', label: 'Partners' },
];

const GROUP_RANK: Record<AboutPersonGroup, number> = {
  founder: 0,
  team: 1,
  partner: 2,
};

export function isAboutPersonGroup(value: string): value is AboutPersonGroup {
  return value === 'founder' || value === 'team' || value === 'partner';
}

export function aboutPersonGroupLabel(group: AboutPersonGroup): string {
  return ABOUT_PERSON_GROUPS.find((item) => item.id === group)?.label ?? group;
}

export function aboutPersonFieldErrors(input: {
  group: string;
  name: string;
  title: string;
  description: string;
  file?: File | null;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isAboutPersonGroup(input.group)) errors.group = 'Choose Founder, Team, or Partners.';
  const name = input.name.trim();
  if (!name) errors.name = 'Enter a name.';
  else if (name.length > 120) errors.name = 'Use at most 120 characters.';
  if (input.title.trim().length > 160) errors.title = 'Use at most 160 characters.';
  if (input.description.trim().length > 2000) errors.description = 'Use at most 2000 characters.';
  if (input.file && input.file.size > 0) {
    const fileProblem = profilePhotoFileProblem(input.file);
    if (fileProblem) errors.file = fileProblem;
  }
  return errors;
}

export function personInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('');
  return (letters || 'MN').toUpperCase();
}

export function personHue(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash + char.charCodeAt(0) * 17) % 360;
  return hash;
}

function comparePeople(
  left: { group: AboutPersonGroup; displayOrder: number; name: string },
  right: { group: AboutPersonGroup; displayOrder: number; name: string },
): number {
  const group = GROUP_RANK[left.group] - GROUP_RANK[right.group];
  if (group !== 0) return group;
  if (left.displayOrder !== right.displayOrder) return left.displayOrder - right.displayOrder;
  return left.name.localeCompare(right.name);
}

export function normalizePublicAboutPeople(value: unknown): PublicAboutPerson[] {
  if (!Array.isArray(value)) return [];
  const rows: PublicAboutPerson[] = [];
  for (const item of value) {
    const row = readPerson(item);
    if (row) rows.push(row);
  }
  return rows.sort(comparePeople);
}

export function normalizeAdminAboutPeople(value: unknown): AboutPerson[] {
  if (!Array.isArray(value)) return [];
  const rows: AboutPerson[] = [];
  for (const item of value) {
    const row = readPerson(item);
    if (!row || !item || typeof item !== 'object') continue;
    const published = 'published' in item && item.published === true;
    rows.push({ ...row, published });
  }
  return rows.sort(comparePeople);
}

function readPerson(item: unknown): PublicAboutPerson | null {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  const group = typeof row.group === 'string' ? row.group : '';
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (!id || !name || !isAboutPersonGroup(group)) return null;
  return {
    id,
    group,
    name,
    title: typeof row.title === 'string' ? row.title.trim() : '',
    description: typeof row.description === 'string' ? row.description.trim() : '',
    photoUrl: displayPhotoUrl(row.photoUrl),
    width: typeof row.width === 'number' ? row.width : 0,
    height: typeof row.height === 'number' ? row.height : 0,
    displayOrder: typeof row.displayOrder === 'number' ? row.displayOrder : 0,
  };
}
