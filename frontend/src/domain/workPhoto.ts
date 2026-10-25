import type { PublicWorkPhoto } from './types';

const DATA_IMAGE = /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i;

/** A picture the page may show: Cloudinary, a site file, or a development-adapter data URL. */
export function isDirectWorkPhotoSrc(src: string): boolean {
  return src.startsWith('https://') || src.startsWith('/') || DATA_IMAGE.test(src);
}

/** A displayable address. Local memory photos are read from the API. Other hosts are not used. */
export function workPhotoAddress(photo: Pick<PublicWorkPhoto, 'id' | 'src'>, audience: 'admin' | 'public'): string {
  if (isDirectWorkPhotoSrc(photo.src)) return photo.src;
  if (photo.src.startsWith('memory:')) {
    const root = audience === 'admin' ? '/api/v1/admin/work-photos' : '/api/v1/public/work-photos';
    return `${root}/${encodeURIComponent(photo.id)}/file`;
  }
  return '';
}

/** Reads the chosen file into a data URL for the development adapter. The live API uploads the file instead. */
export function readWorkPhotoDataUrl(file: File): Promise<{ src: string; width: number; height: number }> {
  const mime = workPhotoMime(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The photo could not be read.'));
    reader.onload = () => {
      const raw = typeof reader.result === 'string' ? reader.result : '';
      const payload = raw.slice(raw.indexOf(',') + 1).replace(/\s/g, '');
      if (!mime || !payload) {
        reject(new Error('Use a JPEG, PNG, or WebP image.'));
        return;
      }
      const src = `data:${mime};base64,${payload}`;
      const image = new Image();
      let settled = false;
      const finish = (width: number, height: number) => {
        if (settled) return;
        settled = true;
        resolve({
          src,
          width: width > 0 ? width : 1600,
          height: height > 0 ? height : 1066,
        });
      };
      image.onload = () => finish(image.naturalWidth, image.naturalHeight);
      image.onerror = () => finish(0, 0);
      image.src = src;
      window.setTimeout(() => finish(image.naturalWidth, image.naturalHeight), 40);
    };
    reader.readAsDataURL(file);
  });
}

function workPhotoMime(file: File): string | undefined {
  const type = file.type.toLowerCase();
  if (type === 'image/jpeg' || type === 'image/png' || type === 'image/webp') return type;
  if (/\.jpe?g$/i.test(file.name)) return 'image/jpeg';
  if (/\.png$/i.test(file.name)) return 'image/png';
  if (/\.webp$/i.test(file.name)) return 'image/webp';
  return undefined;
}

export function workPhotoFieldErrors(input: { traineeId: string; alt: string; caption: string; fileCount: number }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.traineeId.trim()) errors.traineeId = 'Choose a trainee.';
  const alt = input.alt.trim();
  if (!alt) errors.alt = 'Describe the image without naming anyone.';
  else if (alt.length > 300) errors.alt = 'Use at most 300 characters.';
  if (input.caption.length > 500) errors.caption = 'Use at most 500 characters.';
  if (input.fileCount < 1) errors.file = 'Choose an image.';
  return errors;
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function workPhotoFileError(file: File): string | undefined {
  const named = /\.(jpe?g|png|webp)$/i.test(file.name);
  const type = file.type.toLowerCase();
  // Some browsers label a WebP file as a generic type. The server still checks the bytes.
  if (type.startsWith('image/') && !IMAGE_TYPES.has(type)) return 'Use a JPEG, PNG, or WebP image.';
  if (!IMAGE_TYPES.has(type) && !named) return 'Use a JPEG, PNG, or WebP image.';
  if (file.size > 10 * 1024 * 1024) return 'Use an image of at most 10 MB.';
  return undefined;
}
