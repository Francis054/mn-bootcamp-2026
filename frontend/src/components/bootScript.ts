/** Theatrical boot lines. Classroom jokes only — no exploit syntax and no real targets. */

export const BOOT_LINES = [
  '$ bootcamp --cohort 2026',
  '  [####......] welcome desk',
  '  [#######...] syllabus',
  '  [##########] seat in Accra',
] as const;

export const BOOT_LINES_SHORT = ['$ bootcamp --cohort 2026', '  [##########] seat in Accra'] as const;

export const BOOT_GRANTED = 'ACCESS GRANTED';
export const BOOT_WELCOME = 'welcome to MN Bootcamp 2026';

export interface BootFrame {
  lines: string[];
  cursor: boolean;
  granted: boolean;
  welcome: boolean;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Map a 0–1 clock onto typed lines, then the granted moment. */
export function bootFrame(fraction: number, repeat: boolean, reduced: boolean): BootFrame {
  const script = repeat ? BOOT_LINES_SHORT : BOOT_LINES;
  if (reduced) {
    return { lines: [...script], cursor: false, granted: true, welcome: true };
  }
  const progress = clamp(fraction);
  const typeEnd = 0.74;
  const grantAt = 0.8;
  const welcomeAt = 0.9;
  const total = script.reduce((count, line) => count + line.length, 0);
  const typed = Math.floor(total * Math.min(1, progress / typeEnd));
  const lines: string[] = [];
  let remaining = typed;
  for (const line of script) {
    if (remaining <= 0) break;
    lines.push(line.slice(0, remaining));
    remaining -= line.length;
  }
  return {
    lines,
    cursor: progress < grantAt,
    granted: progress >= grantAt,
    welcome: progress >= welcomeAt,
  };
}
