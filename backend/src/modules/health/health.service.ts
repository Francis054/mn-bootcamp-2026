import type { AppLogger } from '../../shared/logging/logger.js';

export interface DatabaseProbe {
  query(statement: string): Promise<unknown>;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  uptimeSeconds: number;
}

/**
 * Asks the database one fixed question. The answer shown to the caller is
 * only up or down. Driver messages stay off the response and out of the log,
 * because they can contain a host name or a connection URL.
 */
export class HealthService {
  constructor(
    private readonly database: DatabaseProbe,
    private readonly logger: AppLogger,
  ) {}

  async check(): Promise<HealthReport> {
    const uptimeSeconds = Math.floor(process.uptime());
    try {
      await this.database.query('SELECT 1');
      return { status: 'ok', database: 'up', uptimeSeconds };
    } catch (error) {
      this.logger.warn(databaseFailureFields(error), 'Database health check failed');
      return { status: 'degraded', database: 'down', uptimeSeconds };
    }
  }
}

function databaseFailureFields(error: unknown): { name: string; code?: string } {
  const name = error instanceof Error ? error.name : 'UnknownError';
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code;
    if (typeof code === 'string' && /^[A-Z0-9]{5}$/.test(code)) {
      return { name, code };
    }
  }
  return { name };
}
