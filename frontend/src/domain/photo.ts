/** Default upload cap. The API uses the same 5 MB unless the host sets another limit. */
export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

const LOCAL_PHOTO =
  /^\/api\/v1\/public\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA_PHOTO = /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/]+={0,2}$/i;

export type ProfilePhotoMime = 'image/jpeg' | 'image/png' | 'image/webp';

export function profilePhotoFileProblem(file: { type: string; name: string; size: number }): string | undefined {
  if (file.size <= 0) return 'Choose an image.';
  if (file.size > PROFILE_PHOTO_MAX_BYTES) return 'Use an image of at most 5 MB.';
  const type = file.type.toLowerCase();
  if (type && type !== 'application/octet-stream' && !profilePhotoMime(file)) {
    return 'Use a JPEG, PNG, or WebP image.';
  }
  return undefined;
}

export function profilePhotoMime(file: { type: string; name: string }): ProfilePhotoMime | undefined {
  const type = file.type.toLowerCase();
  if (type === 'image/jpeg' || type === 'image/png' || type === 'image/webp') return type;
  if (type && type !== 'application/octet-stream') return undefined;
  const name = file.name.toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  return undefined;
}

/** Read the file bytes. Some test environments omit Blob.arrayBuffer. */
export async function readFileBytes(file: Blob): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') return new Uint8Array(await file.arrayBuffer());
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error('The image could not be read.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('The image could not be read.'));
    reader.readAsArrayBuffer(file);
  });
  return new Uint8Array(buffer);
}

/** Identify JPEG, PNG, or WebP from the bytes. A renamed file is not trusted. */
export function sniffedPhotoMime(bytes: Uint8Array): ProfilePhotoMime | undefined {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return undefined;
}

/** An address the public pages can put in an img tag. Anything else stays off the page. */
export function displayPhotoUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 8_000_000) return null;
  if (DATA_PHOTO.test(trimmed) || LOCAL_PHOTO.test(trimmed)) return trimmed;
  if (trimmed.length > 1000) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return trimmed;
  } catch {
    return null;
  }
}

export function previewPhotoUrl(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith('blob:')) return value;
  return displayPhotoUrl(value);
}
