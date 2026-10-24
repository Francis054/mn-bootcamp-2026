import { randomUUID } from 'node:crypto';
import type { StorageProvider, StoredObject } from './storage-provider.js';

/**
 * In-memory stand-in for development and tests. It does not touch the network
 * or the disk. Render's free disk is wiped on restart, so uploads do not go there.
 */
export class MemoryStorage implements StorageProvider {
  readonly name = 'memory' as const;
  readonly objects = new Map<string, Buffer>();
  failDeletes = false;

  put(input: { bytes: Buffer }): Promise<StoredObject> {
    const key = randomUUID();
    this.objects.set(key, Buffer.from(input.bytes));
    return Promise.resolve({ key, publicUrl: `memory:${key}` });
  }

  delete(key: string): Promise<void> {
    if (this.failDeletes) {
      return Promise.reject(new Error('The storage provider could not delete the object.'));
    }
    this.objects.delete(key);
    return Promise.resolve();
  }
}
