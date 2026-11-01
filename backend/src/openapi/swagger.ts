import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import type { NodeEnv } from '../config/env.js';
import { openApiSpec } from './spec.js';

/**
 * Human-readable docs at /api/docs and the raw document at /api/docs/openapi.json.
 * Production does not mount them. The catalogue describes every admin route.
 */
export function mountOpenApi(app: Express, nodeEnv: NodeEnv): void {
  if (nodeEnv === 'production') return;
  app.get('/api/docs/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
}
