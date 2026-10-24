/**
 * One GET of the public health URL, so a free Render web service receives
 * inbound traffic. Render spins a free web service down after 15 minutes
 * without any. This file has no dependencies and runs on Node 22.
 *
 * KEEPALIVE_URL is the full health address, for example
 * https://YOUR-SITE.onrender.com/api/v1/health. It is a public URL.
 * Do not put a password, a token, or a username in it.
 *
 * The log line is the origin, the path, the HTTP status, and how long the
 * request took. The query string and any userinfo are never printed.
 * If KEEPALIVE_URL is unset, this prints a short message and exits 0.
 *
 * KEEPALIVE_DRY_RUN=1 prints the address that would be requested and exits
 * without calling the network.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ATTEMPTS = 3;
const TIMEOUT_MS = 60_000;
const PAUSE_MS = 5_000;

/**
 * @param {string | undefined} value
 */
export function interpretKeepAliveUrl(value) {
  if (value === undefined || value.trim() === '') {
    return {
      ok: false,
      skip: true,
      message:
        'KEEPALIVE_URL is not set. Skipping keep-alive. After the site is deployed, set the GitHub Actions variable KEEPALIVE_URL to the full health URL, for example https://YOUR-SITE.onrender.com/api/v1/health.',
    };
  }
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return {
      ok: false,
      skip: false,
      message: 'KEEPALIVE_URL is not a valid URL. The value was not logged.',
    };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return {
      ok: false,
      skip: false,
      message: 'KEEPALIVE_URL must start with http:// or https://. The value was not logged.',
    };
  }
  if (url.username !== '' || url.password !== '') {
    return {
      ok: false,
      skip: false,
      message: 'KEEPALIVE_URL must not include a username or password. The value was not logged.',
    };
  }
  return { ok: true, href: url.href, label: `${url.origin}${url.pathname}` };
}

/**
 * @param {string} href
 */
async function requestOnce(href) {
  const started = Date.now();
  try {
    const response = await fetch(href, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': 'mn-bootcamp-keepalive' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await response.body?.cancel().catch(() => undefined);
    const ms = Date.now() - started;
    if (response.status >= 200 && response.status < 300) {
      return { ok: true, status: response.status, ms };
    }
    return { ok: false, ms, reason: `HTTP ${response.status}` };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    const timedOut = name === 'TimeoutError' || name === 'AbortError';
    return {
      ok: false,
      ms: Date.now() - started,
      reason: timedOut ? 'timed out' : 'request failed',
    };
  }
}

/**
 * @param {number} ms
 */
function pause(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  const plan = interpretKeepAliveUrl(process.env.KEEPALIVE_URL);
  if (!plan.ok && plan.skip) {
    console.log(plan.message);
    return 0;
  }
  if (!plan.ok) {
    console.error(plan.message);
    return 1;
  }
  if (process.env.KEEPALIVE_DRY_RUN === '1') {
    console.log(`keep-alive: would request ${plan.label}`);
    return 0;
  }
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const result = await requestOnce(plan.href);
    const detail = result.ok
      ? `${plan.label} -> ${result.status} in ${result.ms}ms`
      : `${plan.label} failed after ${result.ms}ms (${result.reason})`;
    console.log(`keep-alive: ${detail} (attempt ${attempt} of ${ATTEMPTS})`);
    if (result.ok) return 0;
    if (attempt < ATTEMPTS) await pause(PAUSE_MS);
  }
  console.error('keep-alive: no response after all attempts');
  return 1;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isDirectRun()) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch(() => {
      console.error('keep-alive: stopped before a response. The address was not logged.');
      process.exit(1);
    });
}
