import Busboy from 'busboy';
import type { Request } from 'express';
import { ApiError } from '../../shared/errors/api-error.js';

const MAX_BYTES = 8 * 1024 * 1024;

/** Read one .xlsx upload. The original file name is not stored. */
export function readWorkbookUpload(req: Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const type = req.header('content-type') ?? '';
    if (!type.includes('multipart/form-data')) {
      reject(new ApiError('validation', 'Upload the workbook as a file.', { file: 'Choose an .xlsx file.' }));
      return;
    }
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
      limits: { files: 1, fileSize: MAX_BYTES, fields: 2 },
    });
    parser.on('file', (_name, file) => {
      fileCount += 1;
      file.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      file.on('limit', () => {
        tooBig = true;
      });
    });
    parser.on('error', () => {
      fail(new ApiError('validation', 'The upload could not be read.', { file: 'Choose an .xlsx file.' }));
    });
    parser.on('finish', () => {
      if (settled) return;
      if (fileCount !== 1) {
        fail(new ApiError('validation', 'Choose one workbook.', { file: 'Choose an .xlsx file.' }));
        return;
      }
      if (tooBig) {
        fail(new ApiError('validation', 'The workbook is larger than 8 MB.', { file: 'The workbook is larger than 8 MB.' }));
        return;
      }
      const buffer = Buffer.concat(chunks);
      if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
        fail(new ApiError('validation', 'The file is not an xlsx workbook.', { file: 'Choose an .xlsx file.' }));
        return;
      }
      settled = true;
      resolve(buffer);
    });
    req.pipe(parser);
  });
}
