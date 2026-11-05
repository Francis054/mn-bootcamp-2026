import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { ApiError } from '../../shared/errors/api-error.js';

/** A tighter ceiling than the general API limit. Upload and download do not share a counter. */
export function cvRateLimit(input: {
  windowMs: number;
  max: number;
  message: string;
}): RequestHandler {
  return rateLimit({
    windowMs: input.windowMs,
    limit: input.max,
    max: input.max,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false, xForwardedForHeader: false },
    keyGenerator: (req) => ipKeyGenerator(req.ip && req.ip.length > 0 ? req.ip : 'unknown'),
    handler: (_req, _res, next) => {
      next(new ApiError('rate_limited', input.message));
    },
  });
}
