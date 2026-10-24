import type { AppEnv } from '../../config/env.js';

export const SESSION_COOKIE_NAME = 'mn_session';
export const CSRF_COOKIE_NAME = 'mn_csrf';

export interface CookiePolicy {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
}

/**
 * Host-only session cookie. `Domain` is omitted on purpose so the cookie is
 * not shared with subdomains. Path is the API prefix because the browser only
 * needs to send the session to `/api/v1`.
 */
export function sessionCookiePolicy(env: AppEnv): CookiePolicy {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/v1',
  };
}

/**
 * The page script reads this cookie and copies it to `X-CSRF-Token`. It is
 * not HttpOnly, and its path is `/` so a page outside `/api/v1` can see it.
 */
export function csrfCookiePolicy(env: AppEnv): CookiePolicy {
  return {
    httpOnly: false,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
  };
}
