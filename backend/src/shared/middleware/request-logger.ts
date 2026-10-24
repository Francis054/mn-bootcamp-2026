import type { Request, RequestHandler } from 'express';
import type { AppLogger } from '../logging/logger.js';

/**
 * One line per response. The path is taken immediately and the query string
 * is removed, so a future token in the URL is not written to the log. Waiting
 * until the response finishes would also be too late: Express rewrites
 * `req.path` as the request enters a router. The body is not logged either.
 */
export function requestLogger(logger: AppLogger): RequestHandler {
  return (req, res, next) => {
    const started = process.hrtime.bigint();
    const path = pathWithoutQuery(req);
    const method = req.method;
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      logger.info(
        {
          requestId: req.id,
          method,
          path,
          status: res.statusCode,
          durationMs: Math.round(durationMs),
        },
        'Request completed',
      );
    });
    next();
  };
}

function pathWithoutQuery(req: Request): string {
  const withoutQuery = req.originalUrl.split('?')[0] ?? '';
  return withoutQuery === '' ? '/' : withoutQuery;
}
