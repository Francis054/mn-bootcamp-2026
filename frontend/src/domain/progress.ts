import { safeHttps } from '@/domain/portfolio';
import type { ReviewStatus } from '@/domain/portalProfile';

export const SKILL_LEVELS = [1, 2, 3, 4] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const SKILL_LEVEL_LABEL: Record<SkillLevel, string> = {
  1: 'Learning',
  2: 'Practising',
  3: 'Confident',
  4: 'Can teach',
};

export interface SkillContent {
  name: string;
  level: SkillLevel;
  evidenceItemId: string | null;
}

export interface SkillRecord {
  id: string;
  sortOrder: number;
  status: ReviewStatus;
  rejectionReason: string;
  submittedAt: string | null;
  draft: SkillContent;
  live: SkillContent;
}

export interface EventContent {
  title: string;
  eventDate: string | null;
  organiser: string;
  link: string | null;
  certificateUrl: string | null;
}

export interface EventRecord {
  id: string;
  sortOrder: number;
  status: ReviewStatus;
  rejectionReason: string;
  submittedAt: string | null;
  draft: EventContent;
  live: EventContent;
}

export interface ProgressReview<T> {
  id: string;
  traineeId: string;
  email: string;
  traineeName: string;
  status: ReviewStatus;
  draft: T;
  live: T;
  consents: { publicProfile: boolean; publicPhoto: boolean };
}

export interface PublicSkill {
  id: string;
  name: string;
  level: SkillLevel;
  evidence: { id: string; title: string; kind: string } | null;
}

export interface PublicEvent {
  id: string;
  title: string;
  eventDate: string | null;
  organiser: string;
  link: string | null;
  certificateUrl: string | null;
}

export interface TrainerProgressRow {
  id: string;
  displayName: string;
  skills: SkillRecord[];
  events: EventRecord[];
}

function publicImage(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  if (value.startsWith('https://') || value.startsWith('http://') || value.startsWith('/api/') || value.startsWith('data:image/')) {
    return value;
  }
  return null;
}

export function levelLabel(level: number): string {
  if (level === 1 || level === 2 || level === 3 || level === 4) return SKILL_LEVEL_LABEL[level];
  return 'Learning';
}

export function readPublicSkills(value: unknown): PublicSkill[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as PublicSkill;
    if (typeof row.id !== 'string' || typeof row.name !== 'string' || !row.name.trim()) return [];
    const level = row.level === 2 || row.level === 3 || row.level === 4 ? row.level : 1;
    const evidence = row.evidence && typeof row.evidence.title === 'string' && row.evidence.title.trim()
      ? { id: String(row.evidence.id), title: row.evidence.title, kind: String(row.evidence.kind ?? '') }
      : null;
    return [{ id: row.id, name: row.name, level, evidence }];
  });
}

export function readPublicEvents(value: unknown): PublicEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as PublicEvent;
    if (typeof row.id !== 'string' || typeof row.title !== 'string' || !row.title.trim()) return [];
    return [{
      id: row.id,
      title: row.title,
      eventDate: typeof row.eventDate === 'string' ? row.eventDate : null,
      organiser: typeof row.organiser === 'string' ? row.organiser : '',
      link: safeHttps(typeof row.link === 'string' ? row.link : null),
      certificateUrl: publicImage(row.certificateUrl),
    }];
  });
}
