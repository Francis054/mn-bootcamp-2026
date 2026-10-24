import type { RequestHandler } from 'express';
import { ApiError } from '../../shared/errors/api-error.js';
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from '../../shared/http/cookies.js';
import { readCookie } from './cookies.js';
import { tokensMatch } from './tokens.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit check. Safe reads skip it. A sign-in with no session cookie
 * skips it, because the website does not have a token yet. Every other
 * mutation that presents the session cookie must send the same token in
 * `X-CSRF-Token` and in the `mn_csrf` cookie.
 */
export function csrfGuard(): RequestHandler {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }
    const path = req.originalUrl.split('?')[0] ?? '';
    const session = readCookie(req.cookies, SESSION_COOKIE_NAME);
    if (path === '/api/v1/auth/login' && !session) {
      next();
      return;
    }
    if (!session) {
      next();
      return;
    }
    const header = req.header('x-csrf-token');
    const cookie = readCookie(req.cookies, CSRF_COOKIE_NAME);
    if (!tokensMatch(header, cookie)) {
      next(new ApiError('forbidden', 'The security token does not match.'));
      return;
    }
    next();
  };
}
