import type { PublicWorkPhoto } from './types';

/** A displayable address. Local memory photos are read from the API. Other hosts are not used. */
export function workPhotoAddress(photo: Pick<PublicWorkPhoto, 'id' | 'src'>, audience: 'admin' | 'public'): string {
  if (photo.src.startsWith('https://') || photo.src.startsWith('/')) return photo.src;
  if (photo.src.startsWith('memory:')) {
    const root = audience === 'admin' ? '/api/v1/admin/work-photos' : '/api/v1/public/work-photos';
    return `${root}/${encodeURIComponent(photo.id)}/file`;
  }
  return '';
}

export function workPhotoFieldErrors(input: { traineeId: string; alt: string; caption: string; fileCount: number }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.traineeId.trim()) errors.traineeId = 'Choose a trainee.';
  const alt = input.alt.trim();
  if (!alt) errors.alt = 'Describe the image without naming anyone.';
  else if (alt.length > 300) errors.alt = 'Use at most 300 characters.';
  if (input.caption.length > 500) errors.caption = 'Use at most 500 characters.';
  if (input.fileCount < 1) errors.file = 'Choose an image.';
  return errors;
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function workPhotoFileError(file: File): string | undefined {
  const named = /\.(jpe?g|png|webp)$/i.test(file.name);
  const type = file.type.toLowerCase();
  // Some browsers label a WebP file as a generic type. The server still checks the bytes.
  if (type.startsWith('image/') && !IMAGE_TYPES.has(type)) return 'Use a JPEG, PNG, or WebP image.';
  if (!IMAGE_TYPES.has(type) && !named) return 'Use a JPEG, PNG, or WebP image.';
  if (file.size > 10 * 1024 * 1024) return 'Use an image of at most 10 MB.';
  return undefined;
}
