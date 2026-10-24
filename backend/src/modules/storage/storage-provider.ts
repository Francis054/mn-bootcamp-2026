import type { ImageMime } from '../gallery/image-bytes.js';

export interface StoredObject {
  key: string;
  publicUrl: string;
}

/**
 * Where an uploaded image lives. Repositories do not call this.
 * `static` is a stored label for bundled files, not a runtime provider.
 */
export interface StorageProvider {
  readonly name: 'memory' | 'cloudinary' | 'unconfigured';
  put(input: { bytes: Buffer; mime: ImageMime }): Promise<StoredObject>;
  delete(key: string): Promise<void>;
}
