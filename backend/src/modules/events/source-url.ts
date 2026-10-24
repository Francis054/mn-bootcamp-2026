const URL_LENGTH = 500;
const SOURCE_URL = 'Enter a full link starting with https://';

/** Optional source link. Blank is allowed. A value must be a public https URL. */
export function sourceUrlProblem(value: unknown): string | undefined {
  if (typeof value !== 'string') return SOURCE_URL;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > URL_LENGTH) return 'Use at most 500 characters.';
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return SOURCE_URL;
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') return SOURCE_URL;
  if (isPrivateHost(url.hostname)) return 'Use a public https address.';
  return undefined;
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (!host.includes('.') && !host.includes(':')) return true;
  const mapped = host.startsWith('::ffff:') ? host.slice('::ffff:'.length) : host;
  if (isPrivateIpv4(mapped)) return true;
  if (mapped.includes(':') && isPrivateIpv6(mapped)) return true;
  return false;
}

function isPrivateIpv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const parts = [match[1], match[2], match[3], match[4]].map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part > 255)) return true;
  const first = parts[0] ?? 0;
  const second = parts[1] ?? 0;
  if (first === 0 || first === 10 || first === 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 100 && second >= 64 && second <= 127) return true;
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const value = host.toLowerCase();
  if (value === '::' || value === '::1') return true;
  if (value.startsWith('fe80:')) return true;
  if (value.startsWith('fc') || value.startsWith('fd')) return true;
  return false;
}
