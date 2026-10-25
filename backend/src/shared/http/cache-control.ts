import type { RequestHandler, Response } from 'express';

/** Short fresh window, then eight minutes where a browser may reuse a stale public response. */
export const PUBLIC_GET_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=480';

export const PRIVATE_CACHE_CONTROL = 'no-store';

/**
 * Public page reads share an address at a bootcamp. This ceiling is separate from
 * sign-in and writes so a classroom refresh cannot lock those out.
 */
export const PUBLIC_GET_RATE_LIMIT_MAX = 5_000;

export function isPublicGetPath(method: string, path: string): boolean {
  return method === 'GET' && (path === '/api/v1/public' || path.startsWith('/api/v1/public/'));
}

export function isPrivateApiPath(path: string): boolean {
  return (
    path === '/api/v1/auth' ||
    path.startsWith('/api/v1/auth/') ||
    path === '/api/v1/admin' ||
    path.startsWith('/api/v1/admin/')
  );
}

export function isPublicWritePath(method: string, path: string): boolean {
  return method !== 'GET' && method !== 'HEAD' && (path === '/api/v1/public' || path.startsWith('/api/v1/public/'));
}

/**
 * Public GET successes can be reused briefly. Admin, sign-in, public writes, and
 * public errors must not be stored. ETag handling stays on Express itself.
 */
export function cacheControlHeaders(): RequestHandler {
  return (req, res, next) => {
    if (isPrivateApiPath(req.path) || isPublicWritePath(req.method, req.path)) {
      res.setHeader('Cache-Control', PRIVATE_CACHE_CONTROL);
      next();
      return;
    }
    if (isPublicGetPath(req.method, req.path)) {
      wrapPublicJson(res);
    }
    next();
  };
}

function wrapPublicJson(res: Response): void {
  const sendJson = res.json.bind(res);
  res.json = (body) => {
    const status = res.statusCode;
    res.setHeader(
      'Cache-Control',
      status >= 200 && status < 300 ? PUBLIC_GET_CACHE_CONTROL : PRIVATE_CACHE_CONTROL,
    );
    return sendJson(body);
  };
}
