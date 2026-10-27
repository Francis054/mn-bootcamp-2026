import { expandMerges, readXlsx, type CellValue, type SheetGrid } from './xlsx.js';
import {
  canonicalTrainer,
  splitTrainers,
  trainerId,
  trainerKey,
  trainerKind,
} from './names.js';
import type {
  ParsedBlock,
  ParsedProgramme,
  ParsedSession,
  ParsedWeek,
  ParseWarning,
  SessionType,
} from './model.js';

const ACTIVITY_TYPE: Record<string, SessionType> = {
  'morning devotion': 'devotion',
  'daily standup': 'standup',
  'short break': 'break',
  'lunch break': 'break',
  'practical / lab': 'practical',
  'practical / workshop': 'practical',
  'group activity': 'group',
  'guided study': 'group',
  'theory / professional skills': 'theory',
  'technical theory': 'theory',
  'theory / discussion': 'theory',
  'professional orientation': 'theory',
  'lesson / workshop': 'theory',
  presentations: 'theory',
};

const BREAK_NOTE = /(?:^|\n)\s*10-minute break:\s*3:20\s*[–-]\s*3:30\s*p\.m\.?\s*/gi;

const WEEK_HEADING = /^Week\s+(\d+)\s*:\s*(.+)$/i;
const WEEK_LABEL = /^Week\s+(\d+)$/i;
const BLOCK_LABEL = /^Block\s+(\d+)\s*:\s*(.+)$/i;

interface MutableTrainer {
  id: string;
  displayName: string;
  normalizedName: string;
  kind: ReturnType<typeof trainerKind>;
  proposed: true;
}

/**
 * Turn the two-sheet workbook into normalised rows.
 * Merged date cells are expanded and reported. Times that are not a single
 * start–end pair are left empty and reported. Nothing else is guessed.
 */
export function parseWorkbook(buffer: Buffer): ParsedProgramme {
  const sheets = readXlsx(buffer);
  const timetable = sheets.get('Timetable');
  const outline = sheets.get('Course Outline');
  if (!timetable || !outline) {
    throw new Error('The workbook needs a Timetable sheet and a Course Outline sheet.');
  }
  const warnings: ParseWarning[] = [];
  const timetableFills = expandMerges(timetable);
  const outlineFills = expandMerges(outline);
  if (timetableFills > 0) {
    warnings.push({
      code: 'merged-cells',
      sheet: 'Timetable',
      message: `Expanded ${timetableFills} cells from ${timetable.merges.length} merged ranges. Date and day are stored once per teaching day in the sheet and were copied onto each session in that merge. No date was invented.`,
      rows: timetable.merges.map((merge) => merge.r1),
    });
  }
  if (outlineFills > 0) {
    warnings.push({
      code: 'merged-cells',
      sheet: 'Course Outline',
      message: `Expanded ${outlineFills} cells from ${outline.merges.length} merged ranges on the outline (title and block labels).`,
      rows: outline.merges.map((merge) => merge.r1),
    });
  }
  if (outlineHasTemplate(outline)) {
    warnings.push({
      code: 'outline-template',
      sheet: 'Course Outline',
      message:
        'Columns I–K are a daily time template, including Excel time fractions and a Thursday/Friday row labelled Madam Diana. They were not imported as sessions. The Timetable sheet is the daily schedule.',
      rows: [],
    });
  }

  const trainers = new Map<string, MutableTrainer>();
  const aliasCounts = new Map<string, number>();
  const whitespaceRows: number[] = [];
  const slashRows: number[] = [];
  const tbcRows: number[] = [];
  const allRows: number[] = [];
  const groupRows: number[] = [];

  const remember = (raw: string | undefined, row: number) => {
    const split = splitTrainers(raw);
    if (split.collapsedWhitespace) whitespaceRows.push(row);
    if (split.usedSlash) slashRows.push(row);
    if (split.status === 'tbc') tbcRows.push(row);
    if (split.status === 'all') allRows.push(row);
    for (const alias of split.aliases) {
      aliasCounts.set(alias, (aliasCounts.get(alias) ?? 0) + 1);
    }
    const ids: string[] = [];
    for (const name of split.canonical) {
      const id = trainerId(name);
      if (!trainers.has(id)) {
        trainers.set(id, {
          id,
          displayName: name,
          normalizedName: trainerKey(name),
          kind: trainerKind(name),
          proposed: true,
        });
      }
      if (trainerKind(name) === 'group') groupRows.push(row);
      ids.push(id);
    }
    return { ids, status: split.status };
  };

  const rules: string[] = [];
  let headerRow = 0;
  const rowNumbers = [...timetable.rows.keys()].sort((a, b) => a - b);
  for (const row of rowNumbers) {
    const label = text(timetable, row, 1);
    const second = text(timetable, row, 2);
    if (label === 'Date' && second === 'Day') {
      headerRow = row;
      break;
    }
    if (label && row > 1) rules.push(label);
  }
  if (!headerRow) throw new Error('The Timetable sheet has no Date / Day header row.');

  const weekTitles = new Map<number, string>();
  let currentWeek = 0;
  for (const row of rowNumbers) {
    if (row <= headerRow) continue;
    const label = text(timetable, row, 1);
    const heading = WEEK_HEADING.exec(label);
    if (heading?.[1] && heading[2]) {
      currentWeek = Number(heading[1]);
      weekTitles.set(currentWeek, heading[2].trim());
    }
  }

  const outlineWeeks = parseOutline(outline, remember, warnings);
  const blocks = outlineWeeks.blocks;
  const weeks: ParsedWeek[] = [];
  for (const outlineWeek of outlineWeeks.weeks) {
    const title = weekTitles.get(outlineWeek.number) ?? outlineWeek.fallbackTitle;
    if (!weekTitles.has(outlineWeek.number)) {
      warnings.push({
        code: 'missing-week-heading',
        sheet: 'Timetable',
        message: `Week ${outlineWeek.number} is on the outline but has no timetable heading. The outline label was kept.`,
        rows: [outlineWeek.row],
      });
    }
    weeks.push({
      id: weekId(outlineWeek.number),
      blockId: outlineWeek.blockId,
      number: outlineWeek.number,
      title,
      startsOn: outlineWeek.startsOn,
      professionalism: outlineWeek.professionalism,
      cybersecurity: outlineWeek.cybersecurity,
    });
  }

  const sessions: ParsedSession[] = [];
  const sessionTrainers: ParsedProgramme['sessionTrainers'] = [];
  const breakRows: number[] = [];
  const missingActivity: number[] = [];
  const ambiguousTimes: number[] = [];
  const unknownActivities: number[] = [];
  let currentDate = '';
  let currentDay = '';
  currentWeek = 0;
  const sortByDate = new Map<string, number>();

  for (const row of rowNumbers) {
    if (row <= headerRow) continue;
    const label = text(timetable, row, 1);
    if (WEEK_HEADING.test(label)) {
      const heading = WEEK_HEADING.exec(label);
      currentWeek = Number(heading?.[1] ?? 0);
      continue;
    }
    const rawDate = cell(timetable, row, 1);
    const parsedDate = dateFromCell(rawDate);
    if (parsedDate) {
      currentDate = parsedDate;
      currentDay = text(timetable, row, 2);
    }
    const activity = text(timetable, row, 3);
    const rawTime = text(timetable, row, 4);
    const course = text(timetable, row, 5);
    const trainerCell = text(timetable, row, 6);
    if (!activity && !rawTime && !course) continue;
    if (!currentDate || !currentWeek) {
      warnings.push({
        code: 'session-without-day',
        sheet: 'Timetable',
        message: 'A session row had no date and no preceding day, so it was skipped.',
        rows: [row],
      });
      continue;
    }
    const week = weeks.find((item) => item.number === currentWeek);
    if (!week) {
      warnings.push({
        code: 'session-without-week',
        sheet: 'Timetable',
        message: `Sessions on ${currentDate} fall under week ${currentWeek}, which is not on the outline. They were skipped.`,
        rows: [row],
      });
      continue;
    }
    let topic = course;
    let notes = '';
    if (BREAK_NOTE.test(course)) {
      BREAK_NOTE.lastIndex = 0;
      notes = '10-minute break: 3:20–3:30 p.m.';
      topic = course.replace(BREAK_NOTE, '\n').replace(/\n{2,}/g, '\n').trim();
      breakRows.push(row);
    }
    BREAK_NOTE.lastIndex = 0;
    const type = activity ? ACTIVITY_TYPE[activity.toLowerCase()] : undefined;
    let sessionType: SessionType;
    if (!activity) {
      sessionType = 'event';
      missingActivity.push(row);
    } else if (!type) {
      sessionType = 'event';
      unknownActivities.push(row);
    } else {
      sessionType = type;
    }
    const times = parseRange(rawTime);
    if (rawTime && !times) ambiguousTimes.push(row);
    const sort = (sortByDate.get(currentDate) ?? 0) + 1;
    sortByDate.set(currentDate, sort);
    const id = `sess-${currentDate}-${String(sort).padStart(2, '0')}`;
    const linked = remember(trainerCell, row);
    const session: ParsedSession = {
      id,
      importKey: `${currentDate}#${String(sort).padStart(2, '0')}`,
      weekId: week.id,
      date: currentDate,
      day: currentDay,
      sortOrder: sort,
      type: sessionType,
      activity,
      topic,
      notes,
      startTime: times?.start ?? null,
      endTime: times?.end ?? null,
      rawTime,
      trainerStatus: linked.status,
      sourceRow: row,
    };
    sessions.push(session);
    linked.ids.forEach((trainer, index) => {
      sessionTrainers.push({ sessionId: id, trainerId: trainer, sortOrder: index + 1 });
    });
  }

  if (breakRows.length > 0) {
    warnings.push({
      code: 'embedded-break',
      sheet: 'Timetable',
      message:
        'These practical rows include a 10-minute break note (3:20–3:30 p.m.) inside the course text. The note is stored on the session. It was not turned into its own row, because the sheet does not give it a separate time slot.',
      rows: breakRows,
    });
  }
  if (missingActivity.length > 0) {
    warnings.push({
      code: 'missing-activity',
      sheet: 'Timetable',
      message:
        'The activity cell is empty. The row is stored as type "event" and the course text is kept. A lesson type was not guessed.',
      rows: missingActivity,
    });
  }
  if (unknownActivities.length > 0) {
    warnings.push({
      code: 'unknown-activity',
      sheet: 'Timetable',
      message: 'The activity label is not one of the known session types. The row is stored as type "event".',
      rows: unknownActivities,
    });
  }
  if (ambiguousTimes.length > 0) {
    warnings.push({
      code: 'ambiguous-time',
      sheet: 'Timetable',
      message:
        'The time cell is not a single start–end pair such as "8:00 AM – 8:30 AM". Start and end were left empty and the original text was kept.',
      rows: ambiguousTimes,
    });
  }
  pushTrainerWarnings(warnings, {
    aliasCounts,
    whitespaceRows,
    slashRows,
    tbcRows,
    allRows,
    groupRows,
  });

  const dates = sessions.map((session) => session.date).sort();
  const startsOn = dates[0] ?? outlineWeeks.weeks[0]?.startsOn ?? '';
  const endsOn = dates[dates.length - 1] ?? startsOn;
  const headerSpan = rules.join(' ');
  const headerDates = /(\d{1,2})\s+October\s*[–—-]\s*(\d{1,2})\s+December\s+(\d{4})/i.exec(headerSpan);
  if (headerDates?.[1] && headerDates[2] && headerDates[3]) {
    const headerStart = `${headerDates[3]}-10-${headerDates[1].padStart(2, '0')}`;
    const headerEnd = `${headerDates[3]}-12-${headerDates[2].padStart(2, '0')}`;
    if (headerStart !== startsOn || headerEnd !== endsOn) {
      warnings.push({
        code: 'header-dates',
        sheet: 'Timetable',
        message: `The header says ${headerStart} to ${headerEnd}, but the session rows run from ${startsOn} to ${endsOn}. The session dates were kept.`,
        rows: [],
      });
    }
  }

  const reboticsRows = sessions.filter((session) => session.topic.includes('Rebotics')).map((session) => session.sourceRow);
  if (reboticsRows.length > 0) {
    warnings.push({
      code: 'spelling-kept',
      sheet: 'Timetable',
      message:
        'The timetable spells "Inter-School Rebotics Competitions". That spelling was kept. It was not corrected to Robotics.',
      rows: reboticsRows,
    });
  }
  const dayMismatch = sessions.filter((session) => session.day && weekdayName(session.date) !== session.day);
  if (dayMismatch.length > 0) {
    warnings.push({
      code: 'day-name',
      sheet: 'Timetable',
      message: 'The day name in the sheet does not match the date. The sheet text was kept.',
      rows: dayMismatch.map((session) => session.sourceRow),
    });
  }

  const seenKeys = new Set<string>();
  for (const session of sessions) {
    if (seenKeys.has(session.importKey)) {
      throw new Error(`Duplicate session key ${session.importKey}.`);
    }
    seenKeys.add(session.importKey);
  }

  return {
    id: 'bootcamp-2026',
    name: 'Cybersecurity Bootcamp',
    startsOn,
    endsOn,
    rules,
    sourceNote: outlineWeeks.sourceNote,
    blocks,
    weeks,
    deliverables: outlineWeeks.deliverables,
    trainers: [...trainers.values()].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    weekTrainers: outlineWeeks.weekTrainers,
    sessions,
    sessionTrainers,
    warnings,
  };
}

function pushTrainerWarnings(
  warnings: ParseWarning[],
  input: {
    aliasCounts: Map<string, number>;
    whitespaceRows: number[];
    slashRows: number[];
    tbcRows: number[];
    allRows: number[];
    groupRows: number[];
  },
): void {
  if (input.aliasCounts.size > 0) {
    const parts = [...input.aliasCounts.entries()].map(([alias, count]) => `${alias} (${count})`);
    warnings.push({
      code: 'trainer-alias',
      sheet: 'Timetable',
      message: `Name variants were folded onto one trainer record: ${parts.join('; ')}. Madam Diana follows the outline time-template label and the timetable text. Stanley and George Plange follow the longer names used elsewhere on the same workbook.`,
      rows: [],
    });
  }
  if (input.whitespaceRows.length > 0) {
    warnings.push({
      code: 'trainer-whitespace',
      sheet: 'Timetable',
      message: 'Extra spaces in a trainer cell were collapsed before matching. The people were not duplicated.',
      rows: input.whitespaceRows,
    });
  }
  if (input.slashRows.length > 0) {
    warnings.push({
      code: 'trainer-slash',
      sheet: 'Timetable',
      message: 'A slash between names (Arnold/Ken) was treated as two trainers.',
      rows: input.slashRows,
    });
  }
  if (input.tbcRows.length > 0) {
    warnings.push({
      code: 'trainer-unconfirmed',
      sheet: 'Timetable',
      message: 'TBC and "To be confirmed" were not created as trainer records. The row is marked unconfirmed.',
      rows: input.tbcRows,
    });
  }
  if (input.allRows.length > 0) {
    warnings.push({
      code: 'trainer-all',
      sheet: 'Timetable',
      message: '"All" was not created as a trainer. The row is marked as the whole teaching group.',
      rows: input.allRows,
    });
  }
  if (input.groupRows.length > 0) {
    warnings.push({
      code: 'trainer-group',
      sheet: 'Timetable',
      message: 'Maxim Nyansa Team is stored as a proposed group label, not as a person and not as a login.',
      rows: [...new Set(input.groupRows)],
    });
  }
  warnings.push({
    code: 'trainer-groups-pending',
    sheet: 'Timetable',
    message:
      'The sheet says proposed trainer groups follow the outline and daily allocation is pending. Week-level trainers come from the outline. Session trainers come from the timetable. Both are stored. They do not always list the same people.',
    rows: [],
  });
}

interface OutlineWeekDraft {
  row: number;
  number: number;
  blockId: string;
  startsOn: string;
  professionalism: string;
  cybersecurity: string;
  fallbackTitle: string;
}

function parseOutline(
  grid: SheetGrid,
  remember: (raw: string | undefined, row: number) => { ids: string[]; status: string },
  warnings: ParseWarning[],
): {
  blocks: ParsedBlock[];
  weeks: OutlineWeekDraft[];
  deliverables: ParsedProgramme['deliverables'];
  weekTrainers: ParsedProgramme['weekTrainers'];
  sourceNote: string;
} {
  const blocks: ParsedBlock[] = [];
  const weeks: OutlineWeekDraft[] = [];
  const deliverables: ParsedProgramme['deliverables'] = [];
  const weekTrainers: ParsedProgramme['weekTrainers'] = [];
  let block: ParsedBlock | undefined;
  let sourceNote = '';
  const blankTrainerRows: number[] = [];

  for (const row of [...grid.rows.keys()].sort((a, b) => a - b)) {
    const label = text(grid, row, 1);
    if (label.startsWith('Source:')) sourceNote = label;
    const blockMatch = BLOCK_LABEL.exec(label);
    if (blockMatch?.[1] && blockMatch[2]) {
      block = {
        id: `block-${blockMatch[1]}`,
        sortOrder: Number(blockMatch[1]),
        name: blockMatch[2].trim(),
        professionalismTheme: text(grid, row, 3),
        cybersecurityTheme: text(grid, row, 5),
      };
      blocks.push(block);
      continue;
    }
    const weekMatch = WEEK_LABEL.exec(label);
    if (!weekMatch?.[1] || !block) continue;
    const number = Number(weekMatch[1]);
    const startsOn = dateFromCell(cell(grid, row, 2));
    if (!startsOn) {
      warnings.push({
        code: 'ambiguous-date',
        sheet: 'Course Outline',
        message: `Week ${number} has no readable start date.`,
        rows: [row],
      });
      continue;
    }
    const professionalism = text(grid, row, 3);
    const professionalTrainers = text(grid, row, 4);
    const cybersecurity = text(grid, row, 5);
    const cyberTrainers = text(grid, row, 6);
    const practical = text(grid, row, 7);
    const id = weekId(number);
    weeks.push({
      row,
      number,
      blockId: block.id,
      startsOn,
      professionalism,
      cybersecurity,
      fallbackTitle: `Week ${number}`,
    });
    if (!professionalTrainers.trim()) blankTrainerRows.push(row);
    const professional = remember(professionalTrainers, row);
    const cyber = remember(cyberTrainers, row);
    professional.ids.forEach((trainer, index) => {
      weekTrainers.push({
        weekId: id,
        trainerId: trainer,
        role: 'professionalism',
        sortOrder: index + 1,
      });
    });
    cyber.ids.forEach((trainer, index) => {
      weekTrainers.push({
        weekId: id,
        trainerId: trainer,
        role: 'cybersecurity',
        sortOrder: index + 1,
      });
    });
    splitLines(practical).forEach((title, index) => {
      deliverables.push({
        id: `del-${String(number).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`,
        weekId: id,
        sortOrder: index + 1,
        title,
      });
    });
  }

  if (blankTrainerRows.length > 0) {
    warnings.push({
      code: 'missing-trainers',
      sheet: 'Course Outline',
      message:
        'The professionalism trainer cell is blank. No trainer was invented for that week.',
      rows: blankTrainerRows,
    });
  }
  return { blocks, weeks, deliverables, weekTrainers, sourceNote };
}

function outlineHasTemplate(grid: SheetGrid): boolean {
  for (const columns of grid.rows.values()) {
    if (columns.has(9) || columns.has(10) || columns.has(11)) return true;
  }
  return false;
}

function weekId(number: number): string {
  return `week-${String(number).padStart(2, '0')}`;
}

function splitLines(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => line.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);
}

function cell(grid: SheetGrid, row: number, column: number): CellValue | undefined {
  return grid.rows.get(row)?.get(column);
}

function text(grid: SheetGrid, row: number, column: number): string {
  const value = cell(grid, row, column);
  if (value === undefined) return '';
  return String(value).replace(/\u00a0/g, ' ').trim();
}

function dateFromCell(value: CellValue | undefined): string | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 20_000 && value < 80_000) {
    return excelSerial(value);
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

function excelSerial(serial: number): string {
  const utc = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
  return utc.toISOString().slice(0, 10);
}

function parseRange(raw: string): { start: string; end: string } | null {
  if (!raw) return null;
  const match =
    /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*[\u2010-\u2015-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(
      raw.trim(),
    );
  if (!match?.[1] || !match[2] || !match[3] || !match[4] || !match[5] || !match[6]) return null;
  const start = to24(Number(match[1]), Number(match[2]), match[3]);
  const end = to24(Number(match[4]), Number(match[5]), match[6]);
  if (!start || !end || minutes(end) <= minutes(start)) return null;
  return { start, end };
}

function to24(hour: number, minute: number, meridiem: string): string | null {
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  let value = hour % 12;
  if (meridiem.toUpperCase() === 'PM') value += 12;
  return `${String(value).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function minutes(value: string): number {
  const [hour, minute] = value.split(':').map((part) => Number(part));
  return (hour ?? 0) * 60 + (minute ?? 0);
}

export function weekdayName(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map((part) => Number(part));
  if (!year || !month || !day) return '';
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  ] ?? '';
}

/** Used when a short name is compared with a user display name. */
export function sameTrainerName(left: string, right: string): boolean {
  return trainerKey(canonicalTrainer(left).displayName) === trainerKey(canonicalTrainer(right).displayName);
}

export function isSessionType(value: string): value is SessionType {
  return Object.values(ACTIVITY_TYPE).includes(value as SessionType) || value === 'event';
}
