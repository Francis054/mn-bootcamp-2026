import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import helmet from 'helmet';
import type { AppEnv } from '../../config/env.js';
import { cacheControlHeaders } from '../http/cache-control.js';
import { isWriteMethod, readRateLimitMax } from '../http/rate-limit.js';
import { ApiError } from '../errors/api-error.js';

const JSON_BODY_LIMIT = '1mb';

/**
 * Helmet, a single allowed browser origin, rate limits, and a 1 MB JSON cap.
 * Health checks skip the rate limits so a probe cannot lock the API out of its
 * own liveness route. Page reads and the session check use a generous per-visitor
 * ceiling. Sign-in, password reset, and writes keep the stricter one.
 * `req.ip` is the visitor only when the app trusts the proxy hop in front of it.
 */
export function applySecurity(app: Express, env: AppEnv): void {
  app.disable('x-powered-by');
  app.use(
    helmet({
      // Swagger UI at /api/docs needs inline styles and scripts.
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
          'media-src': ["'self'", 'blob:', 'https://res.cloudinary.com'],
          'frame-src': [
            "'self'",
            'https://www.youtube-nocookie.com',
            'https://player.vimeo.com',
            'https://www.loom.com',
          ],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origin === env.frontendUrl) {
          callback(null, true);
          return;
        }
        callback(new ApiError('forbidden', 'This origin is not allowed.'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Accept', 'X-CSRF-Token', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),
  );
  const sharedLimit = {
    windowMs: env.rateLimitWindowMs,
    standardHeaders: true,
    legacyHeaders: false,
    // The visitor address is `req.ip`. Production trusts one proxy hop so that is the visitor, not Render.
    // These switches only silence library warnings. They do not change the address.
    validate: { trustProxy: false, xForwardedForHeader: false },
    keyGenerator: (req: express.Request) => ipKeyGenerator(req.ip && req.ip.length > 0 ? req.ip : 'unknown'),
    handler: (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
      next(new ApiError('rate_limited', 'Too many requests. Try again later.'));
    },
  };
  const writeMax = env.rateLimitMax;
  app.use(
    rateLimit({
      ...sharedLimit,
      // `max` is the older name. Setting both keeps a copy that only reads `max` from falling back to 5.
      limit: writeMax,
      max: writeMax,
      skip: (req) => req.path === '/api/v1/health' || !isWriteMethod(req.method),
    }),
  );
  const readMax = readRateLimitMax(env.rateLimitMax);
  app.use(
    rateLimit({
      ...sharedLimit,
      limit: readMax,
      max: readMax,
      skip: (req) => req.path === '/api/v1/health' || isWriteMethod(req.method),
    }),
  );
  app.use(cacheControlHeaders());
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: JSON_BODY_LIMIT }));
  app.use(cookieParser());
}
