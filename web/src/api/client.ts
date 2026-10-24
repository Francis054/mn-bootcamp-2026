import { currentEnv } from '@/config/runtime';
import { devTransport } from '@/dev/transport';
import { liveTransport, type ApiRequest } from './liveTransport';

const PREFIX = '/api/v1';

export { setEnvForTests, currentEnv } from '@/config/runtime';

export async function api<T>(req: ApiRequest): Promise<T> {
  const path = req.path.startsWith(PREFIX) ? req.path : `${PREFIX}${req.path.startsWith('/') ? req.path : `/${req.path}`}`;
  const env = currentEnv();
  if (env.apiMode === 'live') return liveTransport<T>({ ...req, path }, env);
  return devTransport<T>({ ...req, path: path.slice(PREFIX.length) || '/' });
}

export type { ApiRequest };
