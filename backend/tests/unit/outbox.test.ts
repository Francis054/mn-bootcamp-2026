import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import type {
  EmailProvider,
  MailResult,
  OutboundMail,
} from '../../src/modules/mail/email-provider.js';
import { verificationLetter } from '../../src/modules/mail/letters.js';
import { OutboxMail, safeMailError } from '../../src/modules/mail/outbox-mail.js';
import { MemoryOutboxStore, OUTBOX_MAX_ATTEMPTS } from '../../src/modules/mail/outbox-store.js';
import { zipStored } from '../../src/modules/mail/zip-store.js';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

class FlakyMail implements EmailProvider {
  readonly name = 'resend' as const;
  readonly configured = true;
  readonly sent: OutboundMail[] = [];
  calls = 0;

  constructor(
    private readonly failures: number,
    private readonly error = new Error('The mail provider refused the message.'),
  ) {}

  send(message: OutboundMail): Promise<MailResult> {
    this.calls += 1;
    if (this.calls <= this.failures) return Promise.reject(this.error);
    this.sent.push(message);
    return Promise.resolve({ delivered: true });
  }
}

describe('branded email and the outbox', () => {
  it('puts the link in the text and escapes it in the HTML', () => {
    const link = 'https://example.test/verify?token=abc<script>';
    const letter = verificationLetter(link);
    expect(letter.html).toContain('lang="en"');
    expect(letter.html).toContain('#0A1F16');
    expect(letter.html).toContain('#88CC00');
    expect(letter.html).not.toContain('<script>');
    expect(letter.html).toContain('&lt;script&gt;');
    expect(letter.text).toContain(link);
    expect(letter.text).toContain('Confirm email');
  });

  it('retries with backoff and stops at the attempt limit', async () => {
    const inner = new FlakyMail(OUTBOX_MAX_ATTEMPTS);
    const store = new MemoryOutboxStore();
    let clock = new Date('2026-10-30T00:00:00.000Z');
    const mail = new OutboxMail(inner, store, pino({ level: 'silent' }), () => clock);
    const first = await mail.send({
      to: 'trainee@example.test',
      subject: 'Confirm your Maxim Nyansa trainee account',
      text: 'plain',
      html: '<p>html</p>',
      kind: 'verification',
      traineeId: 'trainee-1',
    });
    expect(first.delivered).toBe(false);
    expect(inner.calls).toBe(1);
    for (let attempt = 1; attempt < OUTBOX_MAX_ATTEMPTS; attempt += 1) {
      const [row] = await store.listAttention(new Date(0));
      expect(row?.status).toBe('failed');
      expect(row?.attempts).toBe(attempt);
      expect(row?.lastError).toBe('The mail provider refused the message.');
      expect(row?.nextAttemptAt).toBeTruthy();
      clock = new Date(Date.parse(row?.nextAttemptAt ?? '') - 1);
      expect(await mail.processDue()).toBe(0);
      clock = new Date(Date.parse(row?.nextAttemptAt ?? '') + 1);
      expect(await mail.processDue()).toBe(0);
    }
    expect(inner.calls).toBe(OUTBOX_MAX_ATTEMPTS);
    const stuck = await store.listAttention(new Date(0));
    expect(stuck[0]?.attempts).toBe(OUTBOX_MAX_ATTEMPTS);
    expect(stuck[0]?.nextAttemptAt).toBeNull();
    clock = new Date(clock.getTime() + 86_400_000);
    expect(await mail.processDue()).toBe(0);
    expect(inner.calls).toBe(OUTBOX_MAX_ATTEMPTS);

    const resent = await mail.resend(stuck[0]?.id ?? '');
    expect(resent?.delivered).toBe(true);
    expect(inner.sent).toHaveLength(1);
    expect(inner.sent[0]?.html).toContain('html');
    expect(await mail.resend(stuck[0]?.id ?? '')).toBeNull();
  });

  it('does not keep a provider secret in the last error', async () => {
    const inner = new FlakyMail(1, new Error('Authorization Bearer super-secret-token refused'));
    const store = new MemoryOutboxStore();
    const mail = new OutboxMail(
      inner,
      store,
      pino({ level: 'silent' }),
      () => new Date('2026-10-30T00:00:00.000Z'),
    );
    await mail.send({
      to: 'trainee@example.test',
      subject: 'Hello',
      text: 'Body',
      html: '<p>Body</p>',
    });
    const [row] = await store.listAttention(new Date(0));
    expect(row?.lastError).toBe('The mail provider refused the message.');
    expect(row?.lastError).not.toContain('super-secret');
    expect(safeMailError(new Error('network down'))).toBe('network down');
  });

  it('writes a zip another tool can open', () => {
    const packed = zipStored([
      { name: 'trainee.json', bytes: Buffer.from('{"email":"trainee@example.test"}\n') },
      { name: 'cv.pdf', bytes: Buffer.from('CV-BYTES') },
    ]);
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    const file = join(dir, 'pack.zip');
    writeFileSync(file, packed);
    execFileSync('python3', [
      '-c',
      'import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',
      file,
      dir,
    ]);
    expect(readFileSync(join(dir, 'trainee.json'), 'utf8')).toContain('trainee@example.test');
    expect(readFileSync(join(dir, 'cv.pdf')).toString()).toBe('CV-BYTES');
  });
});
