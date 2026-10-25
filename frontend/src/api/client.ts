import { currentEnv } from '@/config/runtime';
import { markSessionExpired } from '@/dev/session';
import { devTransport } from '@/dev/transport';
import { buildApiUrl, liveTransport, setUnauthorizedHandler, type ApiRequest } from './liveTransport';
import { clearPublicCache, isAdminWrite, isCacheablePublicGet, readThroughPublicCache } from './publicCache';

const PREFIX = '/api/v1';

setUnauthorizedHandler(markSessionExpired);

export { setEnvForTests, currentEnv } from '@/config/runtime';

export async function api<T>(req: ApiRequest): Promise<T> {
  const path = req.path.startsWith(PREFIX) ? req.path : `${PREFIX}${req.path.startsWith('/') ? req.path : `/${req.path}`}`;
  const env = currentEnv();
  if (env.apiMode !== 'live') return devTransport<T>({ ...req, path: path.slice(PREFIX.length) || '/' });
  const liveReq = { ...req, path };
  if (isCacheablePublicGet(liveReq.method, liveReq.path)) {
    return readThroughPublicCache(buildApiUrl(liveReq.path, liveReq.query), () => liveTransport<T>(liveReq, env));
  }
  const result = await liveTransport<T>(liveReq, env);
  if (isAdminWrite(liveReq.method, liveReq.path)) clearPublicCache();
  return result;
}

export type { ApiRequest };
