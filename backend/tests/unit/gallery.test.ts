import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { testEnv } from '../support/app-env.js';
import { readImage } from '../../src/modules/gallery/image-bytes.js';
import { imageSizeMessage } from '../../src/modules/gallery/media.rules.js';
import { isPublicMedia } from '../../src/modules/gallery/media.service.js';
import { buildSampleMedia } from '../../src/modules/gallery/sample-media.js';
import { CloudinaryStorage, sign } from '../../src/modules/storage/cloudinary-storage.js';
import { createStorage } from '../../src/modules/storage/create-storage.js';
import { MemoryStorage } from '../../src/modules/storage/memory-storage.js';
import { UnconfiguredStorage } from '../../src/modules/storage/unconfigured-storage.js';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('gallery bytes and consent', () => {
  it('sniffs JPEG, PNG, and WebP and ignores the file name', () => {
    expect(readImage(TINY_PNG)).toEqual({ mime: 'image/png', width: 1, height: 1 });
    expect(readImage(minimalJpeg(640, 480))).toEqual({
      mime: 'image/jpeg',
      width: 640,
      height: 480,
    });
    expect(readImage(minimalWebp(16, 10))).toEqual({ mime: 'image/webp', width: 16, height: 10 });
    expect(readImage(Buffer.from('GIF89a not-a-photo.jpg'))).toBeUndefined();
    expect(readImage(Buffer.from('<html>named.jpg</html>'))).toBeUndefined();
    expect(readImage(oversizedPng())).toBeUndefined();
  });

  it('keeps a photo off the public site until it is published, visible, and verified', () => {
    expect(
      isPublicMedia({ publicationStatus: 'published', listing: 'public', consent: 'verified' }),
    ).toBe(true);
    expect(
      isPublicMedia({ publicationStatus: 'published', listing: 'sample', consent: 'verified' }),
    ).toBe(true);
    expect(
      isPublicMedia({ publicationStatus: 'published', listing: 'hidden', consent: 'verified' }),
    ).toBe(false);
    expect(
      isPublicMedia({ publicationStatus: 'draft', listing: 'public', consent: 'verified' }),
    ).toBe(false);
    expect(
      isPublicMedia({ publicationStatus: 'published', listing: 'public', consent: 'pending' }),
    ).toBe(false);
    expect(
      isPublicMedia({ publicationStatus: 'published', listing: 'public', consent: 'withdrawn' }),
    ).toBe(false);
    expect(
      isPublicMedia({ publicationStatus: 'scheduled', listing: 'public', consent: 'verified' }),
    ).toBe(false);
  });

  it('states the 5 MB cap in whole megabytes', () => {
    expect(imageSizeMessage(5 * 1024 * 1024)).toBe('Use an image of at most 5 MB.');
    expect(imageSizeMessage(200)).toBe('Use an image of at most 200 bytes.');
  });

  it('seeds three labelled placeholders and no photographs of people', () => {
    const rows = buildSampleMedia();
    expect(rows.map((row) => row.id)).toEqual(['sample-banner', 'sample-bench', 'sample-mark']);
    for (const row of rows) {
      expect(row.consent).toBe('pending');
      expect(row.publicationStatus).toBe('draft');
      expect(row.listing).toBe('hidden');
      expect(row.src).toBe('');
      expect(row.storageProvider).toBe('static');
      expect(row.alt).toContain('Not a photograph of a person.');
    }
  });
});

describe('image storage', () => {
  it('signs a Cloudinary request without putting the secret in the signature text', () => {
    const digest = sign({ timestamp: '10', public_id: 'mn/a' }, 'secret-value');
    expect(digest).toBe(
      createHash('sha1').update('public_id=mn/a&timestamp=10secret-value').digest('hex'),
    );
    expect(digest).not.toContain('secret-value');
  });

  it('uploads through the injected fetch and does not call the network', async () => {
    const seen: string[] = [];
    const storage = new CloudinaryStorage({
      cloudName: 'example-cloud',
      apiKey: 'key-value',
      apiSecret: 'secret-value',
      fetchImpl: (input) => {
        seen.push(requestUrl(input));
        return Promise.resolve(
          new Response(JSON.stringify({ secure_url: 'https://cdn.example.test/a.png' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      },
    });
    const stored = await storage.put({ bytes: TINY_PNG, mime: 'image/png' });
    expect(stored.publicUrl).toBe('https://cdn.example.test/a.png');
    expect(stored.key.startsWith('mn/')).toBe(true);
    expect(seen).toEqual(['https://api.cloudinary.com/v1_1/example-cloud/image/upload']);
  });

  it('turns a refused storage response into a generic error', async () => {
    const storage = new CloudinaryStorage({
      cloudName: 'example-cloud',
      apiKey: 'key-value',
      apiSecret: 'secret-value',
      fetchImpl: () => Promise.resolve(new Response('api_secret=secret-value', { status: 401 })),
    });
    await expect(storage.put({ bytes: TINY_PNG, mime: 'image/png' })).rejects.toThrow(
      'Image storage refused the request.',
    );
  });

  it('uses memory in tests, Cloudinary when all three settings exist, and a refusal in production', async () => {
    expect(createStorage(testEnv())).toBeInstanceOf(MemoryStorage);
    expect(createStorage(testEnv({ nodeEnv: 'production' }))).toBeInstanceOf(UnconfiguredStorage);
    const configured = createStorage(
      testEnv({
        cloudinaryCloudName: 'example-cloud',
        cloudinaryApiKey: 'key-value',
        cloudinaryApiSecret: 'secret-value',
      }),
    );
    expect(configured).toBeInstanceOf(CloudinaryStorage);
    const unconfigured = new UnconfiguredStorage();
    await expect(unconfigured.put({ bytes: TINY_PNG, mime: 'image/png' })).rejects.toThrow(
      'Image storage is not configured.',
    );
  });
});

function minimalJpeg(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(15);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xc0;
  bytes.writeUInt16BE(11, 4);
  bytes[6] = 8;
  bytes.writeUInt16BE(height, 7);
  bytes.writeUInt16BE(width, 9);
  return bytes;
}

function minimalWebp(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(30);
  bytes.write('RIFF', 0);
  bytes.write('WEBP', 8);
  bytes.write('VP8X', 12);
  bytes.writeUIntLE(width - 1, 24, 3);
  bytes.writeUIntLE(height - 1, 27, 3);
  return bytes;
}

function oversizedPng(): Buffer {
  const bytes = Buffer.alloc(24);
  TINY_PNG.copy(bytes, 0, 0, 8);
  bytes.write('IHDR', 12);
  bytes.writeUInt32BE(20_001, 16);
  bytes.writeUInt32BE(1, 20);
  return bytes;
}

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}
