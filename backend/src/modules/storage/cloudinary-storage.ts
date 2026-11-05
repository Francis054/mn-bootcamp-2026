import { createHash, randomUUID } from 'node:crypto';
import type { StorageProvider, StoredObject } from './storage-provider.js';

export interface CloudinarySettings {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  fetchImpl?: typeof fetch;
}

/**
 * Uploads and deletes through Cloudinary's signed API. The cloud name, key,
 * and secret come from the environment. This class does not log them.
 */
export class CloudinaryStorage implements StorageProvider {
  readonly name = 'cloudinary' as const;

  constructor(private readonly settings: CloudinarySettings) {}

  async put(input: { bytes: Buffer; mime: string }): Promise<StoredObject> {
    const publicId = `mn/${randomUUID()}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = new FormData();
    body.set('file', new Blob([new Uint8Array(input.bytes)], { type: input.mime }), 'upload');
    body.set('api_key', this.settings.apiKey);
    body.set('timestamp', timestamp);
    body.set('public_id', publicId);
    body.set('signature', sign({ public_id: publicId, timestamp }, this.settings.apiSecret));
    const payload = await this.request('image/upload', body);
    const url = typeof payload.secure_url === 'string' ? payload.secure_url : '';
    if (url === '') throw new Error('Image storage did not return an address.');
    return { key: publicId, publicUrl: url };
  }

  async delete(key: string): Promise<void> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = new URLSearchParams();
    body.set('public_id', key);
    body.set('timestamp', timestamp);
    body.set('api_key', this.settings.apiKey);
    body.set('signature', sign({ public_id: key, timestamp }, this.settings.apiSecret));
    await this.request('image/destroy', body);
  }

  /**
   * Signed direct upload. The browser posts the file to Cloudinary.
   * The API secret stays here and is not one of the returned fields.
   */
  signVideoUpload(publicId: string, now = Date.now()): { uploadUrl: string; fields: Record<string, string> } {
    const timestamp = String(Math.floor(now / 1000));
    const signature = sign({ public_id: publicId, timestamp }, this.settings.apiSecret);
    const cloud = encodeURIComponent(this.settings.cloudName);
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloud}/video/upload`,
      fields: {
        api_key: this.settings.apiKey,
        timestamp,
        public_id: publicId,
        signature,
      },
    };
  }

  /** Read back a video Cloudinary accepted. Undefined when the asset is missing. */
  async describeVideo(
    publicId: string,
  ): Promise<{ publicUrl: string; bytes: number; format: string; resourceType: string } | undefined> {
    const cloud = encodeURIComponent(this.settings.cloudName);
    const id = encodeURIComponent(publicId);
    const token = Buffer.from(`${this.settings.apiKey}:${this.settings.apiSecret}`).toString('base64');
    const response = await (this.settings.fetchImpl ?? fetch)(
      `https://api.cloudinary.com/v1_1/${cloud}/resources/video/upload/${id}`,
      { headers: { Authorization: `Basic ${token}` } },
    );
    if (!response.ok) return undefined;
    const payload: unknown = await response.json();
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return undefined;
    const record = payload as Record<string, unknown>;
    const publicUrl = typeof record.secure_url === 'string' ? record.secure_url : '';
    const format = typeof record.format === 'string' ? record.format : '';
    const bytes = typeof record.bytes === 'number' ? record.bytes : -1;
    const resourceType = typeof record.resource_type === 'string' ? record.resource_type : '';
    if (publicUrl === '') return undefined;
    return { publicUrl, bytes, format, resourceType };
  }

  async deleteVideo(publicId: string): Promise<void> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = new URLSearchParams();
    body.set('public_id', publicId);
    body.set('timestamp', timestamp);
    body.set('api_key', this.settings.apiKey);
    body.set('signature', sign({ public_id: publicId, timestamp }, this.settings.apiSecret));
    await this.request('video/destroy', body);
  }

  private async request(action: string, body: FormData | URLSearchParams): Promise<JsonRecord> {
    const cloud = encodeURIComponent(this.settings.cloudName);
    const response = await (this.settings.fetchImpl ?? fetch)(
      `https://api.cloudinary.com/v1_1/${cloud}/${action}`,
      { method: 'POST', body },
    );
    if (!response.ok) throw new Error('Image storage refused the request.');
    const payload: unknown = await response.json();
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      throw new Error('Image storage returned an unexpected response.');
    }
    const record: JsonRecord = {};
    for (const [key, item] of Object.entries(payload)) record[key] = item;
    return record;
  }
}

type JsonRecord = Record<string, unknown>;

export function sign(params: Record<string, string>, apiSecret: string): string {
  const serialized = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key] ?? ''}`)
    .join('&');
  return createHash('sha1').update(`${serialized}${apiSecret}`).digest('hex');
}
