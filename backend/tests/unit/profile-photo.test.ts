import { describe, expect, it } from 'vitest';
import { readImage } from '../../src/modules/gallery/image-bytes.js';
import { storeProfilePhoto } from '../../src/modules/trainees/profile-photo.js';
import { photoPairMessage, photoUrlMessage } from '../../src/modules/trainees/trainee.rules.js';
import { ApiError } from '../../src/shared/errors/api-error.js';
import { MemoryStorage } from '../../src/modules/storage/memory-storage.js';
import { UnconfiguredStorage } from '../../src/modules/storage/unconfigured-storage.js';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('profile photo storage', () => {
  it('keeps a sniffed image in memory and returns a same-origin address', async () => {
    expect(readImage(TINY_PNG)?.mime).toBe('image/png');
    const storage = new MemoryStorage();
    const stored = await storeProfilePhoto(TINY_PNG, storage, 5 * 1024 * 1024);
    expect(stored.photoUrl).toBe(`/api/v1/public/uploads/${stored.storageKey}`);
    expect(storage.objects.get(stored.storageKey)?.equals(TINY_PNG)).toBe(true);
    expect(JSON.stringify(stored)).not.toContain('portrait');
  });

  it('rejects a renamed file, an oversized file, and storage that is not configured', async () => {
    const storage = new MemoryStorage();
    await expect(storeProfilePhoto(Buffer.from('not-a-photo'), storage, 50)).rejects.toMatchObject({
      code: 'validation',
      fieldErrors: { photoUrl: 'Use a JPEG, PNG, or WebP image.' },
    });
    await expect(storeProfilePhoto(TINY_PNG, storage, 8)).rejects.toMatchObject({
      fieldErrors: { photoUrl: 'Use an image of at most 8 bytes.' },
    });
    await expect(storeProfilePhoto(TINY_PNG, new UnconfiguredStorage(), 50)).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('accepts an https address or the memory path, and refuses a script address', () => {
    expect(
      photoUrlMessage('https://res.cloudinary.com/demo/image/upload/v1/mn/photo.jpg'),
    ).toBeUndefined();
    expect(
      photoUrlMessage('/api/v1/public/uploads/11111111-1111-1111-1111-111111111111'),
    ).toBeUndefined();
    expect(photoUrlMessage(null)).toBeUndefined();
    expect(photoUrlMessage('javascript:alert(1)')).toBe('Use a JPEG, PNG, or WebP image.');
    expect(photoUrlMessage('http://example.test/photo.jpg')).toBe(
      'Use a JPEG, PNG, or WebP image.',
    );
    const key = '11111111-1111-1111-1111-111111111111';
    expect(photoPairMessage(`/api/v1/public/uploads/${key}`, key)).toBeUndefined();
    expect(
      photoPairMessage(`/api/v1/public/uploads/${key}`, '22222222-2222-2222-2222-222222222222'),
    ).toBe('Use a JPEG, PNG, or WebP image.');
    expect(
      photoPairMessage('https://res.cloudinary.com/demo/image/upload/v1/mn/photo.jpg', `mn/${key}`),
    ).toBeUndefined();
  });
});
