export type ApiMode = 'development-adapter' | 'live';
export type AuthMode = 'development' | 'disabled';

export interface AppEnv {
  apiMode: ApiMode;
  apiBaseUrl: string;
  authMode: AuthMode;
  sessionTtlMs: number;
}

function read(source: ImportMetaEnv | Record<string, string | undefined>, key: string): string {
  const value = source[key as keyof ImportMetaEnv];
  return typeof value === 'string' ? value : '';
}

export function readEnv(source: ImportMetaEnv | Record<string, string | undefined> = import.meta.env): AppEnv {
  const apiMode = read(source, 'VITE_API_MODE') === 'live' ? 'live' : 'development-adapter';
  const authMode = read(source, 'VITE_AUTH_MODE') === 'disabled' ? 'disabled' : 'development';
  const ttl = Number(read(source, 'VITE_DEV_SESSION_TTL_MS'));
  return {
    apiMode,
    apiBaseUrl: read(source, 'VITE_API_BASE_URL').trim(),
    authMode,
    sessionTtlMs: Number.isFinite(ttl) && ttl > 0 ? ttl : 1_800_000,
  };
}
