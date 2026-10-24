import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { AppEnv } from '../../config/env.js';
import { ApiError } from '../errors/api-error.js';

const JSON_BODY_LIMIT = '1mb';

/**
 * Helmet, a single allowed browser origin, a general rate limit, and a 1 MB
 * JSON cap. Health checks skip the rate limit so a probe cannot lock the API
 * out of its own liveness route. Login will get a stricter limit later.
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
  app.use(
    rateLimit({
      windowMs: env.rateLimitWindowMs,
      limit: env.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false, xForwardedForHeader: false },
      skip: (req) => req.path === '/api/v1/health',
      handler: (_req, _res, next) => {
        next(new ApiError('rate_limited', 'Too many requests. Try again later.'));
      },
    }),
  );
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: JSON_BODY_LIMIT }));
  app.use(cookieParser());
}
