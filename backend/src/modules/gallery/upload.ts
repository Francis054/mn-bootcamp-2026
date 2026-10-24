import Busboy from 'busboy';
import type { Request } from 'express';
import { ApiError } from '../../shared/errors/api-error.js';

export interface MediaUpload {
  alt: string;
  caption: string;
  album: string;
  bytes: Buffer;
}

/** Read one image and the text fields from a multipart body. No network. */
export function readMediaUpload(
  req: Request,
  maxBytes: number,
  sizeMessage: string,
): Promise<MediaUpload> {
  return new Promise((resolve, reject) => {
    const type = req.header('content-type') ?? '';
    if (!type.includes('multipart/form-data')) {
      reject(
        new ApiError('validation', 'Check the highlighted fields.', { file: 'Choose an image.' }),
      );
      return;
    }
    const fields = new Map<string, string>();
    const chunks: Buffer[] = [];
    let tooBig = false;
    let fileCount = 0;
    let settled = false;
    const fail = (error: ApiError) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const parser = Busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: maxBytes, fields: 8, fieldSize: 5_000 },
    });
    parser.on('field', (name: string, value: string) => {
      if (name === 'alt' || name === 'caption' || name === 'album') fields.set(name, value);
    });
    parser.on('file', (_name, stream) => {
      fileCount += 1;
      if (fileCount > 1) {
        stream.resume();
        return;
      }
      stream.on('data', (chunk: Buffer | string) => {
        if (typeof chunk !== 'string') chunks.push(chunk);
      });
      stream.on('limit', () => {
        tooBig = true;
      });
    });
    parser.on('filesLimit', () => {
      fileCount += 1;
    });
    parser.on('error', () => {
      fail(
        new ApiError('validation', 'Check the highlighted fields.', { file: 'Choose an image.' }),
      );
    });
    parser.on('close', () => {
      if (settled) return;
      if (tooBig) {
        fail(new ApiError('validation', 'Check the highlighted fields.', { file: sizeMessage }));
        return;
      }
      if (fileCount !== 1 || chunks.length === 0) {
        fail(
          new ApiError('validation', 'Check the highlighted fields.', { file: 'Choose an image.' }),
        );
        return;
      }
      settled = true;
      resolve({
        alt: fields.get('alt') ?? '',
        caption: fields.get('caption') ?? '',
        album: fields.get('album') ?? '',
        bytes: Buffer.concat(chunks),
      });
    });
    req.pipe(parser);
  });
}
