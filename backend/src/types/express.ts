import type { PublicUser } from '../modules/users/public-user.js';
import type { CookiePolicy } from '../shared/http/cookies.js';

// Express publishes its request fields as a namespace. Merging into it is the
// supported way to add `req.id`.

export interface CookiePolicies {
  session: CookiePolicy;
  csrf: CookiePolicy;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      user?: PublicUser;
      sessionId?: string;
    }

    interface Locals {
      cookiePolicy: CookiePolicies;
      sessionAbsoluteTtlMs: number;
    }
  }
}

export {};
