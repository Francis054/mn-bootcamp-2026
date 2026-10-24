import type { RequestHandler } from 'express';
import { ApiError } from '../../shared/errors/api-error.js';
import { SESSION_COOKIE_NAME } from '../../shared/http/cookies.js';
import { can, type Permission } from './permissions.js';
import { readCookie } from './cookies.js';
import type { SessionService } from './session.service.js';
import { roleAtLeast, type Role } from '../users/role.js';

export function requireAuth(sessions: SessionService): RequestHandler {
  return (req, _res, next) => {
    const token = readCookie(req.cookies, SESSION_COOKIE_NAME);
    if (!token) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    sessions
      .authenticate(token, new Date())
      .then((found) => {
        if (!found) {
          next(new ApiError('unauthenticated', 'Sign in to continue.'));
          return;
        }
        req.user = found.user;
        req.sessionId = found.sessionId;
        next();
      })
      .catch(next);
  };
}

export function requireRole(minimum: Role): RequestHandler {
  return (req, _res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    if (!roleAtLeast(user.role, minimum)) {
      next(new ApiError('forbidden', 'You do not have access to that.'));
      return;
    }
    next();
  };
}

export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    if (!can(user.role, permission)) {
      next(new ApiError('forbidden', 'You do not have access to that.'));
      return;
    }
    next();
  };
}
