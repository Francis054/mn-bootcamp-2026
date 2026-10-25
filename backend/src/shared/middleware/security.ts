import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { AppEnv } from '../../config/env.js';
import {
  PUBLIC_GET_RATE_LIMIT_MAX,
  cacheControlHeaders,
  isPublicGetPath,
} from '../http/cache-control.js';
import { ApiError } from '../errors/api-error.js';

const JSON_BODY_LIMIT = '1mb';

/**
 * Helmet, a single allowed browser origin, rate limits, and a 1 MB JSON cap.
 * Health checks skip the rate limits so a probe cannot lock the API out of its
 * own liveness route. Public page reads have a higher ceiling than sign-in and
 * writes, so a classroom refresh cannot use up the stricter budget.
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
          'img-src': ["'self'", 'data:'],
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
    validate: { trustProxy: false, xForwardedForHeader: false },
    handler: (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
      next(new ApiError('rate_limited', 'Too many requests. Try again later.'));
    },
  };
  app.use(
    rateLimit({
      ...sharedLimit,
      limit: env.rateLimitMax,
      skip: (req) => req.path === '/api/v1/health' || isPublicGetPath(req.method, req.path),
    }),
  );
  app.use(
    rateLimit({
      ...sharedLimit,
      limit: Math.max(env.rateLimitMax, PUBLIC_GET_RATE_LIMIT_MAX),
      skip: (req) => !isPublicGetPath(req.method, req.path),
    }),
  );
  app.use(cacheControlHeaders());
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: JSON_BODY_LIMIT }));
  app.use(cookieParser());
}
