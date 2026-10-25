import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import {
  PUBLIC_CACHE_FRESH_MS,
  clearPublicCache,
  isPublicCacheFresh,
  publicRequestUrl,
  readPublicCache,
  setPublicRateLimitRetryMsForTests,
  settlePublicCache,
  writePublicCache,
} from '@/api/publicCache';
import { setEnvForTests } from '@/config/runtime';
import { usePublicContent } from '@/hooks/useContent';

const LIVE = { apiMode: 'live' as const, apiBaseUrl: '', authMode: 'development' as const, sessionTtlMs: 1_800_000 };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function Probe() {
  const site = usePublicContent();
  if (site.loading) return <p>Loading the published site…</p>;
  if (site.error) return <p>{site.error}</p>;
  return <h1>{site.homepage?.headline ?? 'missing'}</h1>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('public page cache', () => {
  it('keeps the fresh window in one eight-minute constant', () => {
    expect(PUBLIC_CACHE_FRESH_MS).toBe(8 * 60 * 1000);
    const url = publicRequestUrl('/public/home');
    writePublicCache(url, { headline: 'Saved' }, 1_000);
    expect(isPublicCacheFresh(url, 1_000 + PUBLIC_CACHE_FRESH_MS)).toBe(true);
    expect(isPublicCacheFresh(url, 1_000 + PUBLIC_CACHE_FRESH_MS + 1)).toBe(false);
  });

  it('serves a fresh public page without calling the API', async () => {
    setEnvForTests(LIVE);
    writePublicCache(publicRequestUrl('/public/classes'), [{ id: 'c1' }]);
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);
    await expect(api<Array<{ id: string }>>({ method: 'GET', path: '/public/classes' })).resolves.toEqual([{ id: 'c1' }]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('shows a stale page at once, then replaces it when the API answers', async () => {
    setEnvForTests(LIVE);
    const url = publicRequestUrl('/public/home');
    writePublicCache(url, { headline: 'Saved headline' }, Date.now() - PUBLIC_CACHE_FRESH_MS - 1);
    let release: ((response: Response) => void) | undefined;
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes('/public/home')) return new Promise<Response>((resolve) => { release = resolve; });
      if (path.includes('/public/about')) return Promise.resolve(json({ error: { code: 'not_found', message: 'Content not found.' } }, 404));
      return Promise.resolve(json([]));
    }));
    render(<Probe />);
    expect(screen.getByRole('heading', { name: 'Saved headline' })).toBeInTheDocument();
    expect(screen.queryByText(/could not be loaded/i)).not.toBeInTheDocument();
    release?.(json({ headline: 'Fresh headline' }));
    expect(await screen.findByRole('heading', { name: 'Fresh headline' })).toBeInTheDocument();
    expect(readPublicCache<{ headline: string }>(url)?.data.headline).toBe('Fresh headline');
  });

  it('keeps the saved page when the refresh fails', async () => {
    setEnvForTests(LIVE);
    const url = publicRequestUrl('/public/classes/c1');
    writePublicCache(url, { id: 'c1', title: 'Packets' }, Date.now() - PUBLIC_CACHE_FRESH_MS - 5);
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'server', message: 'Something went wrong.' } }, 500)));
    await expect(api<{ title: string }>({ method: 'GET', path: '/public/classes/c1' })).resolves.toEqual({ id: 'c1', title: 'Packets' });
    await settlePublicCache(url);
    expect(readPublicCache<{ title: string }>(url)?.data.title).toBe('Packets');
  });

  it('does not store errors, 404s, admin reads, or writes', async () => {
    setEnvForTests(LIVE);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (init?.method === 'POST') return json({ ok: true });
      if (path.includes('/public/settings')) return json({ error: { code: 'not_found', message: 'Content not found.' } }, 404);
      if (path.includes('/public/classes')) return json({ error: { code: 'server', message: 'Something went wrong.' } }, 500);
      return json({ ok: true });
    }));
    await expect(api({ method: 'GET', path: '/public/classes' })).rejects.toMatchObject({ status: 500 });
    await expect(api({ method: 'GET', path: '/public/settings' })).rejects.toMatchObject({ status: 404 });
    await api({ method: 'GET', path: '/admin/classes' });
    await api({ method: 'GET', path: '/auth/session' });
    await api({ method: 'POST', path: '/public/enquiries', body: { name: 'Ada' } });
    expect(readPublicCache(publicRequestUrl('/public/classes'))).toBeNull();
    expect(readPublicCache(publicRequestUrl('/public/settings'))).toBeNull();
    expect(readPublicCache(publicRequestUrl('/admin/classes'))).toBeNull();
    expect(readPublicCache(publicRequestUrl('/auth/session'))).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it('stores a successful detail response and shares one request between callers', async () => {
    setEnvForTests(LIVE);
    let calls = 0;
    let release: ((response: Response) => void) | undefined;
    vi.stubGlobal('fetch', vi.fn(() => {
      calls += 1;
      return new Promise<Response>((resolve) => { release = resolve; });
    }));
    const first = api<{ id: string }>({ method: 'GET', path: '/public/events/open-day' });
    const second = api<{ id: string }>({ method: 'GET', path: '/public/events/open-day' });
    expect(calls).toBe(1);
    release?.(json({ id: 'open-day' }));
    await expect(first).resolves.toEqual({ id: 'open-day' });
    await expect(second).resolves.toEqual({ id: 'open-day' });
    expect(readPublicCache(publicRequestUrl('/public/events/open-day'))?.data).toEqual({ id: 'open-day' });
  });

  it('drops the saved public pages after an admin publishes or edits', async () => {
    setEnvForTests(LIVE);
    writePublicCache(publicRequestUrl('/public/home'), { headline: 'Old' });
    writePublicCache(publicRequestUrl('/public/foundation-stats'), []);
    vi.stubGlobal('fetch', vi.fn(async () => json({ ok: true })));
    await api({ method: 'POST', path: '/admin/home/publish' });
    expect(readPublicCache(publicRequestUrl('/public/home'))).toBeNull();
    writePublicCache(publicRequestUrl('/public/home'), { headline: 'Still here' });
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'validation', message: 'Check the form.' } }, 422)));
    await expect(api({ method: 'PUT', path: '/admin/settings', body: { siteName: '' } })).rejects.toMatchObject({ status: 422 });
    expect(readPublicCache<{ headline: string }>(publicRequestUrl('/public/home'))?.data.headline).toBe('Still here');
    clearPublicCache();
    expect(sessionStorage.length).toBe(0);
  });

  it('does not ask again when opening another page inside eight minutes', async () => {
    setEnvForTests(LIVE);
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      calls += 1;
      const path = String(input);
      if (path.includes('/public/home')) return json({ headline: 'Hello' });
      if (path.includes('/public/about')) return json({ error: { code: 'not_found', message: 'Content not found.' } }, 404);
      return json([]);
    }));
    const first = render(<Probe />);
    expect(await screen.findByRole('heading', { name: 'Hello' })).toBeInTheDocument();
    const afterFirst = calls;
    expect(afterFirst).toBe(9);
    first.unmount();
    render(<Probe />);
    expect(await screen.findByRole('heading', { name: 'Hello' })).toBeInTheDocument();
    expect(calls).toBe(afterFirst);
  });

  it('shares one batch when the page is mounted twice', async () => {
    setEnvForTests(LIVE);
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      calls += 1;
      const path = String(input);
      if (path.includes('/public/home')) return json({ headline: 'Hello' });
      if (path.includes('/public/about')) return json({ error: { code: 'not_found', message: 'Content not found.' } }, 404);
      return json([]);
    }));
    render(<StrictMode><Probe /></StrictMode>);
    expect(await screen.findByRole('heading', { name: 'Hello' })).toBeInTheDocument();
    expect(calls).toBe(9);
  });

  it('retries a public read once after too many requests', async () => {
    setEnvForTests(LIVE);
    setPublicRateLimitRetryMsForTests(0);
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1;
      if (calls === 1) return json({ error: { code: 'rate_limited', message: 'Too many requests. Try again later.' } }, 429);
      return json({ headline: 'Back' });
    }));
    await expect(api<{ headline: string }>({ method: 'GET', path: '/public/home' })).resolves.toEqual({ headline: 'Back' });
    expect(calls).toBe(2);
  });

  it('shows the page after one retry when nothing was saved yet', async () => {
    setEnvForTests(LIVE);
    setPublicRateLimitRetryMsForTests(0);
    const seen = new Map<string, number>();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      const count = (seen.get(path) ?? 0) + 1;
      seen.set(path, count);
      if (path.includes('/public/home') && count === 1) {
        return json({ error: { code: 'rate_limited', message: 'Too many requests. Try again later.' } }, 429);
      }
      if (path.includes('/public/home')) return json({ headline: 'Back online' });
      if (path.includes('/public/about')) return json({ error: { code: 'not_found', message: 'Content not found.' } }, 404);
      return json([]);
    }));
    render(<Probe />);
    expect(await screen.findByRole('heading', { name: 'Back online' })).toBeInTheDocument();
    expect(screen.queryByText(/too many requests/i)).not.toBeInTheDocument();
  });

  it('keeps the saved page when the server still says too many requests', async () => {
    setEnvForTests(LIVE);
    setPublicRateLimitRetryMsForTests(0);
    const url = publicRequestUrl('/public/home');
    writePublicCache(url, { headline: 'Saved headline' }, Date.now() - PUBLIC_CACHE_FRESH_MS - 1);
    let homeCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes('/public/home')) {
        homeCalls += 1;
        return json({ error: { code: 'rate_limited', message: 'Too many requests. Try again later.' } }, 429);
      }
      if (path.includes('/public/about')) return json({ error: { code: 'not_found', message: 'Content not found.' } }, 404);
      return json([]);
    }));
    render(<Probe />);
    expect(screen.getByRole('heading', { name: 'Saved headline' })).toBeInTheDocument();
    await waitFor(() => expect(homeCalls).toBe(2));
    await settlePublicCache(url);
    expect(screen.getByRole('heading', { name: 'Saved headline' })).toBeInTheDocument();
    expect(screen.queryByText(/too many requests/i)).not.toBeInTheDocument();
  });

  it('tries twice and then shows the rate-limit message when nothing is saved', async () => {
    setEnvForTests(LIVE);
    setPublicRateLimitRetryMsForTests(0);
    const seen = new Map<string, number>();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      seen.set(path, (seen.get(path) ?? 0) + 1);
      return json({ error: { code: 'rate_limited', message: 'Too many requests. Try again later.' } }, 429);
    }));
    render(<Probe />);
    expect(await screen.findByText('Too many requests. Try again later.')).toBeInTheDocument();
    const homeCalls = [...seen.entries()].filter(([path]) => path.includes('/public/home')).reduce((sum, [, count]) => sum + count, 0);
    expect(homeCalls).toBe(2);
    expect([...seen.values()].reduce((sum, count) => sum + count, 0)).toBe(18);
  });

  it('shows an error only when there is nothing saved to fall back on', async () => {
    setEnvForTests(LIVE);
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'server', message: 'The API is waking up.' } }, 500)));
    render(<Probe />);
    expect(await screen.findByText('The API is waking up.')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
