import { ApiError } from '../../shared/errors/api-error.js';
import { readImage, type ImageMime } from '../gallery/image-bytes.js';
import { imageSizeMessage } from '../gallery/media.rules.js';
import { MemoryStorage } from '../storage/memory-storage.js';
import type { StorageProvider } from '../storage/storage-provider.js';

const LOCAL_PREFIX = '/api/v1/public/uploads/';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface StoredProfilePhoto {
  photoUrl: string;
  storageKey: string;
}

/**
 * Keep the bytes with the same storage provider as the gallery.
 * Without Cloudinary, the address is a same-origin path the website can show.
 */
export async function storeProfilePhoto(
  bytes: Buffer,
  storage: StorageProvider,
  maxBytes: number,
): Promise<StoredProfilePhoto> {
  if (bytes.length > maxBytes) {
    throw new ApiError('validation', 'Check the highlighted fields.', {
      photoUrl: imageSizeMessage(maxBytes),
    });
  }
  const image = readImage(bytes);
  if (!image) {
    throw new ApiError('validation', 'Check the highlighted fields.', {
      photoUrl: 'Use a JPEG, PNG, or WebP image.',
    });
  }
  try {
    const stored = await storage.put({ bytes, mime: image.mime });
    const photoUrl = stored.publicUrl.startsWith('memory:')
      ? `${LOCAL_PREFIX}${stored.key}`
      : stored.publicUrl;
    return { photoUrl, storageKey: stored.key };
  } catch (error) {
    throw storageFailure(error);
  }
}

/** Bytes for a memory upload. Cloudinary addresses are not served from here. */
export function readMemoryUpload(
  storage: StorageProvider,
  key: string,
): { bytes: Buffer; mime: ImageMime } | undefined {
  if (!UUID.test(key) || !(storage instanceof MemoryStorage)) return undefined;
  const bytes = storage.objects.get(key);
  if (!bytes) return undefined;
  const image = readImage(bytes);
  if (!image) return undefined;
  return { bytes, mime: image.mime };
}

function storageFailure(error: unknown): ApiError {
  const message = error instanceof Error ? error.message : '';
  if (message === 'Image storage is not configured.') {
    return new ApiError('server', 'Image storage is not configured.');
  }
  return new ApiError('server', 'The image could not be stored.');
}
