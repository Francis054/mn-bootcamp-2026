import { describe, expect, it } from 'vitest';
import {
  approveItem,
  readItemWrite,
  rejectItem,
  submitItem,
} from '../../src/modules/portfolio/portfolio-rules.js';
import {
  sniffVideo,
  videoByteProblem,
  videoMimeProblem,
} from '../../src/modules/portfolio/video-bytes.js';
import { parseVideoLink, videoEmbedUrl } from '../../src/modules/portfolio/video-url.js';

const YOUTUBE = 'dQw4w9WgXcQ';
const VIMEO = '123456789';
const LOOM = '0123456789abcdef0123456789abcdef';

describe('portfolio video links', () => {
  it('accepts YouTube, Vimeo, and Loom and builds the official embed', () => {
    expect(parseVideoLink(`https://www.youtube.com/watch?v=${YOUTUBE}`)).toEqual({
      provider: 'youtube',
      externalId: YOUTUBE,
    });
    expect(parseVideoLink(`https://youtu.be/${YOUTUBE}`)?.provider).toBe('youtube');
    expect(parseVideoLink(`https://m.youtube.com/watch?v=${YOUTUBE}`)?.externalId).toBe(YOUTUBE);
    expect(parseVideoLink(`https://www.youtube.com/shorts/${YOUTUBE}`)?.externalId).toBe(YOUTUBE);
    expect(parseVideoLink(`https://www.youtube-nocookie.com/embed/${YOUTUBE}`)?.externalId).toBe(YOUTUBE);
    expect(parseVideoLink(`https://vimeo.com/${VIMEO}`)).toEqual({ provider: 'vimeo', externalId: VIMEO });
    expect(parseVideoLink(`https://player.vimeo.com/video/${VIMEO}`)?.externalId).toBe(VIMEO);
    expect(parseVideoLink(`https://www.loom.com/share/${LOOM}`)).toEqual({ provider: 'loom', externalId: LOOM });
    expect(parseVideoLink(`https://loom.com/embed/${LOOM}`)?.externalId).toBe(LOOM);

    expect(videoEmbedUrl('youtube', YOUTUBE)).toBe(`https://www.youtube-nocookie.com/embed/${YOUTUBE}`);
    expect(videoEmbedUrl('vimeo', VIMEO)).toBe(`https://player.vimeo.com/video/${VIMEO}?dnt=1`);
    expect(videoEmbedUrl('loom', LOOM)).toBe(`https://www.loom.com/embed/${LOOM}`);
    expect(videoEmbedUrl('youtube', 'not-an-id')).toBeNull();
    expect(videoEmbedUrl('other', YOUTUBE)).toBeNull();
  });

  it('rejects look-alike hosts, other schemes, and short ids', () => {
    const refused = [
      `http://www.youtube.com/watch?v=${YOUTUBE}`,
      `https://youtube.com.evil.com/watch?v=${YOUTUBE}`,
      `https://notyoutube.com/watch?v=${YOUTUBE}`,
      `https://www.youtube.com.attacker.com/watch?v=${YOUTUBE}`,
      `https://youtu.be.evil.com/${YOUTUBE}`,
      `https://evil.youtube.com/watch?v=${YOUTUBE}`,
      `https://youtube-nocookie.com.evil.com/embed/${YOUTUBE}`,
      `https://user:pass@www.youtube.com/watch?v=${YOUTUBE}`,
      `https://vimeo.com.evil.net/${VIMEO}`,
      `https://player.vimeo.com.evil.com/video/${VIMEO}`,
      `https://loom.com.evil.com/share/${LOOM}`,
      `https://www.loom.com.evil.com/share/${LOOM}`,
      `https://evil.example/watch?v=${YOUTUBE}`,
      'javascript:alert(1)',
      'https://www.youtube.com/watch?v=short',
      'https://vimeo.com/123',
      'https://www.loom.com/share/abc',
      `https://www.youtube.com/watch?v=${YOUTUBE}.evil`,
    ];
    for (const url of refused) {
      expect(parseVideoLink(url), url).toBeUndefined();
    }
  });
});

describe('portfolio video bytes', () => {
  it('recognises mp4, webm, and mov, and refuses other files', () => {
    expect(sniffVideo(ftyp('isom'))).toBe('video/mp4');
    expect(sniffVideo(ftyp('qt  '))).toBe('video/quicktime');
    expect(sniffVideo(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00]))).toBe('video/webm');
    expect(sniffVideo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeUndefined();
    expect(sniffVideo(Buffer.from('not a video'))).toBeUndefined();
    expect(sniffVideo(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).toBeUndefined();
  });

  it('checks the declared type and the size limit', () => {
    expect(videoMimeProblem('video/mp4')).toBeUndefined();
    expect(videoMimeProblem('video/webm')).toBeUndefined();
    expect(videoMimeProblem('video/quicktime')).toBeUndefined();
    expect(videoMimeProblem('image/svg+xml')).toMatch(/MP4/);
    expect(videoMimeProblem('video/x-msvideo')).toMatch(/MP4/);
    expect(videoByteProblem(24, 64)).toBeUndefined();
    expect(videoByteProblem(65, 64)).toMatch(/64/);
    expect(videoByteProblem(0, 64)).toMatch(/Choose a video/);
    expect(videoByteProblem(1.5, 64)).toMatch(/Choose a video/);
  });
});

describe('portfolio review rules', () => {
  it('keeps a pending edit in review and requires a change after approval', () => {
    expect(submitItem('draft', true)).toEqual({ ok: true, status: 'pending' });
    expect(submitItem('rejected', true)).toEqual({ ok: true, status: 'pending' });
    expect(submitItem('draft', false).ok).toBe(false);
    expect(submitItem('pending', true).ok).toBe(false);
    expect(submitItem('approved', true).ok).toBe(false);
    expect(approveItem('pending')).toEqual({ ok: true, status: 'approved' });
    expect(approveItem('draft').ok).toBe(false);
    expect(rejectItem('pending', '  Too much detail. ').ok && rejectItem('pending', '  Too much detail. ')).toMatchObject({
      ok: true,
      reason: 'Too much detail.',
    });
    expect(rejectItem('pending', '   ').ok).toBe(false);
    expect(rejectItem('approved', 'No').ok).toBe(false);
  });

  it('accepts https links and refuses other addresses', () => {
    const good = readItemWrite(
      {
        kind: 'lab',
        title: 'Packet lab',
        summary: 'Isolated network.',
        skills: ['Wireshark'],
        repositoryUrl: 'https://github.com/example/lab',
        demoUrl: '',
      },
      'create',
    );
    expect(good.errors).toEqual({});
    expect(good.value.repositoryUrl).toBe('https://github.com/example/lab');
    const bad = readItemWrite({ repositoryUrl: 'http://example.com/lab', demoUrl: 'https://127.0.0.1/demo' }, 'patch');
    expect(bad.errors.repositoryUrl).toMatch(/https/);
    expect(bad.errors.demoUrl).toBeTruthy();
  });
});

function ftyp(brand: string): Buffer {
  return Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from(`ftyp${brand}`), Buffer.alloc(8)]);
}
