import { Router } from 'express';
import type { HealthService } from './health.service.js';

export function healthRouter(health: HealthService): Router {
  const router = Router();
  router.get('/', (_req, res, next) => {
    health
      .check()
      .then((report) => {
        res.status(report.status === 'ok' ? 200 : 503).json(report);
      })
      .catch(next);
  });
  return router;
}
