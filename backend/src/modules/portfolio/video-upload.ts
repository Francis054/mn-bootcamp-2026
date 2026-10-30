import Busboy from 'busboy';
import type { Request } from 'express';
import { ApiError } from '../../shared/errors/api-error.js';

export interface VideoFileUpload {
  grantId: string;
  bytes: Buffer;
}

/** Read one video and its grant id. The bytes stay in memory only for the memory-storage path. */
export function readVideoFile(
  req: Request,
  maxBytes: number,
  sizeMessage: string,
): Promise<VideoFileUpload> {
  return new Promise((resolve, reject) => {
    const type = req.header('content-type') ?? '';
    if (!type.includes('multipart/form-data')) {
      reject(new ApiError('validation', 'Check the highlighted fields.', { video: 'Choose a video file.' }));
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
      limits: { files: 1, fileSize: maxBytes, fields: 8, fieldSize: 200 },
    });
    parser.on('field', (name: string, value: string) => {
      if (name === 'grantId') fields.set(name, value);
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
        stream.resume();
      });
    });
    parser.on('error', () => {
      fail(new ApiError('validation', 'Check the highlighted fields.', { video: 'Choose a video file.' }));
    });
    parser.on('close', () => {
      if (settled) return;
      if (tooBig) {
        fail(new ApiError('validation', 'Check the highlighted fields.', { video: sizeMessage }));
        return;
      }
      const grantId = fields.get('grantId') ?? '';
      if (!grantId) {
        fail(new ApiError('validation', 'Check the highlighted fields.', { video: 'Start the upload again.' }));
        return;
      }
      if (fileCount !== 1 || chunks.length === 0) {
        fail(new ApiError('validation', 'Check the highlighted fields.', { video: 'Choose a video file.' }));
        return;
      }
      settled = true;
      resolve({ grantId, bytes: Buffer.concat(chunks) });
    });
    req.pipe(parser);
  });
}
