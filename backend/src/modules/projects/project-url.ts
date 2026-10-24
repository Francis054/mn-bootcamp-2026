const URL_LENGTH = 500;

/**
 * Optional project link. Blank is allowed. A value must be a public https URL:
 * no other scheme, no embedded password, and no loopback or private host.
 */
export function projectUrlProblem(value: unknown): string | undefined {
  if (typeof value !== 'string') return 'Enter a full link starting with https://.';
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > URL_LENGTH) return 'Use at most 500 characters.';
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return 'Enter a full link starting with https://.';
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
    return 'Enter a full link starting with https://.';
  }
  if (isPrivateHost(url.hostname)) return 'Use a public https address.';
  return undefined;
}

export function isGithubRepositoryUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === 'github.com' || host === 'www.github.com';
  } catch {
    return false;
  }
}

/**
 * Unauthenticated look at a GitHub repository. Any answer other than 200,
 * including a redirect or a network failure, keeps the link off the public page.
 * Demo links are not fetched.
 */
export async function githubRepositoryIsPublic(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!isGithubRepositoryUrl(url)) return true;
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(1500),
    });
    await response.body?.cancel();
    return response.status === 200;
  } catch {
    return false;
  }
}

export interface RepositoryVisibility {
  isPublic(url: string): Promise<boolean>;
}

export function liveRepositoryVisibility(): RepositoryVisibility {
  return { isPublic: (url) => githubRepositoryIsPublic(url) };
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
  const a = parts[0] ?? 0;
  const b = parts[1] ?? 0;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const value = host.toLowerCase();
  if (value === '::' || value === '::1') return true;
  if (value.startsWith('fe80:')) return true;
  if (value.startsWith('fc') || value.startsWith('fd')) return true;
  return false;
}
