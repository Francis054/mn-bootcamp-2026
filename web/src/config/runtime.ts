import { readEnv, type AppEnv } from './env';

let override: AppEnv | null = null;

export function setEnvForTests(env: AppEnv | null): void {
  override = env;
}

export function currentEnv(): AppEnv {
  return override ?? readEnv();
}
