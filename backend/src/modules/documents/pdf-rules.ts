import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';

/** A CV is one PDF, at most 5 MB and 10 pages. */
export const CV_MAX_BYTES = 5 * 1024 * 1024;
export const CV_MAX_PAGES = 10;

const MAGIC = Buffer.from('%PDF-');

/**
 * PDF name tokens that can run code, launch a program, or hide another file.
 * The check looks at the file bytes. A longer name such as `/JSON` is not `/JS`.
 */
const FORBIDDEN: readonly { label: string; pattern: RegExp }[] = [
  { label: '/JavaScript', pattern: /\/JavaScript(?![A-Za-z0-9])/ },
  { label: '/JS', pattern: /\/JS(?![A-Za-z0-9])/ },
  { label: '/Launch', pattern: /\/Launch(?![A-Za-z0-9])/ },
  { label: '/OpenAction', pattern: /\/OpenAction(?![A-Za-z0-9])/ },
  { label: '/EmbeddedFile', pattern: /\/EmbeddedFile(?![A-Za-z0-9])/ },
  { label: '/AA', pattern: /\/AA(?![A-Za-z0-9])/ },
];

export class CvFileError extends Error {
  constructor(readonly fieldMessage: string) {
    super(fieldMessage);
    this.name = 'CvFileError';
  }
}

export interface InspectedCv {
  sha256: string;
  pageCount: number;
}

/** Check size, the `%PDF-` header, active-content tokens, and the page count. */
export async function inspectCv(bytes: Buffer): Promise<InspectedCv> {
  if (bytes.length === 0) throw new CvFileError('Choose a PDF file.');
  if (bytes.length > CV_MAX_BYTES) throw new CvFileError('A CV must be 5 MB or smaller.');
  if (!bytes.subarray(0, MAGIC.length).equals(MAGIC)) throw new CvFileError('Choose a PDF file.');
  const text = bytes.toString('latin1');
  if (FORBIDDEN.some((token) => token.pattern.test(text))) {
    throw new CvFileError('This PDF is not allowed because it contains active content.');
  }
  const pageCount = await countPages(bytes);
  if (pageCount > CV_MAX_PAGES) throw new CvFileError('A CV can be at most 10 pages.');
  return { sha256: createHash('sha256').update(bytes).digest('hex'), pageCount };
}

async function countPages(bytes: Buffer): Promise<number> {
  try {
    const document = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      updateMetadata: false,
    });
    const pageCount = document.getPageCount();
    if (pageCount < 1) throw new CvFileError('This file is not a readable PDF.');
    return pageCount;
  } catch (error) {
    if (error instanceof CvFileError) throw error;
    throw new CvFileError('This file is not a readable PDF.');
  }
}
