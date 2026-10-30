export interface StoredObject {
  key: string;
  publicUrl: string;
}

/**
 * Where an uploaded file lives. Repositories do not call this.
 * `static` is a stored label for bundled files, not a runtime provider.
 * Video files use Cloudinary's video API when that provider is configured.
 * The memory provider keeps any bytes the portfolio service has already checked.
 */
export interface StorageProvider {
  readonly name: 'memory' | 'cloudinary' | 'unconfigured';
  put(input: { bytes: Buffer; mime: string }): Promise<StoredObject>;
  delete(key: string): Promise<void>;
}
