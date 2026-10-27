import { siteImageSlot } from './catalogue.js';

export function siteImageKeyMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !siteImageSlot(value.trim())) {
    return 'Choose a known image slot.';
  }
  return undefined;
}

/** Empty alt text is allowed. A decorative placement can stay unlabelled. */
export function siteImageAltMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return 'Use plain text.';
  if (value.trim().length > 300) return 'Use at most 300 characters.';
  return undefined;
}

/** Omitted tagline is left unchanged. An empty string hides the badge banner. */
export function siteImageTaglineMessage(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return 'Use plain text.';
  if (/[\r\n]/.test(value)) return 'Use a single line.';
  if (value.trim().length > 40) return 'Use at most 40 characters.';
  return undefined;
}
