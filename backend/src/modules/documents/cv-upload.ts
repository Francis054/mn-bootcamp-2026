import Busboy from 'busboy';
import type { Request } from 'express';
import { ApiError } from '../../shared/errors/api-error.js';
import { CV_MAX_BYTES } from './pdf-rules.js';
import { isCvVisibility, safeCvFileName, type CvVisibility } from './cv-rules.js';

export interface CvUpload {
  bytes: Buffer;
  fileName: string;
  visibility: CvVisibility | null;
}

const SIZE_MESSAGE = 'A CV must be 5 MB or smaller.';

/** Read one PDF from a multipart body. The file name and the part type are not trusted. */
export function readCvUpload(req: Request): Promise<CvUpload> {
  return new Promise((resolve, reject) => {
    const type = req.header('content-type') ?? '';
    if (!type.includes('multipart/form-data')) {
      reject(
        new ApiError('validation', 'Check the highlighted fields.', { file: 'Choose a PDF file.' }),
      );
      return;
    }
    let visibility: CvVisibility | null = null;
    let visibilityError = '';
    const chunks: Buffer[] = [];
    let tooBig = false;
    let fileCount = 0;
    let fileName = 'cv.pdf';
    let settled = false;
    const fail = (error: ApiError) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const parser = Busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: CV_MAX_BYTES, fields: 4, fieldSize: 40 },
    });
    parser.on('field', (name: string, value: string) => {
      if (name !== 'visibility') return;
      const trimmed = value.trim();
      if (!trimmed) return;
      if (!isCvVisibility(trimmed)) {
        visibilityError = 'Choose private, on request, or public.';
        return;
      }
      visibility = trimmed;
    });
    parser.on('file', (_name, stream, info: { filename?: string }) => {
      fileCount += 1;
      fileName = safeCvFileName(info.filename ?? '');
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
        new ApiError('validation', 'Check the highlighted fields.', { file: 'Choose a PDF file.' }),
      );
    });
    parser.on('close', () => {
      if (settled) return;
      if (visibilityError) {
        fail(
          new ApiError('validation', 'Check the highlighted fields.', {
            visibility: visibilityError,
          }),
        );
        return;
      }
      if (tooBig) {
        fail(new ApiError('validation', 'Check the highlighted fields.', { file: SIZE_MESSAGE }));
        return;
      }
      if (fileCount !== 1 || chunks.length === 0) {
        fail(
          new ApiError('validation', 'Check the highlighted fields.', {
            file: 'Choose a PDF file.',
          }),
        );
        return;
      }
      settled = true;
      resolve({ bytes: Buffer.concat(chunks), fileName, visibility });
    });
    req.pipe(parser);
  });
}
