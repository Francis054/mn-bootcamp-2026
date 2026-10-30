import type { AppEnv } from '../../config/env.js';
import type { DocumentStorage } from './document-storage.js';
import { MemoryDocumentStorage } from './memory-document-storage.js';
import { SupabaseDocumentStorage } from './supabase-document-storage.js';
import { UnconfiguredDocumentStorage } from './unconfigured-document-storage.js';

/**
 * Supabase when the URL and service role key are both set. The owner confirmed
 * that private bucket for the hosted site. Otherwise memory in development and
 * test, and a refusing provider in production. The bucket name is not a secret.
 */
export function createDocumentStorage(env: AppEnv): DocumentStorage {
  const supabaseUrl = env.supabaseUrl;
  const serviceRoleKey = env.supabaseServiceRoleKey;
  if (supabaseUrl && serviceRoleKey) {
    return new SupabaseDocumentStorage({
      supabaseUrl,
      serviceRoleKey,
      bucket: env.cvBucket,
    });
  }
  if (env.nodeEnv === 'production') return new UnconfiguredDocumentStorage();
  return new MemoryDocumentStorage();
}
