import { afterEach, describe, expect, it } from 'vitest';
import { readEnv } from '@/config/env';
import { getSessionSnapshot, markSessionExpired } from '@/dev/session';
import { buildApiUrl, liveTransport, readCsrfToken, setUnauthorizedHandler, skipsSessionExpiry } from '@/api/liveTransport';
import type { AppEnv } from '@/config/env';

const liveEnv: AppEnv = { apiMode: 'live', apiBaseUrl: '', authMode: 'development', sessionTtlMs: 1000 };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  setUnauthorizedHandler(markSessionExpired);
  document.cookie = 'mn_csrf=; Max-Age=0';
  localStorage.clear();
  sessionStorage.clear();
});

describe('live API client', () => {
  it('uses the live API unless the mock flag is exactly true', () => {
    expect(readEnv({}).apiMode).toBe('live');
    expect(readEnv({ VITE_USE_MOCK_API: '' }).apiMode).toBe('live');
    expect(readEnv({ VITE_USE_MOCK_API: 'false' }).apiMode).toBe('live');
    expect(readEnv({ VITE_USE_MOCK_API: 'true' }).apiMode).toBe('development-adapter');
    expect(readEnv({}).apiBaseUrl).toBe('');
  });

  it('calls a relative URL and sends the session cookie', async () => {
    let seen = '';
    let credentials = '';
    const fetchImpl: typeof fetch = async (input, init) => {
      seen = String(input);
      credentials = String(init?.credentials ?? '');
      return jsonResponse(200, { ok: true });
    };
    await liveTransport({ method: 'GET', path: '/api/v1/public/classes', query: { q: 'net', filters: { moduleId: 'network' } } }, liveEnv, fetchImpl);
    expect(seen).toBe('/api/v1/public/classes?q=net&filters.moduleId=network');
    expect(seen.startsWith('/api/v1/')).toBe(true);
    expect(credentials).toBe('include');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('sends the CSRF header from mn_csrf on unsafe methods only', async () => {
    document.cookie = 'mn_csrf=token%2B1';
    expect(readCsrfToken()).toBe('token+1');
    const headers: Array<Record<string, string>> = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      headers.push({ ...(init?.headers as Record<string, string>) });
      return jsonResponse(200, { ok: true });
    };
    await liveTransport({ method: 'GET', path: '/api/v1/auth/session' }, liveEnv, fetchImpl);
    await liveTransport({ method: 'POST', path: '/api/v1/admin/classes', body: { title: 'Week' } }, liveEnv, fetchImpl);
    expect(headers[0]?.['X-CSRF-Token']).toBeUndefined();
    expect(headers[1]?.['X-CSRF-Token']).toBe('token+1');
    expect(headers[1]?.['Content-Type']).toBe('application/json');
    expect(localStorage.getItem('mn_session')).toBeNull();
    expect(sessionStorage.getItem('mn_session')).toBeNull();
  });

  it('posts a file without forcing a JSON content type', async () => {
    const body = new FormData();
    body.set('alt', 'A classroom');
    body.set('file', new Blob(['img'], { type: 'image/png' }), 'room.png');
    let contentType = 'unset';
    let sent: BodyInit | null | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      contentType = String((init?.headers as Record<string, string>)['Content-Type'] ?? '');
      sent = init?.body;
      return jsonResponse(201, { id: 'photo' });
    };
    await liveTransport({ method: 'POST', path: '/api/v1/admin/media', body }, liveEnv, fetchImpl);
    expect(contentType).toBe('');
    expect(sent).toBe(body);
  });

  it('marks the session expired on 401 except for sign-in and reset', async () => {
    const expired: string[] = [];
    setUnauthorizedHandler(() => {
      expired.push('yes');
      markSessionExpired();
    });
    const denied: typeof fetch = async () => jsonResponse(401, { error: { code: 'unauthenticated', message: 'Sign in to continue.' } });
    await expect(liveTransport({ method: 'GET', path: '/api/v1/admin/classes' }, liveEnv, denied)).rejects.toMatchObject({ status: 401 });
    expect(expired).toEqual(['yes']);
    expect(getSessionSnapshot().expired).toBe(true);
    await expect(liveTransport({ method: 'POST', path: '/api/v1/auth/login', body: { email: 'a@example.test', password: 'wrong-pass' } }, liveEnv, denied)).rejects.toMatchObject({ status: 401 });
    await expect(liveTransport({ method: 'POST', path: '/api/v1/auth/password-reset/request', body: { email: 'a@example.test' } }, liveEnv, denied)).rejects.toMatchObject({ status: 401 });
    expect(expired).toEqual(['yes']);
    expect(skipsSessionExpiry('/api/v1/auth/session')).toBe(true);
    expect(buildApiUrl('/api/v1/health')).toBe('/api/v1/health');
  });
});
