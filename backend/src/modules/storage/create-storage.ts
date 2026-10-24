import type { AppEnv } from '../../config/env.js';
import { CloudinaryStorage } from './cloudinary-storage.js';
import { MemoryStorage } from './memory-storage.js';
import type { StorageProvider } from './storage-provider.js';
import { UnconfiguredStorage } from './unconfigured-storage.js';

/**
 * Cloudinary when all three settings are present. Otherwise an in-memory
 * provider in development and test, and a refusing provider in production.
 * Neither path is selected by a hardcoded cloud name.
 */
export function createStorage(env: AppEnv): StorageProvider {
  const cloudName = env.cloudinaryCloudName;
  const apiKey = env.cloudinaryApiKey;
  const apiSecret = env.cloudinaryApiSecret;
  if (cloudName && apiKey && apiSecret) {
    return new CloudinaryStorage({ cloudName, apiKey, apiSecret });
  }
  if (env.nodeEnv === 'production') return new UnconfiguredStorage();
  return new MemoryStorage();
}
