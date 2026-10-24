import type { Response } from 'express';
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  type CookiePolicy,
} from '../../shared/http/cookies.js';

export function readCookie(cookies: unknown, name: string): string | undefined {
  if (typeof cookies !== 'object' || cookies === null || !(name in cookies)) return undefined;
  const value = (cookies as Record<string, unknown>)[name];
  return typeof value === 'string' && value.length > 0 && value.length <= 200 ? value : undefined;
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...cookiePolicy(res, 'session'),
    maxAge: res.app.locals.sessionAbsoluteTtlMs,
  });
}

export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(CSRF_COOKIE_NAME, token, {
    ...cookiePolicy(res, 'csrf'),
    maxAge: res.app.locals.sessionAbsoluteTtlMs,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, cookiePolicy(res, 'session'));
  res.clearCookie(CSRF_COOKIE_NAME, cookiePolicy(res, 'csrf'));
}

function cookiePolicy(res: Response, kind: 'session' | 'csrf'): CookiePolicy {
  return res.app.locals.cookiePolicy[kind];
}
