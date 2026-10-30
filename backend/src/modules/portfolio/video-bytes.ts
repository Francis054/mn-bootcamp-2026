export const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
export type VideoMime = (typeof VIDEO_MIME_TYPES)[number];

const VIDEO_MAX_DEFAULT = 50 * 1024 * 1024;
const VIDEO_MAX_CEILING = 200 * 1024 * 1024;

const MP4_BRANDS = new Set([
  'isom',
  'iso2',
  'iso4',
  'iso5',
  'iso6',
  'mp41',
  'mp42',
  'avc1',
  'avc3',
  'dash',
  'mp4v',
  'M4V ',
  'M4VH',
  'F4V ',
  'f4v ',
]);

export const VIDEO_TYPE_MESSAGE = 'Use an MP4, WebM, or MOV video.';

export function videoSizeMessage(maxBytes: number): string {
  const megabytes = maxBytes / (1024 * 1024);
  if (Number.isInteger(megabytes) && megabytes >= 1) return `Use a video of at most ${megabytes} MB.`;
  return `Use a video of at most ${maxBytes} bytes.`;
}

export function defaultVideoMaxBytes(): number {
  return VIDEO_MAX_DEFAULT;
}

export function videoMaxCeiling(): number {
  return VIDEO_MAX_CEILING;
}

/** The browser's type label. The file bytes are checked separately. */
export function videoMimeProblem(mime: string): string | undefined {
  const normalized = mime.trim().toLowerCase();
  if ((VIDEO_MIME_TYPES as readonly string[]).includes(normalized)) return undefined;
  return VIDEO_TYPE_MESSAGE;
}

export function videoByteProblem(bytes: number, maxBytes: number): string | undefined {
  if (!Number.isSafeInteger(bytes) || bytes < 1) return 'Choose a video file.';
  if (bytes > maxBytes) return videoSizeMessage(maxBytes);
  return undefined;
}

/**
 * Identify MP4, WebM, or MOV from the bytes. The file name and the
 * Content-Type header are not consulted. SVG and other files return nothing.
 */
export function sniffVideo(bytes: Buffer): VideoMime | undefined {
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'video/webm';
  }
  if (bytes.length < 12 || bytes.toString('ascii', 4, 8) !== 'ftyp') return undefined;
  const brand = bytes.toString('ascii', 8, 12);
  if (brand === 'qt  ') return 'video/quicktime';
  if (MP4_BRANDS.has(brand)) return 'video/mp4';
  return undefined;
}

export function cloudinaryFormatFor(mime: VideoMime): 'mp4' | 'webm' | 'mov' {
  if (mime === 'video/webm') return 'webm';
  if (mime === 'video/quicktime') return 'mov';
  return 'mp4';
}

const CLOUDINARY_FORMATS = new Set(['mp4', 'webm', 'mov', 'qt']);

export function acceptedCloudinaryVideoFormat(format: string): boolean {
  return CLOUDINARY_FORMATS.has(format.toLowerCase());
}
