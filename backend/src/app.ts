import express, { type Express } from 'express';
import type { AppEnv } from './config/env.js';
import { healthRouter } from './modules/health/health.routes.js';
import type { HealthService } from './modules/health/health.service.js';
import { mountOpenApi } from './openapi/swagger.js';
import { errorHandler, notFound } from './shared/errors/error-handler.js';
import { csrfCookiePolicy, sessionCookiePolicy } from './shared/http/cookies.js';
import type { AppLogger } from './shared/logging/logger.js';
import { requestId } from './shared/middleware/request-id.js';
import { requestLogger } from './shared/middleware/request-logger.js';
import { applySecurity } from './shared/middleware/security.js';
import './types/express.js';

export interface AppDependencies {
  env: AppEnv;
  logger: AppLogger;
  health: HealthService;
}

/**
 * Build the HTTP application. Callers pass the pieces the composition root
 * already constructed. This function does not open a database connection and
 * does not read process.env.
 */
export function createApp(deps: AppDependencies): Express {
  const app = express();
  if (deps.env.trustProxy) {
    app.set('trust proxy', 1);
  }
  app.locals.cookiePolicy = {
    session: sessionCookiePolicy(deps.env),
    csrf: csrfCookiePolicy(deps.env),
  };

  app.use(requestId());
  app.use(requestLogger(deps.logger));
  applySecurity(app, deps.env);
  app.use('/api/v1/health', healthRouter(deps.health));
  mountOpenApi(app);
  app.use(notFound());
  app.use(errorHandler(deps.logger, deps.env));
  return app;
}
