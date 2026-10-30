import type { StorageProvider } from './storage-provider.js';

/** Production without Cloudinary settings. The process still boots. Uploads refuse. */
export class UnconfiguredStorage implements StorageProvider {
  readonly name = 'unconfigured' as const;

  put(_input: { bytes: Buffer; mime: string }): Promise<never> {
    return Promise.reject(new Error('Image storage is not configured.'));
  }

  delete(_key: string): Promise<never> {
    return Promise.reject(new Error('Image storage is not configured.'));
  }
}
