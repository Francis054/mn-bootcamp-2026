import { describe, expect, it } from 'vitest';
import { peekPlacement, peekTracksPointer } from '@/pages/public/classPeek';

describe('class peek', () => {
  it('places the preview on the pointer without using left or top', () => {
    expect(peekPlacement(720.4, 622.6)).toBe('translate3d(720px, 623px, 0) translate(-50%, -50%)');
  });

  it('stays off when the pointer is coarse or motion is reduced', () => {
    expect(peekTracksPointer(() => ({ matches: true }))).toBe(false);
    expect(peekTracksPointer(() => ({ matches: false }))).toBe(true);
  });
});
