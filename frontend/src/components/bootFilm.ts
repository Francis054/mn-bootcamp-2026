/** Cinematic boot copy. Simulated status only — no commands and no targets. */

export const BOOT_SCENE1 = [
  'INITIALIZING SECURE ENVIRONMENT...',
  'ESTABLISHING SECURE CONNECTION...',
  'VERIFYING AUTHENTICATION...',
] as const;

export const BOOT_SCENE2 = [
  'LAB POLICY · AUTHORISED SESSION',
  'CHANNEL SES-2026-0142 · STABLE',
  'INTEGRITY CHECK · MATCH',
  'NODE LINK · 14 PEERS · NOMINAL',
] as const;

export const BOOT_WARN = 'CLOCK SKEW · 42ms · WATCH';
export const BOOT_WARN_OK = 'CLOCK SKEW · 42ms · NOMINAL';
export const BOOT_SUCCESS = 'AUTHENTICATION SUCCESSFUL';
export const BOOT_GRANTED = 'ACCESS GRANTED';
export const BOOT_NAME = 'MAXIM NYANSA';
export const BOOT_YEAR = 'CYBERSECURITY 2026';

/** Optional Scene 2 clip. Empty until a file is shipped — the sequence does not mention it. */
export const BOOT_VIDEO_SRC = '';

export const BOOT_SCENE2_MS = 1500;
export const BOOT_REVEAL_MS = 3400;
export const BOOT_REVEAL_HOLD_MS = 1400;
export const BOOT_FILM_MS = 5000;

const SCENE1_AT = [120, 560, 980];
const SCENE2_AT = [1680, 1980, 2280, 2580];
export const BOOT_WARN_AT = 2880;
export const BOOT_WARN_CLEAR_AT = 3180;

export interface BootView {
  scene: 1 | 2 | 3;
  progress: number;
  scene1: boolean[];
  scene2: boolean[];
  warn: 'off' | 'watch' | 'ok';
  leave: boolean;
}

/** Map the clock onto the three scenes. A ready app before the reveal jumps there. */
export function bootView(elapsed: number, readyAt: number | null, repeat: boolean, reduced: boolean, appReady: boolean, skipped: boolean): BootView {
  const virtual = repeat || reduced
    ? BOOT_REVEAL_MS + Math.max(0, elapsed)
    : readyAt != null && readyAt < BOOT_REVEAL_MS
      ? BOOT_REVEAL_MS + Math.max(0, elapsed - readyAt)
      : elapsed;
  const scene: 1 | 2 | 3 = virtual < BOOT_SCENE2_MS ? 1 : virtual < BOOT_REVEAL_MS ? 2 : 3;
  const span = BOOT_REVEAL_MS - BOOT_SCENE2_MS;
  const progress = scene === 3 ? 1 : scene === 2 ? Math.max(0, Math.min(1, (virtual - BOOT_SCENE2_MS) / span)) : 0;
  const revealFor = virtual - BOOT_REVEAL_MS;
  const leave = skipped
    || (repeat && appReady && elapsed >= 900)
    || (reduced && appReady && elapsed >= 700)
    || (!repeat && !reduced && appReady && scene === 3 && revealFor >= BOOT_REVEAL_HOLD_MS);
  return {
    scene,
    progress,
    scene1: SCENE1_AT.map((at) => virtual >= at),
    scene2: SCENE2_AT.map((at) => virtual >= at),
    warn: virtual >= BOOT_WARN_CLEAR_AT ? 'ok' : virtual >= BOOT_WARN_AT ? 'watch' : 'off',
    leave,
  };
}
