import type { AppEnv } from '../config/env.js';
import { createDataSource } from '../database/data-source.js';
import { HealthService } from '../modules/health/health.service.js';
import { createLogger, type AppLogger } from '../shared/logging/logger.js';
import type { DataSource } from 'typeorm';

/**
 * Composition root. This is the only place that wires the database to the
 * health service. Feature modules added later are constructed here too.
 */
export class AppContainer {
  readonly health: HealthService;

  constructor(
    readonly env: AppEnv,
    readonly logger: AppLogger,
    readonly dataSource: DataSource,
  ) {
    this.health = new HealthService(dataSource, logger);
  }

  static async create(env: AppEnv): Promise<AppContainer> {
    const logger = createLogger(env);
    const dataSource = createDataSource(env);
    await dataSource.initialize();
    return new AppContainer(env, logger, dataSource);
  }

  async close(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }
}
