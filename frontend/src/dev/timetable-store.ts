import { APP_TODAY } from '@/domain/format';
import {
  SESSION_TYPES,
  TRAINER_STATUSES,
  type AdminSession,
  type AdminTimetable,
  type PublicBlock,
  type PublicSession,
  type PublicTimetable,
  type PublicWeek,
  type SessionType,
  type TimetableWarning,
  type TrainerRef,
  type TrainerStatus,
} from '@/domain/timetable';
import { ApiError } from '@/domain/types';

const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const CLOCK = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export const NOT_HANDLED = Symbol('not-timetable');

type Snapshot = {
  programme: NonNullable<PublicTimetable['programme']>;
  sourceNote: string;
  warnings: TimetableWarning[];
  trainers: TrainerRef[];
  blocks: PublicBlock[];
};

interface MutableWeek {
  id: string;
  blockId: string;
  number: number;
  title: string;
  startsOn: string;
  professionalism: string;
  cybersecurity: string;
  deliverables: PublicWeek['deliverables'];
  professionalismTrainerIds: string[];
  cybersecurityTrainerIds: string[];
}

interface MutableSession {
  id: string;
  weekId: string;
  importKey: string | null;
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
  origin: 'import' | 'admin';
  trainerIds: string[];
}

interface MutableTrainer extends TrainerRef {
  normalizedName: string;
  userId: string | null;
}

interface State {
  programme: NonNullable<PublicTimetable['programme']>;
  sourceNote: string;
  warnings: TimetableWarning[];
  blocks: Array<Omit<PublicBlock, 'weeks'>>;
  weeks: MutableWeek[];
  sessions: MutableSession[];
  trainers: MutableTrainer[];
}

let state: State | null = null;
let loading: Promise<void> | null = null;

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function dayName(iso: string): string {
  return DAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()] ?? '';
}

function devToday(): string {
  return APP_TODAY.toISOString().slice(0, 10);
}

function currentWeekNumber(weeks: MutableWeek[], today: string): number {
  const sorted = [...weeks].sort((a, b) => a.number - b.number);
  const first = sorted[0];
  if (!first) return 1;
  const active = [...sorted].reverse().find((week) => week.startsOn <= today);
  return active?.number ?? first.number;
}

function fromSnapshot(snapshot: Snapshot): State {
  const weeks: MutableWeek[] = [];
  const sessions: MutableSession[] = [];
  for (const block of snapshot.blocks) {
    for (const week of block.weeks) {
      weeks.push({
        id: week.id,
        blockId: block.id,
        number: week.number,
        title: week.title,
        startsOn: week.startsOn,
        professionalism: week.professionalism,
        cybersecurity: week.cybersecurity,
        deliverables: week.deliverables.map((item) => ({ ...item })),
        professionalismTrainerIds: week.professionalismTrainers.map((trainer) => trainer.id),
        cybersecurityTrainerIds: week.cybersecurityTrainers.map((trainer) => trainer.id),
      });
      for (const session of week.sessions) {
        sessions.push({
          id: session.id,
          weekId: week.id,
          importKey: null,
          date: session.date,
          day: session.day,
          sortOrder: session.sortOrder,
          type: session.type,
          activity: session.activity,
          topic: session.topic,
          notes: session.notes,
          startTime: session.startTime,
          endTime: session.endTime,
          rawTime: session.startTime && session.endTime ? `${session.startTime}–${session.endTime}` : '',
          trainerStatus: session.trainerStatus,
          origin: 'import',
          trainerIds: session.trainers.map((trainer) => trainer.id),
        });
      }
    }
  }
  return {
    programme: { ...snapshot.programme, rules: [...snapshot.programme.rules] },
    sourceNote: snapshot.sourceNote,
    warnings: snapshot.warnings.map((warning) => ({ ...warning, rows: [...warning.rows] })),
    blocks: snapshot.blocks.map((block) => ({
      id: block.id,
      sortOrder: block.sortOrder,
      name: block.name,
      professionalismTheme: block.professionalismTheme,
      cybersecurityTheme: block.cybersecurityTheme,
    })),
    weeks,
    sessions,
    trainers: snapshot.trainers.map((trainer) => ({
      ...trainer,
      normalizedName: normalizeName(trainer.displayName),
      userId: null,
    })),
  };
}

async function ensure(): Promise<State> {
  if (state) return state;
  loading ??= import('./timetable-snapshot.json').then((mod) => {
    state = fromSnapshot(mod.default as Snapshot);
  });
  await loading;
  if (!state) throw new ApiError('server', 'The timetable snapshot did not load.', 500);
  return state;
}

export function resetTimetableStore(): void {
  state = null;
  loading = null;
}

export function isPublicTimetablePath(path: string): boolean {
  return (
    path === '/public/timetable' ||
    path === '/public/blocks' ||
    path === '/public/weeks' ||
    path.startsWith('/public/weeks/') ||
    path === '/public/sessions' ||
    path === '/public/deliverables'
  );
}

export function isAdminTimetablePath(path: string): boolean {
  return (
    path === '/admin/timetable' ||
    path.startsWith('/admin/timetable/') ||
    path === '/admin/blocks' ||
    path.startsWith('/admin/blocks/') ||
    path === '/admin/weeks' ||
    path.startsWith('/admin/weeks/') ||
    path === '/admin/sessions' ||
    path.startsWith('/admin/sessions/') ||
    path === '/admin/trainers' ||
    path.startsWith('/admin/trainers/')
  );
}

function refs(store: State, ids: string[]): TrainerRef[] {
  return ids.flatMap((id) => {
    const trainer = store.trainers.find((item) => item.id === id);
    if (!trainer) return [];
    return [{ id: trainer.id, displayName: trainer.displayName, proposed: trainer.proposed, kind: trainer.kind }];
  });
}

function toPublicSession(store: State, session: MutableSession): PublicSession {
  return {
    id: session.id,
    date: session.date,
    day: session.day,
    sortOrder: session.sortOrder,
    type: session.type,
    activity: session.activity,
    topic: session.topic,
    notes: session.notes,
    startTime: session.startTime,
    endTime: session.endTime,
    trainerStatus: session.trainerStatus,
    trainers: refs(store, session.trainerIds),
  };
}

function toAdminSession(store: State, session: MutableSession): AdminSession {
  return {
    ...toPublicSession(store, session),
    weekId: session.weekId,
    importKey: session.importKey,
    rawTime: session.rawTime,
    origin: session.origin,
  };
}

function publicBody(store: State): PublicTimetable {
  const today = devToday();
  return {
    programme: store.programme,
    today,
    currentWeek: currentWeekNumber(store.weeks, today),
    trainers: store.trainers.map((trainer) => ({
      id: trainer.id,
      displayName: trainer.displayName,
      proposed: trainer.proposed,
      kind: trainer.kind,
    })),
    blocks: [...store.blocks]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((block) => ({
        ...block,
        weeks: store.weeks
          .filter((week) => week.blockId === block.id)
          .sort((a, b) => a.number - b.number)
          .map((week) => ({
            id: week.id,
            number: week.number,
            title: week.title,
            startsOn: week.startsOn,
            professionalism: week.professionalism,
            cybersecurity: week.cybersecurity,
            deliverables: [...week.deliverables].sort((a, b) => a.sortOrder - b.sortOrder),
            professionalismTrainers: refs(store, week.professionalismTrainerIds),
            cybersecurityTrainers: refs(store, week.cybersecurityTrainerIds),
            sessions: store.sessions
              .filter((session) => session.weekId === week.id)
              .sort((a, b) => a.date.localeCompare(b.date) || a.sortOrder - b.sortOrder)
              .map((session) => toPublicSession(store, session)),
          })),
      })),
  };
}

function adminBody(store: State): AdminTimetable {
  return {
    ...publicBody(store),
    sourceNote: store.sourceNote,
    warnings: store.warnings,
    sessions: [...store.sessions]
      .sort((a, b) => a.date.localeCompare(b.date) || a.sortOrder - b.sortOrder)
      .map((session) => toAdminSession(store, session)),
    trainers: store.trainers.map((trainer) => ({ ...trainer })),
  };
}

function fail(message: string, status = 422): never {
  throw new ApiError('validation', message, status);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalClock(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !CLOCK.test(value)) fail(`${label} must be HH:MM.`);
  return value;
}

function stringList(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) fail(`${label} must be a list of ids.`);
  return value;
}

function requireWeek(store: State, id: string): MutableWeek {
  const week = store.weeks.find((item) => item.id === id);
  if (!week) throw new ApiError('not_found', 'That week was not found.', 404);
  return week;
}

function requireSession(store: State, id: string): MutableSession {
  const session = store.sessions.find((item) => item.id === id);
  if (!session) throw new ApiError('not_found', 'That session was not found.', 404);
  return session;
}

function knownTrainers(store: State, ids: string[]): string[] {
  const missing = ids.find((id) => !store.trainers.some((trainer) => trainer.id === id));
  if (missing) fail('Choose trainers from the timetable list.');
  return ids;
}

function readSessionWrite(store: State, body: Record<string, unknown>, current?: MutableSession): Omit<MutableSession, 'id' | 'importKey' | 'origin' | 'sortOrder' | 'rawTime'> {
  const weekId = text(body.weekId ?? current?.weekId);
  requireWeek(store, weekId);
  const date = text(body.date ?? current?.date);
  if (!DATE.test(date)) fail('Use a date as YYYY-MM-DD.');
  const type = text(body.type ?? current?.type);
  if (!SESSION_TYPES.includes(type as SessionType)) fail('Choose a session type.');
  const activity = text(body.activity ?? current?.activity);
  const topic = typeof body.topic === 'string' ? body.topic : (current?.topic ?? '');
  if (!activity) fail('Name the session.');
  const status = text(body.trainerStatus ?? current?.trainerStatus ?? 'assigned');
  if (!TRAINER_STATUSES.includes(status as TrainerStatus)) fail('Choose a trainer status.');
  const trainerIds = body.trainerIds === undefined && current ? current.trainerIds : knownTrainers(store, stringList(body.trainerIds, 'Trainers'));
  return {
    weekId,
    date,
    day: dayName(date),
    type: type as SessionType,
    activity,
    topic,
    notes: typeof body.notes === 'string' ? body.notes : (current?.notes ?? ''),
    startTime: body.startTime === undefined && current ? current.startTime : optionalClock(body.startTime, 'Start time'),
    endTime: body.endTime === undefined && current ? current.endTime : optionalClock(body.endTime, 'End time'),
    trainerStatus: status as TrainerStatus,
    trainerIds,
  };
}

function listSessions(store: State, query: Record<string, string>): AdminSession[] {
  const needle = (query.q ?? '').trim().toLowerCase();
  return store.sessions
    .filter((session) => !query.weekId || session.weekId === query.weekId)
    .filter((session) => {
      if (!query.blockId) return true;
      const week = store.weeks.find((item) => item.id === session.weekId);
      return week?.blockId === query.blockId;
    })
    .filter((session) => !query.date || session.date === query.date)
    .filter((session) => !query.type || session.type === query.type)
    .filter((session) => !query.trainerId || session.trainerIds.includes(query.trainerId))
    .filter((session) => {
      if (!needle) return true;
      const names = refs(store, session.trainerIds).map((trainer) => trainer.displayName).join(' ');
      return `${session.activity} ${session.topic} ${names}`.toLowerCase().includes(needle);
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.sortOrder - b.sortOrder)
    .map((session) => toAdminSession(store, session));
}

function replaceDeliverables(week: MutableWeek, titles: string[]): void {
  week.deliverables = titles.map((title, index) => ({
    id: `del-${week.id}-${index + 1}`,
    sortOrder: index + 1,
    title: title.trim(),
  })).filter((item) => item.title);
}

export async function timetableRoute(
  method: string,
  path: string,
  query: Record<string, string>,
  body: Record<string, unknown>,
): Promise<unknown> {
  const store = await ensure();
  if (method === 'GET' && path === '/public/timetable') return publicBody(store);
  if (method === 'GET' && path === '/public/blocks') return publicBody(store).blocks;
  if (method === 'GET' && path === '/public/weeks') return publicBody(store).blocks.flatMap((block) => block.weeks);
  if (method === 'GET' && path.startsWith('/public/weeks/')) {
    const number = Number(path.split('/')[3] ?? '');
    const week = publicBody(store).blocks.flatMap((block) => block.weeks).find((item) => item.number === number);
    if (!week) throw new ApiError('not_found', 'That week is not on the timetable.', 404);
    return week;
  }
  if (method === 'GET' && path === '/public/sessions') {
    const week = query.week ?? '';
    return publicBody(store).blocks
      .flatMap((block) => block.weeks)
      .filter((item) => !week || String(item.number) === week || item.id === week)
      .flatMap((item) => item.sessions);
  }
  if (method === 'GET' && path === '/public/deliverables') {
    return publicBody(store).blocks.flatMap((block) =>
      block.weeks.flatMap((week) => week.deliverables.map((item) => ({ ...item, weekId: week.id, week: week.number }))),
    );
  }

  if (method === 'GET' && path === '/admin/timetable') return adminBody(store);
  if (method === 'POST' && path === '/admin/timetable/import') {
    fail('The development adapter does not parse Excel workbooks. Use the live API to upload a file, or run npm run timetable:import from backend/.');
  }
  if (method === 'GET' && path === '/admin/blocks') return adminBody(store).blocks;
  if (method === 'GET' && path === '/admin/weeks') return adminBody(store).blocks.flatMap((block) => block.weeks);
  if (method === 'GET' && path === '/admin/trainers') return adminBody(store).trainers;
  if (method === 'GET' && path === '/admin/sessions') return { items: listSessions(store, query) };

  const sessionId = path.startsWith('/admin/sessions/') ? path.split('/')[3] ?? '' : '';
  if (method === 'POST' && path === '/admin/sessions') {
    const written = readSessionWrite(store, body);
    const sameDay = store.sessions.filter((session) => session.date === written.date);
    const sortOrder = sameDay.reduce((max, session) => Math.max(max, session.sortOrder), 0) + 1;
    const session: MutableSession = {
      ...written,
      id: `sess-${crypto.randomUUID().slice(0, 8)}`,
      importKey: null,
      origin: 'admin',
      sortOrder,
      rawTime: written.startTime && written.endTime ? `${written.startTime}–${written.endTime}` : '',
    };
    store.sessions.push(session);
    return toAdminSession(store, session);
  }
  if (method === 'POST' && path === '/admin/sessions/reorder') {
    const session = requireSession(store, text(body.id));
    const direction = body.direction === 'down' ? 'down' : body.direction === 'up' ? 'up' : '';
    if (!direction) fail('Choose up or down.');
    const siblings = store.sessions.filter((item) => item.date === session.date).sort((a, b) => a.sortOrder - b.sortOrder);
    const index = siblings.findIndex((item) => item.id === session.id);
    const neighbour = siblings[direction === 'up' ? index - 1 : index + 1];
    if (neighbour) {
      const order = session.sortOrder;
      session.sortOrder = neighbour.sortOrder;
      neighbour.sortOrder = order;
    }
    return toAdminSession(store, session);
  }
  if (method === 'GET' && /^\/admin\/sessions\/[^/]+$/.test(path)) return toAdminSession(store, requireSession(store, sessionId));
  if (method === 'PATCH' && /^\/admin\/sessions\/[^/]+$/.test(path)) {
    const session = requireSession(store, sessionId);
    const written = readSessionWrite(store, body, session);
    Object.assign(session, written, {
      rawTime: written.startTime && written.endTime ? `${written.startTime}–${written.endTime}` : session.rawTime,
    });
    return toAdminSession(store, session);
  }
  if (method === 'DELETE' && /^\/admin\/sessions\/[^/]+$/.test(path)) {
    const session = requireSession(store, sessionId);
    store.sessions = store.sessions.filter((item) => item.id !== session.id);
    return { ok: true };
  }

  const weekMatch = /^\/admin\/weeks\/([^/]+)(?:\/(deliverables|trainers))?$/.exec(path);
  if (weekMatch) {
    const week = requireWeek(store, weekMatch[1] ?? '');
    const part = weekMatch[2];
    if (method === 'GET' && !part) {
      const view = adminBody(store).blocks.flatMap((block) => block.weeks).find((item) => item.id === week.id);
      if (!view) throw new ApiError('not_found', 'That week was not found.', 404);
      return view;
    }
    if (method === 'PATCH' && !part) {
      if (typeof body.title === 'string') week.title = body.title.trim();
      if (typeof body.professionalism === 'string') week.professionalism = body.professionalism;
      if (typeof body.cybersecurity === 'string') week.cybersecurity = body.cybersecurity;
      if (typeof body.startsOn === 'string' && DATE.test(body.startsOn)) week.startsOn = body.startsOn;
      if (typeof body.blockId === 'string' && store.blocks.some((block) => block.id === body.blockId)) week.blockId = body.blockId;
      if (body.deliverables !== undefined) replaceDeliverables(week, stringList(body.deliverables, 'Deliverables'));
      if (body.professionalismTrainerIds !== undefined) week.professionalismTrainerIds = knownTrainers(store, stringList(body.professionalismTrainerIds, 'Trainers'));
      if (body.cybersecurityTrainerIds !== undefined) week.cybersecurityTrainerIds = knownTrainers(store, stringList(body.cybersecurityTrainerIds, 'Trainers'));
      return week;
    }
    if (method === 'PUT' && part === 'deliverables') {
      replaceDeliverables(week, stringList(body.deliverables, 'Deliverables'));
      return week;
    }
    if (method === 'PUT' && part === 'trainers') {
      if (body.professionalismTrainerIds !== undefined) week.professionalismTrainerIds = knownTrainers(store, stringList(body.professionalismTrainerIds, 'Trainers'));
      if (body.cybersecurityTrainerIds !== undefined) week.cybersecurityTrainerIds = knownTrainers(store, stringList(body.cybersecurityTrainerIds, 'Trainers'));
      return week;
    }
  }

  const trainerMatch = /^\/admin\/trainers\/([^/]+)$/.exec(path);
  if (trainerMatch && method === 'PATCH') {
    const trainer = store.trainers.find((item) => item.id === trainerMatch[1]);
    if (!trainer) throw new ApiError('not_found', 'That trainer was not found.', 404);
    if (typeof body.displayName === 'string' && body.displayName.trim()) {
      trainer.displayName = body.displayName.trim();
      trainer.normalizedName = normalizeName(trainer.displayName);
    }
    if (typeof body.proposed === 'boolean') trainer.proposed = body.proposed;
    return { ...trainer };
  }

  return NOT_HANDLED;
}
