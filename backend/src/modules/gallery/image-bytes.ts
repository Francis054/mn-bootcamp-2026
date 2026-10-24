const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageMime = (typeof IMAGE_MIMES)[number];

export interface ImageInfo {
  mime: ImageMime;
  width: number;
  height: number;
}

/** Identify a JPEG, PNG, or WebP from the bytes. The file name is not consulted. */
export function readImage(bytes: Buffer): ImageInfo | undefined {
  const png = readPng(bytes);
  if (png) return png;
  const jpeg = readJpeg(bytes);
  if (jpeg) return jpeg;
  return readWebp(bytes);
}

function readPng(bytes: Buffer): ImageInfo | undefined {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG)) return undefined;
  if (bytes.toString('ascii', 12, 16) !== 'IHDR') return undefined;
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (!fits(width, height)) return undefined;
  return { mime: 'image/png', width, height };
}

function readJpeg(bytes: Buffer): ImageInfo | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff)
    return undefined;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) return undefined;
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xd9 || marker === 0xda) return undefined;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) return undefined;
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      if (length < 7) return undefined;
      const height = bytes.readUInt16BE(offset + 5);
      const width = bytes.readUInt16BE(offset + 7);
      if (!fits(width, height)) return undefined;
      return { mime: 'image/jpeg', width, height };
    }
    offset += 2 + length;
  }
  return undefined;
}

function readWebp(bytes: Buffer): ImageInfo | undefined {
  if (bytes.length < 30) return undefined;
  if (bytes.toString('ascii', 0, 4) !== 'RIFF') return undefined;
  if (bytes.toString('ascii', 8, 12) !== 'WEBP') return undefined;
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    const width = 1 + bytes.readUIntLE(24, 3);
    const height = 1 + bytes.readUIntLE(27, 3);
    if (!fits(width, height)) return undefined;
    return { mime: 'image/webp', width, height };
  }
  if (chunk === 'VP8L') {
    if (bytes[20] !== 0x2f) return undefined;
    const first = bytes[21] ?? 0;
    const second = bytes[22] ?? 0;
    const third = bytes[23] ?? 0;
    const fourth = bytes[24] ?? 0;
    const width = 1 + (((second & 0x3f) << 8) | first);
    const height = 1 + (((fourth & 0x0f) << 10) | (third << 2) | ((second & 0xc0) >> 6));
    if (!fits(width, height)) return undefined;
    return { mime: 'image/webp', width, height };
  }
  return undefined;
}

function fits(width: number, height: number): boolean {
  return width >= 1 && height >= 1 && width <= 20_000 && height <= 20_000;
}
