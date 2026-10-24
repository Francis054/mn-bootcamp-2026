import { ApiError, type ApiErrorCode } from '@/domain/types';
import { readEnv, type AppEnv } from '@/config/env';

export interface ApiRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  query?: {
    q?: string;
    page?: number | string;
    pageSize?: number | string;
    sort?: string;
    dir?: 'asc' | 'desc';
    filters?: Record<string, string>;
    [key: string]: string | number | Record<string, string> | undefined;
  };
  body?: unknown;
}

const CSRF_COOKIE = 'mn_csrf';

/** Reads a non-HttpOnly CSRF cookie. The session cookie itself must stay HttpOnly and is never read here. */
export function readCsrfToken(cookie = typeof document === 'undefined' ? '' : document.cookie): string {
  const parts = cookie.split(';').map((part) => part.trim());
  const row = parts.find((part) => part.startsWith(`${CSRF_COOKIE}=`));
  return row ? decodeURIComponent(row.slice(CSRF_COOKIE.length + 1)) : '';
}

export function statusToCode(status: number): ApiErrorCode {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 422 || status === 400) return 'validation';
  if (status === 429) return 'rate_limited';
  if (status === 501) return 'pending';
  return 'server';
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as { error?: { code?: ApiErrorCode; message?: string; fieldErrors?: Record<string, string> } }) : {};
  if (!response.ok) {
    const code = payload.error?.code ?? statusToCode(response.status);
    throw new ApiError(code, payload.error?.message ?? (response.statusText || 'Request failed'), response.status, payload.error?.fieldErrors);
  }
  return payload as T;
}

export async function liveTransport<T>(req: ApiRequest, env: AppEnv = readEnv(), fetchImpl: typeof fetch = fetch): Promise<T> {
  if (!env.apiBaseUrl) {
    throw new ApiError('pending', 'No API base URL is configured. The proposed contract is pending implementation — this build does not call a backend.', 501);
  }
  const url = new URL(req.path.replace(/^\//, ''), env.apiBaseUrl.endsWith('/') ? env.apiBaseUrl : `${env.apiBaseUrl}/`);
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (value === undefined || value === '') continue;
    if (typeof value === 'object') {
      for (const [inner, innerValue] of Object.entries(value)) {
        if (innerValue) url.searchParams.set(`${key}.${inner}`, innerValue);
      }
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (req.body !== undefined) headers['Content-Type'] = 'application/json';
  const csrf = readCsrfToken();
  if (csrf) headers['X-CSRF-Token'] = csrf;
  const response = await fetchImpl(url, {
    method: req.method,
    headers,
    body: req.body === undefined ? undefined : JSON.stringify(req.body),
    credentials: 'include',
  });
  return parseApiResponse<T>(response);
}
