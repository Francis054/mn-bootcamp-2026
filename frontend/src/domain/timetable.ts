export const SESSION_TYPES = ['devotion', 'standup', 'theory', 'practical', 'break', 'group', 'event'] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const TRAINER_STATUSES = ['assigned', 'tbc', 'all', 'unspecified'] as const;
export type TrainerStatus = (typeof TRAINER_STATUSES)[number];

export interface TrainerRef {
  id: string;
  displayName: string;
  proposed: boolean;
  kind: 'person' | 'group';
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

export interface AdminSession extends PublicSession {
  weekId: string;
  importKey: string | null;
  rawTime: string;
  origin: 'import' | 'admin';
}

export interface AdminTrainer extends TrainerRef {
  userId: string | null;
  normalizedName: string;
}

export interface TimetableWarning {
  code: string;
  sheet: string;
  message: string;
  rows: number[];
}

export interface AdminTimetable extends PublicTimetable {
  sourceNote: string;
  warnings: TimetableWarning[];
  sessions: AdminSession[];
  trainers: AdminTrainer[];
}

export function weeksOf(timetable: { blocks?: PublicBlock[] } | null | undefined): PublicWeek[] {
  if (!timetable || !Array.isArray(timetable.blocks)) return [];
  return timetable.blocks.flatMap((block) => block.weeks);
}

export function blockForWeek(timetable: { blocks?: PublicBlock[] }, weekNumber: number): PublicBlock | undefined {
  return weeksOf(timetable).length
    ? timetable.blocks?.find((block) => block.weeks.some((week) => week.number === weekNumber))
    : undefined;
}

export function clockLabel(value: string | null | undefined): string {
  if (!value) return '';
  const [hourText, minute] = value.split(':');
  const hour = Number(hourText);
  if (!minute || Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? 'p.m.' : 'a.m.';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}

export function timeRange(start: string | null, end: string | null): string {
  if (start && end) return `${clockLabel(start)}–${clockLabel(end)}`;
  return clockLabel(start) || clockLabel(end);
}

export function trainerLine(session: { trainerStatus: TrainerStatus; trainers: TrainerRef[] }): string {
  if (session.trainerStatus === 'tbc') return 'Trainer to be confirmed';
  if (session.trainerStatus === 'all') return 'All';
  if (!session.trainers.length) return '';
  const names = session.trainers.map((trainer) => trainer.displayName).join(', ');
  return session.trainers.some((trainer) => trainer.proposed) ? `${names} (proposed)` : names;
}

export function outlineLines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
