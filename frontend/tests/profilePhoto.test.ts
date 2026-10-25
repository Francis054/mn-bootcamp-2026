import { describe, expect, it } from 'vitest';
import { api } from '@/api/client';
import { displayPhotoUrl, profilePhotoFileProblem, sniffedPhotoMime } from '@/domain/photo';
import { normalizeTrainees } from '@/domain/publicContract';
import { ApiError } from '@/domain/types';
import { getState } from '@/dev/store';

const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
  (char) => char.charCodeAt(0),
);

describe('profile photo addresses', () => {
  it('keeps a data URL, a local upload path, and https, and drops anything else', () => {
    const data = `data:image/png;base64,${btoa('png')}`;
    const local = '/api/v1/public/uploads/11111111-1111-1111-1111-111111111111';
    const remote = 'https://res.cloudinary.com/demo/image/upload/v1/mn/photo.jpg';
    expect(displayPhotoUrl(data)).toBe(data);
    expect(displayPhotoUrl(local)).toBe(local);
    expect(displayPhotoUrl(remote)).toBe(remote);
    expect(displayPhotoUrl('javascript:alert(1)')).toBeNull();
    expect(displayPhotoUrl('http://example.test/photo.jpg')).toBeNull();
    expect(displayPhotoUrl('memory:11111111-1111-1111-1111-111111111111')).toBeNull();
    expect(displayPhotoUrl('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
    expect(normalizeTrainees([{ id: 't', displayName: 'A', photoUrl: 'javascript:alert(1)' }])[0]?.photoUrl).toBeNull();
  });

  it('identifies a PNG from its bytes and rejects a renamed text file', () => {
    expect(sniffedPhotoMime(PNG)).toBe('image/png');
    expect(sniffedPhotoMime(new Uint8Array([1, 2, 3, 4]))).toBeUndefined();
    expect(profilePhotoFileProblem({ type: 'image/gif', name: 'photo.gif', size: 12 })).toBe(
      'Use a JPEG, PNG, or WebP image.',
    );
    expect(profilePhotoFileProblem({ type: 'image/png', name: 'photo.png', size: 6 * 1024 * 1024 })).toBe(
      'Use an image of at most 5 MB.',
    );
  });
});

describe('development adapter profile photo', () => {
  it('stores a sniffed image as a data URL and shows it on the public profile', async () => {
    await api({
      method: 'POST',
      path: '/auth/login',
      body: { email: 'editor@example.test', password: 'length-ok', developmentAck: true },
    });
    const file = new File([PNG], 'real-name.png', { type: 'image/jpeg' });
    const body = new FormData();
    body.set('file', file);
    const uploaded = await api<{ photoUrl: string; storageKey: string }>({
      method: 'POST',
      path: '/admin/trainees/photo',
      body,
    });
    expect(uploaded.photoUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(uploaded.storageKey).toBe('adapter');
    expect(uploaded.photoUrl).not.toContain('real-name');

    const saved = await api<{ photoUrl: string | null }>({
      method: 'PATCH',
      path: '/admin/trainees/1',
      body: { photoUrl: uploaded.photoUrl, photoStorageKey: uploaded.storageKey, consentReceived: true },
    });
    expect(saved.photoUrl).toBe(uploaded.photoUrl);
    expect(getState().trainees.find((trainee) => trainee.id === '1')?.photoUrl).toBe(uploaded.photoUrl);

    const visible = await api<Record<string, unknown>>({ method: 'GET', path: '/public/trainees/1' });
    expect(visible.photoUrl).toBe(uploaded.photoUrl);
    expect(visible).not.toHaveProperty('email');
    expect(visible).not.toHaveProperty('photoStorageKey');
    const cards = await api<Array<{ id: string; photoUrl: string | null }>>({
      method: 'GET',
      path: '/public/trainees',
    });
    expect(cards.find((trainee) => trainee.id === '1')?.photoUrl).toBe(uploaded.photoUrl);

    const cleared = await api<{ photoUrl: string | null }>({
      method: 'PATCH',
      path: '/admin/trainees/1',
      body: { photoUrl: null },
    });
    expect(cleared.photoUrl).toBeNull();
    const hidden = await api<{ photoUrl: string | null }>({ method: 'GET', path: '/public/trainees/1' });
    expect(hidden.photoUrl).toBeNull();
  });

  it('refuses a viewer and a file that is not an image', async () => {
    await expect(
      api({ method: 'POST', path: '/admin/trainees/photo', body: new FormData() }),
    ).rejects.toMatchObject({ status: 401 });

    await api({
      method: 'POST',
      path: '/auth/login',
      body: { email: 'viewer@example.test', password: 'length-ok', developmentAck: true },
    });
    const denied = new FormData();
    denied.set('file', new File([PNG], 'portrait.png', { type: 'image/png' }));
    await expect(api({ method: 'POST', path: '/admin/trainees/photo', body: denied })).rejects.toMatchObject({
      status: 403,
    });

    await api({
      method: 'POST',
      path: '/auth/login',
      body: { email: 'editor@example.test', password: 'length-ok', developmentAck: true },
    });
    const fake = new FormData();
    fake.set('file', new File([new Uint8Array([1, 2, 3, 4])], 'portrait.jpg', { type: 'image/jpeg' }));
    try {
      await api({ method: 'POST', path: '/admin/trainees/photo', body: fake });
      throw new Error('A renamed file was accepted.');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        status: 422,
        fieldErrors: { photoUrl: 'Use a JPEG, PNG, or WebP image.' },
      });
      expect(JSON.stringify(error)).not.toContain('portrait.jpg');
    }

    await expect(
      api({
        method: 'PATCH',
        path: '/admin/trainees/1',
        body: { photoUrl: 'javascript:alert(1)', consentReceived: true },
      }),
    ).rejects.toMatchObject({
      status: 422,
      fieldErrors: { photoUrl: 'Use a JPEG, PNG, or WebP image.' },
    });
  });
});
