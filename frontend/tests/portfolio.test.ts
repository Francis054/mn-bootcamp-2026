import { describe, expect, it } from 'vitest';
import { parseVideoLink, readPublicPortfolio, videoEmbedUrl } from '@/domain/portfolio';

const YOUTUBE = 'dQw4w9WgXcQ';
const VIMEO = '123456789';
const LOOM = '0123456789abcdef0123456789abcdef';

describe('portfolio video links', () => {
  it('builds official embeds and rejects look-alike hosts', () => {
    expect(parseVideoLink(`https://www.youtube.com/watch?v=${YOUTUBE}`)?.provider).toBe('youtube');
    expect(parseVideoLink(`https://youtu.be/${YOUTUBE}`)?.externalId).toBe(YOUTUBE);
    expect(parseVideoLink(`https://vimeo.com/${VIMEO}`)?.provider).toBe('vimeo');
    expect(parseVideoLink(`https://www.loom.com/share/${LOOM}`)?.provider).toBe('loom');
    expect(videoEmbedUrl('youtube', YOUTUBE)).toBe(`https://www.youtube-nocookie.com/embed/${YOUTUBE}`);
    expect(videoEmbedUrl('vimeo', VIMEO)).toContain('dnt=1');
    for (const url of [
      `https://youtube.com.evil.com/watch?v=${YOUTUBE}`,
      `https://notyoutube.com/watch?v=${YOUTUBE}`,
      `https://www.youtube.com.attacker.com/watch?v=${YOUTUBE}`,
      `https://vimeo.com.evil.net/${VIMEO}`,
      `https://loom.com.evil.com/share/${LOOM}`,
      `http://www.youtube.com/watch?v=${YOUTUBE}`,
    ]) {
      expect(parseVideoLink(url), url).toBeUndefined();
    }
  });

  it('ignores rows that are not portfolio items', () => {
    expect(readPublicPortfolio([{ id: '1', displayName: 'Sample' }])).toEqual([]);
    expect(readPublicPortfolio([{ id: 'item-1', kind: 'lab', title: 'Packet lab', summary: 'Notes', skills: ['Wireshark'] }])[0]?.title).toBe('Packet lab');
  });
});
