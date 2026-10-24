/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK_API?: string;
  readonly VITE_AUTH_MODE?: string;
  readonly VITE_DEV_SESSION_TTL_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
