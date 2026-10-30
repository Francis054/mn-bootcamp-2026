import { currentEnv } from '@/config/runtime';
import { ApiError } from '@/domain/types';
import { markSessionExpired } from '@/dev/session';
import { devTransport } from '@/dev/transport';
import { buildApiUrl, liveTransport, parseApiResponse, setUnauthorizedHandler, type ApiRequest } from './liveTransport';
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

/** Downloads an administrator file. The live API returns a zip. The development adapter returns JSON text. */
export async function downloadAdminFile(path: string): Promise<void> {
  const normalized = path.startsWith('/api/v1') ? path.slice('/api/v1'.length) : path;
  const env = currentEnv();
  if (env.apiMode !== 'live') {
    const file = await devTransport<{ filename: string; text: string }>({ method: 'GET', path: normalized });
    saveBlob(new Blob([file.text], { type: 'application/json;charset=utf-8' }), file.filename);
    return;
  }
  const response = await fetch(`/api/v1${normalized.startsWith('/') ? normalized : `/${normalized}`}`, {
    credentials: 'include',
    headers: { Accept: 'application/zip, application/json' },
  });
  if (!response.ok) {
    await parseApiResponse(response);
    throw new ApiError('server', 'The download failed.', response.status);
  }
  const blob = await response.blob();
  const match = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '');
  saveBlob(blob, match?.[1] ?? 'trainee-data.zip');
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
