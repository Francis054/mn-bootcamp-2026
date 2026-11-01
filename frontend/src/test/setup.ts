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
import { resetBootForTests } from '@/components/bootHold';
import { resetSiteImagesForTests } from '@/hooks/useSiteImages';
import { setEnvForTests } from '@/config/runtime';
import { clearSession } from '@/dev/session';
import { resetState } from '@/dev/store';
import { resetDevTransport } from '@/dev/transport';
import { setAppTodayForTests, SAMPLE_TODAY } from '@/domain/format';

setAppTodayForTests(SAMPLE_TODAY);

Object.defineProperty(window, 'matchMedia', { writable: true, value: (query: string) => ({ matches: query.includes('prefers-reduced-motion'), media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false }) });

window.scrollTo = () => undefined;
if (typeof HTMLElement.prototype.scrollIntoView !== 'function') {
  HTMLElement.prototype.scrollIntoView = () => undefined;
}

afterEach(() => {
  cleanup();
  resetState();
  resetDevTransport();
  setAppTodayForTests(SAMPLE_TODAY);
  clearSession();
  resetPublicCacheForTests();
  resetPublicLoadForTests();
  resetSiteImagesForTests();
  resetBootForTests();
  setEnvForTests(null);
});
