import { describe, expect, it } from 'vitest';
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  csrfCookiePolicy,
  sessionCookiePolicy,
} from '../../src/shared/http/cookies.js';
import { testEnv } from '../support/app-env.js';

describe('cookie policy', () => {
  it('keeps the session host-only, HttpOnly, and Lax on the API path', () => {
    const policy = sessionCookiePolicy(testEnv());
    expect(policy).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/api/v1',
    });
    expect(policy).not.toHaveProperty('domain');
    expect(SESSION_COOKIE_NAME).toBe('mn_session');
  });

  it('lets the page read the CSRF cookie and sets Secure only in production', () => {
    const policy = csrfCookiePolicy(testEnv({ nodeEnv: 'production' }));
    expect(policy).toEqual({
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
    expect(policy).not.toHaveProperty('domain');
    expect(CSRF_COOKIE_NAME).toBe('mn_csrf');
  });
});
