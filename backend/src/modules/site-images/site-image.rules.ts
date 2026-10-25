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
