import { describe, expect, it } from 'vitest';
import { HealthService } from '../../src/modules/health/health.service.js';
import { captureLogger } from '../support/logger.js';

describe('HealthService', () => {
  it('reports the database up when the probe answers', async () => {
    const { logger } = captureLogger();
    const service = new HealthService({ query: () => Promise.resolve([{ ok: 1 }]) }, logger);
    const report = await service.check();
    expect(report.status).toBe('ok');
    expect(report.database).toBe('up');
    expect(report.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('reports down without copying the driver message into the report or the log', async () => {
    const { logger, lines } = captureLogger();
    const service = new HealthService(
      {
        query: () => Promise.reject(new Error('postgres://app:secret-password@db.internal/prod')),
      },
      logger,
    );
    const report = await service.check();
    const written = lines().join('');
    expect(report).toMatchObject({ status: 'degraded', database: 'down' });
    expect(JSON.stringify(report)).not.toContain('secret-password');
    expect(written).not.toContain('secret-password');
    expect(written).toContain('Database health check failed');
  });
});
