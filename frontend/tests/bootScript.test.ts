import { describe, expect, it } from 'vitest';
import {
  BOOT_GRANTED,
  BOOT_NAME,
  BOOT_SCENE1,
  BOOT_SCENE2,
  BOOT_SUCCESS,
  BOOT_VIDEO_SRC,
  BOOT_WARN,
  BOOT_YEAR,
  bootView,
} from '@/components/bootFilm';

const BANNED = ['nmap', 'metasploit', 'sqlmap', 'sudo', '/etc/passwd', 'rm -rf', 'exploit', 'payload'];

describe('cinematic boot', () => {
  it('keeps the three scenes and the exact grant wording, with no shipped video', () => {
    const joined = [...BOOT_SCENE1, ...BOOT_SCENE2, BOOT_WARN, BOOT_SUCCESS, BOOT_GRANTED, BOOT_NAME, BOOT_YEAR].join('\n').toLowerCase();
    for (const word of BANNED) expect(joined).not.toContain(word);
    expect(BOOT_SCENE1).toEqual([
      'INITIALIZING SECURE ENVIRONMENT...',
      'ESTABLISHING SECURE CONNECTION...',
      'VERIFYING AUTHENTICATION...',
    ]);
    expect(BOOT_GRANTED).toBe('ACCESS GRANTED');
    expect(BOOT_NAME).toBe('MAXIM NYANSA');
    expect(BOOT_YEAR).toBe('CYBERSECURITY 2026');
    expect(BOOT_VIDEO_SRC).toBe('');

    const early = bootView(400, null, false, false, false, false);
    expect(early.scene).toBe(1);
    expect(early.scene1[0]).toBe(true);
    expect(early.leave).toBe(false);

    const middle = bootView(3000, null, false, false, false, false);
    expect(middle.scene).toBe(2);
    expect(middle.warn).toBe('watch');
    expect(middle.progress).toBeGreaterThan(0.7);

    const reveal = bootView(4800, null, false, false, true, false);
    expect(reveal.scene).toBe(3);
    expect(reveal.leave).toBe(true);
  });

  it('jumps to the reveal when the app is ready, and shortens a repeat visit', () => {
    const jumped = bootView(200, 80, false, false, true, false);
    expect(jumped.scene).toBe(3);
    expect(jumped.leave).toBe(false);

    const held = bootView(80 + 1400, 80, false, false, true, false);
    expect(held.scene).toBe(3);
    expect(held.leave).toBe(true);

    const repeat = bootView(900, 0, true, false, true, false);
    expect(repeat.scene).toBe(3);
    expect(repeat.leave).toBe(true);

    const still = bootView(700, 0, false, true, true, false);
    expect(still.scene).toBe(3);
    expect(still.leave).toBe(true);

    const skipped = bootView(10, null, false, false, false, true);
    expect(skipped.leave).toBe(true);
  });
});