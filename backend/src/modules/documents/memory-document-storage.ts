import { randomUUID } from 'node:crypto';
import type { DocumentStorage, StoredDocument } from './document-storage.js';

/**
 * In-memory stand-in for development and tests. It does not touch the network
 * or the disk. A restart drops every CV, which is why production does not use it.
 */
export class MemoryDocumentStorage implements DocumentStorage {
  readonly name = 'memory' as const;
  readonly objects = new Map<string, Buffer>();
  /** Tests set this so a removal can show a failed CV delete and then retry it. */
  failDeletes = false;

  put(input: { bytes: Buffer; contentType?: string }): Promise<StoredDocument> {
    const key = `${randomUUID()}.pdf`;
    this.objects.set(key, Buffer.from(input.bytes));
    return Promise.resolve({ key });
  }

  read(key: string): Promise<Buffer> {
    const found = this.objects.get(key);
    if (!found) return Promise.reject(new Error('The CV could not be read.'));
    return Promise.resolve(Buffer.from(found));
  }

  delete(key: string): Promise<void> {
    if (this.failDeletes) {
      return Promise.reject(new Error('The CV could not be removed.'));
    }
    this.objects.delete(key);
    return Promise.resolve();
  }
}

export function isMemoryDocumentStorage(
  storage: DocumentStorage,
): storage is MemoryDocumentStorage {
  return storage instanceof MemoryDocumentStorage;
}
