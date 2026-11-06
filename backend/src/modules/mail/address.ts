const MAILBOX = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;
const MAX_MAILBOX = 320;
const MAX_NAME = 200;

export interface Mailbox {
  email: string;
  name?: string;
}

/**
 * `Sender Name <mailbox@domain>` or a bare mailbox.
 * Undefined when the text is neither of those.
 */
export function parseMailbox(value: string): Mailbox | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const named = /^(?:"([^"\r\n]+)"|([^<>"\r\n]+?))\s*<([^<>\s]+)>$/.exec(trimmed);
  if (named) {
    const name = (named[1] ?? named[2] ?? '').trim();
    const email = named[3] ?? '';
    if (!name || name.length > MAX_NAME || !isMailbox(email)) return undefined;
    return { email, name };
  }
  if (!isMailbox(trimmed)) return undefined;
  return { email: trimmed };
}

function isMailbox(value: string): boolean {
  return value.length <= MAX_MAILBOX && MAILBOX.test(value);
}
