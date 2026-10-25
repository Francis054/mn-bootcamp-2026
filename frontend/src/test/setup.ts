import '@testing-library/jest-dom/vitest';

if (typeof URL.createObjectURL !== 'function') {
  let nextBlob = 0;
  URL.createObjectURL = () => `blob:http://localhost/${nextBlob++}`;
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => undefined;
}
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { resetPublicCacheForTests } from '@/api/publicCache';
import { resetPublicLoadForTests } from '@/hooks/useContent';
import { setEnvForTests } from '@/config/runtime';
import { clearSession } from '@/dev/session';
import { resetState } from '@/dev/store';
import { resetDevTransport } from '@/dev/transport';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

afterEach(() => {
  cleanup();
  resetState();
  resetDevTransport();
  clearSession();
  resetPublicCacheForTests();
  resetPublicLoadForTests();
  setEnvForTests(null);
});
