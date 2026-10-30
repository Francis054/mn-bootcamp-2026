import type { DocumentStorage } from './document-storage.js';

/** Production without the Supabase settings. The process still boots. CV uploads refuse. */
export class UnconfiguredDocumentStorage implements DocumentStorage {
  readonly name = 'unconfigured' as const;

  put(_input: { bytes: Buffer; contentType: string }): Promise<never> {
    return Promise.reject(new Error('CV storage is not configured.'));
  }

  read(_key: string): Promise<never> {
    return Promise.reject(new Error('CV storage is not configured.'));
  }

  delete(_key: string): Promise<never> {
    return Promise.reject(new Error('CV storage is not configured.'));
  }
}
