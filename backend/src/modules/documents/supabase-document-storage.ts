import { randomUUID } from 'node:crypto';
import type { DocumentStorage, StoredDocument } from './document-storage.js';

export interface SupabaseDocumentOptions {
  supabaseUrl: string;
  serviceRoleKey: string;
  bucket: string;
  fetch?: typeof fetch;
}

/**
 * Private Supabase Storage bucket. Objects are written and read with the
 * service role. Nothing here builds a public object URL.
 */
export class SupabaseDocumentStorage implements DocumentStorage {
  readonly name = 'supabase' as const;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: SupabaseDocumentOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async put(input: { bytes: Buffer; contentType: string }): Promise<StoredDocument> {
    const key = `${randomUUID()}.pdf`;
    const response = await this.request(key, {
      method: 'POST',
      headers: {
        ...this.authHeaders(),
        'Content-Type': input.contentType,
        'x-upsert': 'false',
      },
      body: new Uint8Array(input.bytes),
    });
    if (!response.ok) throw storageFailure(response.status, 'saved');
    return { key };
  }

  async read(key: string): Promise<Buffer> {
    const response = await this.request(key, { method: 'GET', headers: this.authHeaders() });
    if (!response.ok) throw storageFailure(response.status, 'read');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) throw new Error('The CV could not be read.');
    return bytes;
  }

  async delete(key: string): Promise<void> {
    const response = await this.request(key, { method: 'DELETE', headers: this.authHeaders() });
    if (!response.ok && response.status !== 404) throw storageFailure(response.status, 'removed');
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.options.serviceRoleKey}`,
      apikey: this.options.serviceRoleKey,
    };
  }

  private request(key: string, init: RequestInit): Promise<Response> {
    const url = `${this.options.supabaseUrl}/storage/v1/object/${this.options.bucket}/${encodeURIComponent(key)}`;
    return this.fetchImpl(url, { ...init, signal: AbortSignal.timeout(20_000) });
  }
}

function storageFailure(status: number, verb: 'saved' | 'read' | 'removed'): Error {
  if (status === 404) return new Error('The CV bucket is not available.');
  if (verb === 'read') return new Error('The CV could not be read.');
  if (verb === 'removed') return new Error('The previous CV could not be removed.');
  return new Error('The CV could not be saved.');
}
