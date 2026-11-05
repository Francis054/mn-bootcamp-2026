import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { parseMailbox } from '../../src/modules/mail/address.js';
import { MailerSendMail } from '../../src/modules/mail/mailersend-mail.js';
import { OutboxMail } from '../../src/modules/mail/outbox-mail.js';
import { MemoryOutboxStore } from '../../src/modules/mail/outbox-store.js';

const TOKEN = 'mls_unit_token_value';

interface Captured {
  url: string;
  authorization: string;
  contentType: string;
  body: Record<string, unknown>;
}

function captureFetch(
  status: number,
  payload = '',
): { fetchImpl: typeof fetch; calls: Captured[] } {
  const calls: Captured[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const headers = new Headers(init?.headers);
    calls.push({
      url,
      authorization: headers.get('authorization') ?? '',
      contentType: headers.get('content-type') ?? '',
      body: JSON.parse(typeof init?.body === 'string' ? init.body : '') as Record<string, unknown>,
    });
    const body = status === 204 ? null : payload;
    return Promise.resolve(new Response(body, { status }));
  };
  return { fetchImpl, calls };
}

const message = {
  to: 'ada@example.test',
  subject: 'Confirm your Maxim Nyansa trainee account',
  text: 'Plain body',
  html: '<p>HTML body</p>',
  replyTo: 'employer@example.test',
};

describe('MailerSend address and request mapping', () => {
  it('reads a bare mailbox and a named mailbox', () => {
    expect(parseMailbox('desk@example.test')).toEqual({ email: 'desk@example.test' });
    expect(parseMailbox('Desk <desk@example.test>')).toEqual({
      email: 'desk@example.test',
      name: 'Desk',
    });
    expect(parseMailbox('"Maxim Nyansa" <hello@trial.example>')).toEqual({
      email: 'hello@trial.example',
      name: 'Maxim Nyansa',
    });
    expect(parseMailbox('not a mailbox')).toBeUndefined();
    expect(parseMailbox('Desk <not-a-mailbox>')).toBeUndefined();
  });

  it('posts one recipient, subject, text, html, and reply-to over HTTPS', async () => {
    const { fetchImpl, calls } = captureFetch(202);
    const mail = new MailerSendMail({
      apiKey: TOKEN,
      from: 'Bootcamp <hello@trial.example>',
      fetchImpl,
    });
    await expect(mail.send(message)).resolves.toEqual({ delivered: true });
    expect(calls[0]?.url).toBe('https://api.mailersend.com/v1/email');
    expect(calls[0]?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(calls[0]?.contentType).toBe('application/json');
    expect(calls[0]?.body).toEqual({
      from: { email: 'hello@trial.example', name: 'Bootcamp' },
      to: [{ email: 'ada@example.test' }],
      subject: 'Confirm your Maxim Nyansa trainee account',
      text: 'Plain body',
      html: '<p>HTML body</p>',
      reply_to: { email: 'employer@example.test' },
    });
  });

  it('sends a bare from address and a named reply-to, and omits empty parts', async () => {
    const { fetchImpl, calls } = captureFetch(202);
    const mail = new MailerSendMail({
      apiKey: TOKEN,
      from: 'desk@example.test',
      fetchImpl,
    });
    await mail.send({
      to: 'ada@example.test',
      subject: 'Hello',
      text: 'Body',
      replyTo: 'Employer <employer@example.test>',
    });
    expect(calls[0]?.body).toEqual({
      from: { email: 'desk@example.test' },
      to: [{ email: 'ada@example.test' }],
      subject: 'Hello',
      text: 'Body',
      reply_to: { email: 'employer@example.test', name: 'Employer' },
    });
    expect(calls[0]?.body).not.toHaveProperty('html');
  });

  it('treats an empty 202 and any other 2xx body as accepted', async () => {
    for (const status of [200, 201, 202, 204]) {
      const { fetchImpl } = captureFetch(status, status === 200 ? '{"unexpected":true}' : '');
      const mail = new MailerSendMail({ apiKey: TOKEN, from: 'desk@example.test', fetchImpl });
      await expect(
        mail.send({ to: 'ada@example.test', subject: 'Hello', text: 'Body' }),
      ).resolves.toEqual({ delivered: true });
    }
    const warning = captureFetch(
      202,
      JSON.stringify({
        message: 'There are some warnings for your request.',
        warnings: [
          { type: 'SOME_SUPPRESSED', warning: 'Some of the recipients have been suppressed.' },
        ],
      }),
    );
    const paused = new MailerSendMail({
      apiKey: TOKEN,
      from: 'desk@example.test',
      fetchImpl: warning.fetchImpl,
    });
    await expect(
      paused.send({ to: 'ada@example.test', subject: 'Hello', text: 'Body' }),
    ).resolves.toEqual({ delivered: true });
    const odd = captureFetch(202, 'not-json');
    const oddMail = new MailerSendMail({
      apiKey: TOKEN,
      from: 'desk@example.test',
      fetchImpl: odd.fetchImpl,
    });
    await expect(
      oddMail.send({ to: 'ada@example.test', subject: 'Hello', text: 'Body' }),
    ).resolves.toEqual({ delivered: true });
  });

  it('refuses a non-2xx or an all-suppressed 202 without repeating the body or the token', async () => {
    const refused = captureFetch(422, `provider-body-with-${TOKEN} ada@example.test`);
    const mail = new MailerSendMail({
      apiKey: TOKEN,
      from: 'desk@example.test',
      fetchImpl: refused.fetchImpl,
    });
    let messageText = '';
    try {
      await mail.send(message);
    } catch (error) {
      messageText = error instanceof Error ? error.message : '';
    }
    expect(messageText).toBe('The mail provider refused the message.');
    expect(messageText).not.toContain(TOKEN);
    expect(messageText).not.toContain('ada@example.test');
    expect(messageText).not.toContain('provider-body');

    const suppressed = captureFetch(
      202,
      JSON.stringify({
        warnings: [
          {
            type: 'ALL_SUPPRESSED',
            recipients: [{ email: 'ada@example.test' }],
          },
        ],
      }),
    );
    const held = new MailerSendMail({
      apiKey: TOKEN,
      from: 'desk@example.test',
      fetchImpl: suppressed.fetchImpl,
    });
    await expect(held.send(message)).rejects.toThrow('The mail provider refused the message.');
  });

  it('does not call MailerSend when reply-to is not a mailbox', async () => {
    let called = false;
    const fetchImpl: typeof fetch = () => {
      called = true;
      return Promise.resolve(new Response('', { status: 202 }));
    };
    const mail = new MailerSendMail({ apiKey: TOKEN, from: 'desk@example.test', fetchImpl });
    await expect(
      mail.send({
        to: 'ada@example.test',
        subject: 'Hello',
        text: 'Body',
        replyTo: 'not a mailbox',
      }),
    ).rejects.toThrow('The mail provider refused the message.');
    expect(called).toBe(false);
  });

  it('turns a timeout or a network failure into a safe error', async () => {
    const hung: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error('missing timeout'));
          return;
        }
        signal.addEventListener('abort', () => {
          const reason: unknown = signal.reason;
          if (reason instanceof Error) {
            reject(reason);
            return;
          }
          const error = new Error('The operation was aborted due to timeout');
          error.name = 'TimeoutError';
          reject(error);
        });
      });
    const slow = new MailerSendMail({
      apiKey: TOKEN,
      from: 'desk@example.test',
      fetchImpl: hung,
      timeoutMs: 20,
    });
    await expect(
      slow.send({ to: 'ada@example.test', subject: 'Hello', text: 'Body' }),
    ).rejects.toThrow('The mail provider did not respond in time.');

    const down: typeof fetch = () => Promise.reject(new Error('network down'));
    const offline = new MailerSendMail({
      apiKey: TOKEN,
      from: 'desk@example.test',
      fetchImpl: down,
    });
    await expect(
      offline.send({ to: 'ada@example.test', subject: 'Hello', text: 'Body' }),
    ).rejects.toThrow('network down');

    const leaked: typeof fetch = () => Promise.reject(new Error(`connect failed bearer ${TOKEN}`));
    const unsafe = new MailerSendMail({
      apiKey: TOKEN,
      from: 'desk@example.test',
      fetchImpl: leaked,
    });
    let secretMessage = '';
    try {
      await unsafe.send({ to: 'ada@example.test', subject: 'Hello', text: 'Body' });
    } catch (error) {
      secretMessage = error instanceof Error ? error.message : '';
    }
    expect(secretMessage).toBe('The mail provider refused the message.');
    expect(secretMessage).not.toContain(TOKEN);
    expect(secretMessage).not.toContain('bearer');
  });

  it('retries a network failure with backoff and does not store the token', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = () => {
      calls += 1;
      if (calls === 1) return Promise.reject(new Error(`network down bearer ${TOKEN}`));
      return Promise.resolve(new Response('', { status: 202 }));
    };
    const provider = new MailerSendMail({
      apiKey: TOKEN,
      from: 'Desk <desk@example.test>',
      fetchImpl,
    });
    const store = new MemoryOutboxStore();
    let clock = new Date('2026-11-05T00:00:00.000Z');
    const outbox = new OutboxMail(provider, store, pino({ level: 'silent' }), () => clock);
    await expect(
      outbox.send({
        to: 'ada@example.test',
        subject: 'Hello',
        text: 'Body',
        html: '<p>Body</p>',
      }),
    ).resolves.toEqual({ delivered: false });
    const [row] = await store.listAttention(new Date(0));
    expect(row?.lastError).toBe('The mail provider refused the message.');
    expect(row?.lastError).not.toContain(TOKEN);
    expect(row?.nextAttemptAt).toBeTruthy();
    clock = new Date(Date.parse(row?.nextAttemptAt ?? '') - 1);
    expect(await outbox.processDue()).toBe(0);
    expect(calls).toBe(1);
    clock = new Date(Date.parse(row?.nextAttemptAt ?? '') + 1);
    expect(await outbox.processDue()).toBe(1);
    expect(calls).toBe(2);
  });
});
