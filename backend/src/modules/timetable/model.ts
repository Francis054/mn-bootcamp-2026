import type { TrainerKind } from './names.js';

export const SESSION_TYPES = [
  'devotion',
  'standup',
  'theory',
  'practical',
  'break',
  'group',
  'event',
] as const;

export type SessionType = (typeof SESSION_TYPES)[number];

export const TRAINER_STATUSES = ['assigned', 'tbc', 'all', 'unspecified'] as const;
export type TrainerStatus = (typeof TRAINER_STATUSES)[number];

export type TrainerRole = 'professionalism' | 'cybersecurity';

export interface ParseWarning {
  code: string;
  sheet: 'Timetable' | 'Course Outline';
  message: string;
  rows: number[];
}

export interface ParsedTrainer {
  id: string;
  displayName: string;
  normalizedName: string;
  kind: TrainerKind;
  proposed: true;
}

export interface ParsedBlock {
  id: string;
  sortOrder: number;
  name: string;
  professionalismTheme: string;
  cybersecurityTheme: string;
}

export interface ParsedDeliverable {
  id: string;
  weekId: string;
  sortOrder: number;
  title: string;
}

export interface ParsedWeekTrainer {
  weekId: string;
  trainerId: string;
  role: TrainerRole;
  sortOrder: number;
}

export interface ParsedWeek {
  id: string;
  blockId: string;
  number: number;
  title: string;
  startsOn: string;
  professionalism: string;
  cybersecurity: string;
}

export interface ParsedSessionTrainer {
  sessionId: string;
  trainerId: string;
  sortOrder: number;
}

export interface ParsedSession {
  id: string;
  importKey: string;
  weekId: string;
  date: string;
  day: string;
  sortOrder: number;
  type: SessionType;
  activity: string;
  topic: string;
  notes: string;
  startTime: string | null;
  endTime: string | null;
  rawTime: string;
  trainerStatus: TrainerStatus;
  sourceRow: number;
}

export interface ParsedProgramme {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  rules: string[];
  sourceNote: string;
  blocks: ParsedBlock[];
  weeks: ParsedWeek[];
  deliverables: ParsedDeliverable[];
  trainers: ParsedTrainer[];
  weekTrainers: ParsedWeekTrainer[];
  sessions: ParsedSession[];
  sessionTrainers: ParsedSessionTrainer[];
  warnings: ParseWarning[];
}

export interface TrainerRef {
  id: string;
  displayName: string;
  proposed: boolean;
  kind: TrainerKind;
}

export interface PublicSession {
  id: string;
  date: string;
  day: string;
  sortOrder: number;
  type: SessionType;
  activity: string;
  topic: string;
  notes: string;
  startTime: string | null;
  endTime: string | null;
  trainerStatus: TrainerStatus;
  trainers: TrainerRef[];
}

export interface PublicWeek {
  id: string;
  number: number;
  title: string;
  startsOn: string;
  professionalism: string;
  cybersecurity: string;
  deliverables: Array<{ id: string; sortOrder: number; title: string }>;
  professionalismTrainers: TrainerRef[];
  cybersecurityTrainers: TrainerRef[];
  sessions: PublicSession[];
}

export interface PublicBlock {
  id: string;
  sortOrder: number;
  name: string;
  professionalismTheme: string;
  cybersecurityTheme: string;
  weeks: PublicWeek[];
}

export interface PublicTimetable {
  programme: {
    id: string;
    name: string;
    startsOn: string;
    endsOn: string;
    rules: string[];
  } | null;
  today: string;
  currentWeek: number;
  blocks: PublicBlock[];
  trainers: TrainerRef[];
}
