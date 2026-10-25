import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseWorkbook } from '../../src/modules/timetable/parse-workbook.js';
import { timetableWorkbookPath } from '../../src/modules/timetable/workbook-path.js';
import { splitTrainers, trainerId } from '../../src/modules/timetable/names.js';

const parsed = parseWorkbook(readFileSync(timetableWorkbookPath()));

describe('timetable workbook', () => {
  it('reads the 12-week programme from 5 October to 25 December 2026', () => {
    expect(parsed.name).toBe('Cybersecurity Bootcamp');
    expect(parsed.startsOn).toBe('2026-10-05');
    expect(parsed.endsOn).toBe('2026-12-25');
    expect(parsed.blocks.map((block) => block.name)).toEqual([
      'Foundations & Secure Systems',
      'Applications, Data & Cryptography',
      'Identity, Cloud, Threats & Capstone',
    ]);
    expect(parsed.weeks).toHaveLength(12);
    expect(parsed.weeks[0]).toMatchObject({
      number: 1,
      title: 'Foundations and professional orientation',
      startsOn: '2026-10-05',
    });
    expect(parsed.weeks[11]).toMatchObject({
      number: 12,
      title: 'Incident response, exam revision and capstone',
      startsOn: '2026-12-21',
    });
    expect(parsed.sessions).toHaveLength(540);
    expect(parsed.deliverables.length).toBeGreaterThan(20);
    expect(parsed.trainers.map((trainer) => trainer.displayName)).toContain('Diana van der Stelt');
    expect(parsed.trainers.map((trainer) => trainer.displayName)).not.toContain('Madam Diana');
    expect(parsed.trainers.map((trainer) => trainer.displayName)).not.toContain('TBC');
    expect(parsed.trainers.map((trainer) => trainer.displayName)).not.toContain('All');
  });

  it('keeps one row per import key when the parser runs twice', () => {
    const again = parseWorkbook(readFileSync(timetableWorkbookPath()));
    const keys = parsed.sessions.map((session) => session.importKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(again.sessions.map((session) => session.id)).toEqual(parsed.sessions.map((session) => session.id));
    expect(again.trainers.map((trainer) => trainer.id)).toEqual(parsed.trainers.map((trainer) => trainer.id));
  });

  it('reports merged cells, the embedded break, and the blank activity instead of guessing', () => {
    const codes = parsed.warnings.map((warning) => warning.code);
    expect(codes).toContain('merged-cells');
    expect(codes).toContain('embedded-break');
    expect(codes).toContain('missing-activity');
    expect(codes).toContain('trainer-alias');
    expect(codes).toContain('missing-trainers');
    expect(codes).not.toContain('ambiguous-time');
    const offsite = parsed.sessions.filter((session) => session.topic.includes('Rebotics'));
    expect(offsite.length).toBeGreaterThan(0);
    expect(offsite.every((session) => session.type === 'event')).toBe(true);
    const first = parsed.sessions[0];
    expect(first).toMatchObject({
      date: '2026-10-05',
      day: 'Monday',
      type: 'devotion',
      startTime: '08:00',
      endTime: '08:30',
    });
    const practical = parsed.sessions.find((session) => session.notes.includes('3:20'));
    expect(practical?.topic.includes('10-minute break')).toBe(false);
  });

  it('folds trainer name variants and does not invent a person for TBC', () => {
    expect(splitTrainers('Ken,  David  Davor, Alfred Kumah').canonical).toEqual([
      'Ken',
      'David Davor',
      'Alfred Kumah',
    ]);
    expect(splitTrainers('Madam Diana').canonical).toEqual(['Diana van der Stelt']);
    expect(splitTrainers('Arnold/Ken, Sanders').canonical).toEqual(['Arnold', 'Ken', 'Sanders']);
    expect(splitTrainers('To be confirmed').status).toBe('tbc');
    expect(splitTrainers('All').status).toBe('all');
    const madam = splitTrainers('Madam Diana').canonical[0];
    expect(madam).toBe('Diana van der Stelt');
    expect(trainerId(madam ?? '')).toBe('tr-diana-van-der-stelt');
  });
});
