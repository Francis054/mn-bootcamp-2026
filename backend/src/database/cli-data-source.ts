import { loadEnv } from '../config/env.js';
import { createDataSource } from './data-source.js';

/** Entry the TypeORM CLI loads. It does not connect until the command asks. */
export const AppDataSource = createDataSource(loadEnv());
