import { PDFDocument } from 'pdf-lib';
import express from 'express';
import request from 'supertest';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../src/shared/errors/error-handler.js';
import {
  attachmentDisposition,
  cvRequestAllowed,
  HIDDEN_CV,
} from '../../src/modules/documents/cv-rules.js';
import { readCvLink, signCvLink } from '../../src/modules/documents/cv-link.js';
import { cvRateLimit } from '../../src/modules/documents/cv-rate-limit.js';
import { CV_MAX_BYTES, CV_MAX_PAGES, inspectCv } from '../../src/modules/documents/pdf-rules.js';
import { createDocumentStorage } from '../../src/modules/documents/create-document-storage.js';
import { MemoryDocumentStorage } from '../../src/modules/documents/memory-document-storage.js';
import { SupabaseDocumentStorage } from '../../src/modules/documents/supabase-document-storage.js';
import { UnconfiguredDocumentStorage } from '../../src/modules/documents/unconfigured-document-storage.js';
import { testEnv } from '../support/app-env.js';

const SECRET = 'test-session-secret-at-least-32-chars';

describe('CV PDF checks', () => {
  it('accepts a normal one-page PDF and stores a SHA-256', async () => {
    const bytes = await pdfPages(1);
    const checked = await inspectCv(bytes);
    expect(checked.pageCount).toBe(1);
    expect(checked.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a file that does not start with the PDF magic bytes', async () => {
    const bytes = Buffer.from('not a pdf, even if it says %PDF- later');
    await expect(inspectCv(bytes)).rejects.toThrow('Choose a PDF file.');
  });

  it('rejects a PDF larger than 5 MB', async () => {
    const bytes = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(CV_MAX_BYTES)]);
    await expect(inspectCv(bytes)).rejects.toThrow('A CV must be 5 MB or smaller.');
  });

  it('rejects a PDF with more than 10 pages', async () => {
    const bytes = await pdfPages(CV_MAX_PAGES + 1);
    await expect(inspectCv(bytes)).rejects.toThrow('A CV can be at most 10 pages.');
  });

  it('rejects a PDF with embedded JavaScript', async () => {
    const bytes = Buffer.concat([await pdfPages(1), Buffer.from('\n/JavaScript (alert)\n')]);
    await expect(inspectCv(bytes)).rejects.toThrow('active content');
  });

  it('rejects the other active PDF tokens', async () => {
    const base = await pdfPages(1);
    for (const token of ['/JS', '/Launch', '/OpenAction', '/EmbeddedFile', '/AA']) {
      const bytes = Buffer.concat([base, Buffer.from(`\n${token} <<>>\n`)]);
      await expect(inspectCv(bytes)).rejects.toThrow('active content');
    }
  });
});

describe('CV download links', () => {
  it('expires a signed link and ignores a bad signature', () => {
    const fresh = signCvLink({
      secret: SECRET,
      documentId: '11111111-1111-4111-8111-111111111111',
      nowMs: 1_000,
      ttlMs: 300_000,
    });
    expect(readCvLink(fresh, SECRET, 1_000)?.expired).toBe(false);
    expect(readCvLink(fresh, SECRET, 301_000)?.expired).toBe(true);
    expect(readCvLink(`${fresh}x`, SECRET, 1_000)).toBeNull();
    expect(attachmentDisposition('report.pdf')).toBe('attachment; filename="report.pdf"');
    expect(attachmentDisposition('ignore"\r\ninject')).not.toContain('inline');
    expect(cvRequestAllowed({ available: true, mode: 'on_request' })).toBe(true);
    expect(cvRequestAllowed({ available: true, mode: 'public' })).toBe(false);
    expect(cvRequestAllowed(HIDDEN_CV)).toBe(false);
  });
});

describe('CV rate limit', () => {
  it('stops the third upload inside the window', async () => {
    const app = express();
    app.post(
      '/cv',
      cvRateLimit({ windowMs: 60_000, max: 2, message: 'Too many CV uploads. Try again later.' }),
      (_req, res) => {
        res.status(201).json({ ok: true });
      },
    );
    app.use(errorHandler(pino({ level: 'silent' }), testEnv()));
    await request(app).post('/cv').expect(201);
    await request(app).post('/cv').expect(201);
    const blocked = await request(app).post('/cv').expect(429);
    expect(blocked.body).toMatchObject({
      error: { code: 'rate_limited', message: 'Too many CV uploads. Try again later.' },
    });
  });
});

describe('CV storage providers', () => {
  it('uses memory unless Supabase is configured, and refuses in production without it', async () => {
    expect(createDocumentStorage(testEnv())).toBeInstanceOf(MemoryDocumentStorage);
    expect(createDocumentStorage(testEnv({ nodeEnv: 'production' }))).toBeInstanceOf(
      UnconfiguredDocumentStorage,
    );
    const configured = createDocumentStorage(
      testEnv({
        supabaseUrl: 'https://example.supabase.co',
        supabaseServiceRoleKey: 'service-role-key-value',
      }),
    );
    expect(configured).toBeInstanceOf(SupabaseDocumentStorage);
    await expect(
      new UnconfiguredDocumentStorage().put({
        bytes: Buffer.from('%PDF-'),
        contentType: 'application/pdf',
      }),
    ).rejects.toThrow('CV storage is not configured.');
  });

  it('writes to the private Supabase object path and never a public URL', async () => {
    const calls: string[] = [];
    const storage = new SupabaseDocumentStorage({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role-key-value',
      bucket: 'trainee-cvs',
      fetch: (input, init) => {
        const url = requestUrl(input);
        calls.push(`${init?.method ?? 'GET'} ${url}`);
        expect(url).not.toContain('service-role-key-value');
        expect(url).not.toContain('/object/public/');
        const headers = new Headers(init?.headers);
        expect(headers.get('authorization')).toBe('Bearer service-role-key-value');
        if (init?.method === 'POST') return Promise.resolve(new Response('{}', { status: 200 }));
        if (init?.method === 'DELETE') return Promise.resolve(new Response(null, { status: 200 }));
        return Promise.resolve(new Response(Buffer.from('%PDF-1.7'), { status: 200 }));
      },
    });
    const stored = await storage.put({
      bytes: Buffer.from('%PDF-1.7'),
      contentType: 'application/pdf',
    });
    expect(stored.key.endsWith('.pdf')).toBe(true);
    expect(Object.keys(stored)).toEqual(['key']);
    const read = await storage.read(stored.key);
    expect(read.subarray(0, 5).toString()).toBe('%PDF-');
    await storage.delete(stored.key);
    expect(calls.every((call) => call.includes('/storage/v1/object/trainee-cvs/'))).toBe(true);
  });
});

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (typeof input === 'object' && 'url' in input) {
    const url: unknown = input.url;
    if (typeof url === 'string') return url;
  }
  return '';
}

async function pdfPages(count: number): Promise<Buffer> {
  const document = await PDFDocument.create();
  for (let index = 0; index < count; index += 1) document.addPage();
  return Buffer.from(await document.save());
}
