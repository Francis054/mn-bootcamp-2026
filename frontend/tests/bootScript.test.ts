import { describe, expect, it } from 'vitest';
import { BOOT_GRANTED, BOOT_LINES, BOOT_LINES_SHORT, BOOT_WELCOME, bootFrame } from '@/components/bootScript';

const BANNED = ['nmap', 'metasploit', 'sqlmap', 'sudo', '/etc/passwd', 'rm -rf', 'exploit', 'payload'];

describe('boot script', () => {
  it('types a harmless classroom sequence and ends on the welcome line', () => {
    const joined = [...BOOT_LINES, ...BOOT_LINES_SHORT, BOOT_GRANTED, BOOT_WELCOME].join('\n').toLowerCase();
    for (const word of BANNED) expect(joined).not.toContain(word);
    expect(BOOT_WELCOME).toBe('welcome to MN Bootcamp 2026');
    expect(BOOT_GRANTED).toBe('ACCESS GRANTED');

    const start = bootFrame(0, false, false);
    expect(start.lines).toEqual([]);
    expect(start.cursor).toBe(true);
    expect(start.granted).toBe(false);

    const mid = bootFrame(0.37, false, false);
    expect(mid.lines.join('')).toContain('bootcamp');
    expect(mid.granted).toBe(false);

    const end = bootFrame(1, false, false);
    expect(end.lines).toEqual([...BOOT_LINES]);
    expect(end.cursor).toBe(false);
    expect(end.granted).toBe(true);
    expect(end.welcome).toBe(true);
  });

  it('shortens a repeat visit and shows the ending immediately when motion is reduced', () => {
    const repeat = bootFrame(1, true, false);
    expect(repeat.lines).toEqual([...BOOT_LINES_SHORT]);
    expect(repeat.lines.join('').length).toBeLessThan(BOOT_LINES.join('').length);

    const still = bootFrame(0, false, true);
    expect(still.lines).toEqual([...BOOT_LINES]);
    expect(still.cursor).toBe(false);
    expect(still.granted).toBe(true);
    expect(still.welcome).toBe(true);
  });
});
