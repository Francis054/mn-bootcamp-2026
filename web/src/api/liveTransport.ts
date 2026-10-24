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
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let onUnauthorized: (() => void) | null = null;

/** Called when a signed-in request comes back 401. Login and reset keep their own errors. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

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

/** Login, reset, and the anonymous session probe must not bounce the visitor to the admin login. */
export function skipsSessionExpiry(path: string): boolean {
  return path.includes('/auth/login') || path.includes('/auth/password-reset/') || path.includes('/auth/session');
}

export function buildApiUrl(path: string, query?: ApiRequest['query']): string {
  const base = path.startsWith('/') ? path : `/${path}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === '') continue;
    if (typeof value === 'object') {
      for (const [inner, innerValue] of Object.entries(value)) {
        if (innerValue) params.set(`${key}.${inner}`, innerValue);
      }
    } else {
      params.set(key, String(value));
    }
  }
  const search = params.toString();
  return search ? `${base}?${search}` : base;
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
  void env;
  const url = buildApiUrl(req.path, req.query);
  const form = typeof FormData !== 'undefined' && req.body instanceof FormData;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (req.body !== undefined && !form) headers['Content-Type'] = 'application/json';
  if (UNSAFE.has(req.method)) {
    const csrf = readCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }
  let body: BodyInit | undefined;
  if (typeof FormData !== 'undefined' && req.body instanceof FormData) body = req.body;
  else if (req.body !== undefined) body = JSON.stringify(req.body);
  const response = await fetchImpl(url, {
    method: req.method,
    headers,
    body,
    credentials: 'include',
  });
  if (response.status === 401 && !skipsSessionExpiry(req.path)) onUnauthorized?.();
  return parseApiResponse<T>(response);
}
