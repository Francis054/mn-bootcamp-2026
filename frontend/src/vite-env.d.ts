/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK_API?: string;
  readonly VITE_AUTH_MODE?: string;
  readonly VITE_DEV_SESSION_TTL_MS?: string;
  /** Set to `on` to show trainee sign-in, sign-up, and sign-out again. */
  readonly VITE_TRAINEE_SELF_SERVICE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
