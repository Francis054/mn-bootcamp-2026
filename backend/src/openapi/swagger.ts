import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './spec.js';

/** Human-readable docs at /api/docs and the raw document at /api/docs/openapi.json. */
export function mountOpenApi(app: Express): void {
  app.get('/api/docs/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
}
